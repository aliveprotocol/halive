import express from 'express'
import cors from 'cors'
import logger from './logger.js'
import haliveConfig from './config.js'
import db from './db.js'
import hls from './hls.js'
import protocols from './protocols.js'
import { StreamRequestTypes } from './server_types.js'

await db.init()
await protocols.retrieveMap()
const app = express()
app.use(cors())

app.get('/', async (req,res) => {
    let query = await db.client.query('SELECT halive_api.home();')
    if (query.rowCount === 0)
        return res.status(503).send({ error: 'no state found' })
    res.send(query.rows[0].home)
})

app.get('/get_stream_info', async (req,res) => {
    if (typeof req.query.stream_author !== 'string' || typeof req.query.stream_link !== 'string')
        return res.status(400).send({ error: 'stream_author and stream_link are required' })
    let streamQuery = await db.client.query('SELECT halive_api.get_stream_info($1,$2);',[req.query.stream_author,req.query.stream_link])
    if (streamQuery.rowCount === 0)
        return res.status(404).send({ error: 'stream not found' })
    let stream = streamQuery.rows[0].get_stream_info
    res.send(stream)
})

app.get('/get_stream_chunks', async (req,res) => {
    if (typeof req.query.stream_author !== 'string' || typeof req.query.stream_link !== 'string')
        return res.status(400).send({ error: 'stream_author and stream_link are required' })
    let streamQuery = await db.client.query('SELECT halive_api.get_stream_chunks($1,$2);',[req.query.stream_author,req.query.stream_link])
    res.send(streamQuery.rows[0].get_stream_chunks)
})

app.get('/stream/:author/:link', async (req: StreamRequestTypes,res) => {
    if (typeof req.params.author !== 'string' || typeof req.params.link !== 'string')
        return res.status(400).send({ error: 'author and/or link is required' })
    let quality = req.query.quality || 'src'
    let gw = req.query.gw || haliveConfig.ipfsGateway
    let fetchTimeout = parseInt(req.query.fetchtimeout || '')
    if (isNaN(fetchTimeout) || fetchTimeout <= 0 || fetchTimeout > haliveConfig.chunkFetchTimeout)
        fetchTimeout = haliveConfig.chunkFetchTimeout
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
        let chunkLines: any[] = []
        if (!chunks.rows[i].len) {
            let chunkCached = await db.client.query('SELECT halive_app.cached_chunk_contents($1,$2);',[chunks.rows[i][quality+'_hash'],protocols.map.storage.ipfs])
            if (chunkCached.rowCount === 0 || !chunkCached.rows[0].cached_chunk_contents) {
                let chunkContents = await hls.fetchChunk(chunks.rows[i][quality+'_hash'])
                if (chunkContents.error || !chunkContents.chunk)
                    continue
                chunkLines = chunkContents.chunk.split('\n')

                // cache chunk contents async
                db.client.query('SELECT halive_app.cache_chunk($1,$2,$3);',[chunks.rows[i][quality+'_hash'],protocols.map.storage.ipfs,chunkContents.chunk])
            } else
                chunkLines = chunkCached.rows[0].cached_chunk_contents.split('\n')
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
    else if (stream.l2_protocol === 'gundb' && stream.l2_pub) {
        // fetch from alivedb
        try {
            let alivedbFetch = await fetch(`${haliveConfig.alivedbUrl}/getStream?pub=${stream.l2_pub}&streamer=${req.params.author}&link=${req.params.link}&network=hive&ts=${new Date(stream.last_streamed).getTime()+1}`,{ method: 'GET' })
            let alivedbResp = await alivedbFetch.json()
            if (Array.isArray(alivedbResp))
                for (let i in alivedbResp)
                    if (typeof alivedbResp[i] === 'object' && !Array.isArray(alivedbResp[i]) && typeof alivedbResp[i].len === 'number' && typeof alivedbResp[i][quality] === 'string') {
                        m3u8File += '#EXTINF:'+alivedbResp[i].len+',\n'
                        m3u8File += gw+'/ipfs/'+alivedbResp[i][quality]+'\n'
                    }
        } catch {
            // skip alivedb fetch if errored
        }
    }
    res.setHeader('Content-Type','text/plain')
    res.send(m3u8File)
})

const server = app.listen(haliveConfig.httpPort,haliveConfig.httpHost,() => {
    logger.info(`HAlive HLS server listening to ${haliveConfig.httpHost+':'+haliveConfig.httpPort}`)
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