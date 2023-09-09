import { CID } from 'multiformats/cid'
import haliveConfig from './config.js'
import { MAX_CHUNK_BYTES } from './constants.js'
import logger from './logger.js'

const hls = {
    fetchChunk: async (chunk_hash: string) => {
        try {
            // fetch headers to retrieve size
            // chunk sizes must not exceed MAX_CHUNK_BYTES
            let codec: number
            try {
                codec = CID.parse(chunk_hash).code
            } catch {
                return { error: 'failed to parse cid info' }
            }
            if (codec === 0x70) {
                // usually starts with 'Qm' or 'bafybei'
                // cids starting with Qm are ideal for single-res Hive L1 due to lower RC consumption as it is more compact
                let controller = new AbortController()
                const id = setTimeout(() => controller.abort(), haliveConfig.chunkFetchTimeout*1000)
                let headChunk = await fetch(haliveConfig.ipfsGateway+'/ipfs/'+chunk_hash,{ method: 'HEAD', signal: controller.signal })
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
                const id2 = setTimeout(() => controller2.abort(), haliveConfig.chunkFetchTimeout*1000)
                let fetchedChunk = await fetch(haliveConfig.ipfsGateway+'/ipfs/'+chunk_hash,{ method: 'GET', signal: controller2.signal })
                clearTimeout(id2)
                if (fetchedChunk.status !== 200)
                    return { error: 'fetch chunk failed with status code '+fetchedChunk.status }
                return { error: null, chunk: await fetchedChunk.text() }
            } else if (codec === 0x71) {
                // TODO: dag-cbor json format (cidv1 starting with bafyrei)
                // usually starts with 'bafyrei', ideal for multi-res streams and VSC
                return { error: 'dag-cbor handling not implemented' }
            } else {
                return { error: 'unsupported cid codec' }
            }
        } catch (e: any) {
            logger.trace(e)
            if (e.name === 'AbortError')
                return { error: 'chunk fetch request timeout' }
            return { error: 'unknown error when fetching chunk' }
        }
    }
}

export default hls