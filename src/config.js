import yargs from 'yargs'
import * as dotenv from 'dotenv'

dotenv.config()
const { argv } = yargs(process.argv)

let haliveConfig = {
    postgres_url: 'postgres://username:password@127.0.0.1:5432/block_log',

    // halive api server port
    http_host: '127.0.0.1',
    http_port: 3010,

    // default endpoints for chunk content retrieval
    ipfs_gateway: 'https://ipfs.io',
    skynet_webportal: 'https://siasky.net',

    // fetch timeouts
    chunk_fetch_timeout: 20,

    // logging
    log_level: 'info'
}

// Config overwrites through CLI args or environment vars
for (let c in haliveConfig)
    haliveConfig[c] = argv[c] || process.env['HALIVE_' + c.toUpperCase()] || haliveConfig[c]

export default haliveConfig