import pg from 'pg'
import haliveConfig from './config.js'
import logger from './logger.js'

const client = new pg.Client({ connectionString: haliveConfig.postgres_url })

const db = {
    init: async () => {
        await client.connect()
        logger.info('Connected to database',haliveConfig.postgres_url)
    },
    disconnect: async () => {
        await client.end()
        logger.info('Disconnected from database')
    },
    client: client
}

export default db