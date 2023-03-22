import express from 'express'
import cors from 'cors'
import logger from './logger.js'
import haliveConfig from './config.js'
import db from './db.js'
import hls from './hls.js'

await db.init()
const app = express()
app.use(cors())

app.get('/', async (req,res) => {
    let query = await db.client.query('SELECT halive_api.home();')
    if (query.rowCount === 0)
        return res.status(503).send({ error: 'no state found' })
    res.send(query.rows[0].home)
})

app.get('/get_stream_info', async (req,res) => {
    if (typeof req.query.author !== 'string' || typeof req.query.link !== 'string')
        return res.status(400).send({ error: 'author and/or link is required' })
    let streamQuery = await db.client.query('SELECT halive_api.get_stream_info($1,$2);',[req.query.author,req.query.link])
    if (streamQuery.rowCount === 0)
        return res.status(404).send({ error: 'stream not found' })
    let stream = streamQuery.rows[0].get_stream_info
    res.send(stream)
})

app.get('/stream/:author/:link', async (req,res) => {
    if (typeof req.params.author !== 'string' || typeof req.params.link !== 'string')
        return res.status(400).send({ error: 'author and/or link is required' })
    let quality = req.query.quality || 'src'
    let gw = req.query.gw || haliveConfig.ipfs_gateway
    let fetchTimeout = parseInt(req.query.fetchtimeout)
    if (isNaN(fetchTimeout) || fetchTimeout <= 0 || fetchTimeout > haliveConfig.chunk_fetch_timeout)
        fetchTimeout = haliveConfig.chunk_fetch_timeout
    let streamQuery = await db.client.query('SELECT halive_api.get_stream_info($1,$2);',[req.params.author,req.params.link])
    if (streamQuery.rowCount === 0)
        return res.status(404).send({ error: 'stream not found' })
    let stream = streamQuery.rows[0].get_stream_info
    let chunks = await db.client.query('SELECT * FROM halive_api.get_hls_segments($1);',[stream.id])

    // construct m3u8 file
    let m3u8File = '#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-TARGETDURATION:10\n#EXT-X-MEDIA-SEQUENCE:0'
    if (stream.ended)
        m3u8File += '\n#EXT-X-PLAYLIST-TYPE:VOD'
    else
        m3u8File += '\n#EXT-X-PLAYLIST-TYPE:EVENT'
    m3u8File += '\n\n'
    for (let i in chunks.rows) {
        if (!chunks.rows[i][quality+'_hash'])
            continue
        let chunkLines = []
        if (!chunks.rows[i].len) {
            let chunkContents = await hls.fetchChunk(chunks.rows[i][quality+'_hash'])
            if (chunkContents.error || !chunkContents.chunk)
                continue
            chunkLines = chunkContents.chunk.split('\n')
        } else {
            // unbundled segments submitted to L1
            chunkLines = [chunks.rows[i][quality+'_hash']+','+chunks.rows[i].len]
        }
        for (let l in chunkLines) {
            let segment = chunkLines[l].split(',')
            if (segment.length < 2)
                continue
            m3u8File += '#EXTINF:'+segment[1]+',\n'
            m3u8File += gw+'/ipfs/'+segment[0]+'\n'
        }
    }
    if (stream.ended)
        m3u8File += '#EXT-X-ENDLIST'
    // todo fetch from alivedb
    res.setHeader('Content-Type','text/plain')
    res.send(m3u8File)
})

const server = app.listen(haliveConfig.http_port,haliveConfig.http_host,() => {
    logger.info(`HAlive HLS server listening to ${haliveConfig.http_host+':'+haliveConfig.http_port}`)
})

let terminating = false
const handleExit = async () => {
    if (terminating) return
    terminating = true
    process.stdout.write('\r')
    logger.info('Received SIGINT')
    await db.disconnect()
    server.close()
    logger.info('HLS server closed successfully')
    process.exit(0)
}

process.on('SIGINT', handleExit)
process.on('SIGTERM', handleExit)