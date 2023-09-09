import yargs from 'yargs'
import * as dotenv from 'dotenv'

dotenv.config()
const argv = yargs(process.argv).options({
    postgres_url: { type: 'string' },
    http_host: { type: 'string' },
    http_port: { type: 'number' },
    ipfs_gateway: { type: 'string' },
    alivedb_url: { type: 'string' },
    chunk_fetch_timeout: { type: 'number' },
    log_level: { type: 'string'}
}).parseSync()

let haliveConfig = {
    postgres_url: argv.postgres_url || process.env.HALIVE_POSTGRES_URL || 'postgres://username:password@127.0.0.1:5432/block_log',

    // halive api server port
    http_host: argv.http_host || process.env.HALIVE_HTTP_HOST || '127.0.0.1',
    http_port: argv.http_port || parseInt(process.env.HALIVE_HTTP_PORT || '3010'),

    // default endpoints for chunk content retrieval
    ipfs_gateway: argv.ipfs_gateway || process.env.HALIVE_IPFS_GATEWAY || 'https://ipfs.io',

    // alivedb endpoint
    alivedb_url: argv.alivedb_url || process.env.HALIVE_ALIVEDB_URL || 'http://localhost:3006',

    // fetch timeouts
    chunk_fetch_timeout: argv.chunk_fetch_timeout || parseInt(process.env.HALIVE_CHUNK_FETCH_TIMEOUT || '20'),

    // logging
    log_level: argv.log_level || process.env.HALIVE_LOG_LEVEL || 'info'
}

export default haliveConfig