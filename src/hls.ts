import haliveConfig from './config.js'
import { MAX_CHUNK_BYTES } from './constants.js'
import logger from './logger.js'

const hls = {
    fetchChunk: async (chunk_hash: string) => {
        try {
            // fetch headers to retrieve size
            // chunk sizes must not exceed MAX_CHUNK_BYTES
            let controller = new AbortController()
            const id = setTimeout(() => controller.abort(), haliveConfig.chunk_fetch_timeout*1000)
            let headChunk = await fetch(haliveConfig.ipfs_gateway+'/ipfs/'+chunk_hash,{ method: 'HEAD', signal: controller.signal })
            clearTimeout(id)
            if (headChunk.status !== 200)
                return { error: 'head chunk failed with status code '+headChunk.status }
            let chunkSize = parseInt(headChunk.headers.get('content-length')!)
            if (chunkSize > MAX_CHUNK_BYTES)
                return { error: 'chunk size is greater than MAX_CHUNK_BYTES' }
            if (headChunk.headers.get('content-type') !== 'text/csv')
                return { error: 'chunks must be in csv format' }

            // fetch chunk content
            let controller2 = new AbortController()
            const id2 = setTimeout(() => controller2.abort(), haliveConfig.chunk_fetch_timeout*1000)
            let fetchedChunk = await fetch(haliveConfig.ipfs_gateway+'/ipfs/'+chunk_hash,{ method: 'GET', signal: controller2.signal })
            clearTimeout(id2)
            if (fetchedChunk.status !== 200)
                return { error: 'fetch chunk failed with status code '+fetchedChunk.status }
            return { error: null, chunk: await fetchedChunk.text() }
        } catch (e) {
            logger.trace(e)
            if (e.name === 'AbortError')
                return { error: 'chunk fetch requet timeout' }
            return { error: 'unknown error when fetching chunk' }
        }
    }
}

export default hls