import express from 'express'
import cors from 'cors'
import logger from './logger.js'
import haliveConfig from './config.js'
import db from './db.js'

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