import yargs from 'yargs'
import * as dotenv from 'dotenv'

dotenv.config()
const haliveConfig = yargs(process.argv)
    .env('HALIVE')
    .options({
        postgresUrl: {
            type: 'string',
            default: 'postgres://username:password@127.0.0.1:5432/block_log'
        },
        httpHost: {
            type: 'string',
            default: '127.0.0.1'
        },
        httpPort: {
            type: 'number',
            default: 3010
        },
        ipfsGateway: {
            type: 'string',
            default: 'https://ipfs.io'
        },
        alivedbUrl: {
            type: 'string',
            default:'http://localhost:3006'
        },
        chunkFetchTimeout: {
            type: 'number',
            default: 20
        },
        logLevel: {
            type: 'string',
            default: 'info'
        }
    })
    .parseSync()

export default haliveConfig