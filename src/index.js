import logger from './logger.js'
import db from './db.js'
import schema from './schema.js'

let terminating = false

await db.init()
if (!(await schema.loaded()))
    await schema.setup()

const handleExit = async () => {
    if (terminating) return
    terminating = true
    process.stdout.write('\r')
    logger.info('Received SIGINT')
    await db.disconnect()
    process.exit(0)
}

process.on('SIGINT', handleExit)
process.on('SIGTERM', handleExit)