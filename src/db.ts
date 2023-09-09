import pg from 'pg'
import haliveConfig from './config.js'
import logger from './logger.js'

const client = new pg.Client({ connectionString: haliveConfig.postgresUrl })

const db = {
    init: async () => {
        await client.connect()
        logger.info('Connected to database',haliveConfig.postgresUrl)
    },
    disconnect: async () => {
        await client.end()
        logger.info('Disconnected from database')
    },
    restart: async () => {
        await db.client.end()
        db.client = new pg.Client({ connectionString: haliveConfig.postgresUrl })
        await db.client.connect()
    },
    client: client
}

export default db