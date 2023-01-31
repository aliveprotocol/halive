import { ALIVEDB_PUBKEY_MAX_LENGTH, CUSTOM_JSON_ID, MAX_CHUNKS, MAX_SEGMENT_LENGTH_NINCL, OP_CODES, SUPPORTED_RES } from './constants.js'
import protocols from './protocols.js'
import db from './db.js'
import logger from './logger.js'

const processor = {
    validateAndParse: async (op) => {
        try {
            let parsed = JSON.parse(op.body)
            // sanitize and filter custom json
            if (parsed.type !== 'custom_json_operation' ||
                !parsed.value ||
                parsed.value.id !== CUSTOM_JSON_ID ||
                !Array.isArray(parsed.value.required_posting_auths) ||
                parsed.value.required_posting_auths.length > 1 || // who is really transacting in multisig?
                !parsed.value.json)
                return { valid: false }
            let payload = JSON.parse(parsed.value.json)
            if (!Number.isInteger(payload.op) ||
                payload.op >= OP_CODES.length || payload.op < 0 || // op code must be valid
                typeof payload.link !== 'string')
                return { valid: false }
            let details = {
                valid: true,
                op: payload.op,
                ts: new Date(op.created_at),
                streamer: parsed.value.required_posting_auths[0],
                link: payload.link
            }
            switch (payload.op) {
                case 0:
                    // push stream
                    let userId = await db.client.query('SELECT id FROM hive.halive_app_accounts WHERE name=$1;',[details.streamer])
                    let stream = await db.client.query('SELECT * FROM halive_app.streams WHERE streamer=$1 AND link=$2;',[userId.rows[0].id,details.link])
                    if (stream.rowCount === 0 || stream.rows[0].ended)
                        return { valid: false }
                    details.seq = parseInt(payload.seq)
                    if (isNaN(details.seq) || details.seq < 0 || (typeof stream.rows[0].chunk_finalized === 'number' && (stream.rows[0].chunk_finalized >= details.seq || details.seq > MAX_CHUNKS)))
                        return { valid: false }
                    details.src = payload.src || null
                    for (let q in SUPPORTED_RES)
                        if (payload[SUPPORTED_RES[q]])
                            details[SUPPORTED_RES[q]] = payload[SUPPORTED_RES[q]]
                    if (payload.len) {
                        details.len = parseFloat(payload.len)
                        if (isNaN(details.len))
                            return { valid: false } // should we treat invalid lengths as batched chunk instead?
                        else if (details.len >= MAX_SEGMENT_LENGTH_NINCL || details.len <= 0)
                            return { valid: false } // ignore invalid lengths
                        details.len = parseFloat(details.len.toFixed(6))
                    }
                    return details
                case 1:
                    // end stream
                    return details
                case 2:
                    // configure/update stream
                    let inStorageProto = typeof payload.storage === 'string' ? payload.storage.trim().toLowerCase() : protocols.defaults.storage
                    let inL2Proto = typeof payload.l2 === 'string' ? payload.l2.trim().toLowerCase() : null
                    details.storage = Number.isInteger(protocols.map.storage[inStorageProto]) ? protocols.map.storage[inStorageProto] : protocols.defaults.storage
                    details.l2 = Number.isInteger(protocols.map.l2[inL2Proto]) ? protocols.map.l2[inL2Proto] : null
                    if (typeof payload.pub === 'string' && payload.pub.length <= ALIVEDB_PUBKEY_MAX_LENGTH)
                        details.l2_pub = payload.pub
                    return details
                default:
                    logger.trace('Unhandled operation type '+payload.op+' in block #'+op.block_num+', op id: '+op.id)
                    return { valid: false }
            }
        } catch {
            logger.debug('Failed to parse operation, id:',op.id,'block:',op.block_num)
            return { valid: false }
        }
    },
    process: async (op) => {
        let result = await processor.validateAndParse(op)
        if (result.valid) {
            logger.trace('Processing op',result)
            switch (result.op) {
                case 0:
                    await db.client.query('SELECT halive_app.process_stream_push($1,$2,$3,$4,$5,$6);',[result.streamer,result.link,result.seq,result.len,result.src,result.ts])
                    break
                case 1:
                    await db.client.query('SELECT halive_app.process_stream_end($1,$2,$3);',[result.streamer,result.link,result.ts])
                    break
                case 2:
                    await db.client.query('SELECT halive_app.process_stream_update($1,$2,$3,$4,$5,$6);',[result.streamer,result.link,result.l2,result.l2_pub,result.storage,result.ts])
                    break
                default:
                    break
            }
        }
        return result.valid
    }
}

export default processor