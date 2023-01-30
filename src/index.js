import logger from './logger.js'
import db from './db.js'
import schema from './schema.js'
import sync from './sync.js'

await db.init()
if (!(await schema.loaded()))
    await schema.setup()

const handleExit = async () => {
    if (sync.terminating) return
    sync.terminating = true
    process.stdout.write('\r')
    logger.info('Received SIGINT')
}

process.on('SIGINT', handleExit)
process.on('SIGTERM', handleExit)

sync.prebegin()