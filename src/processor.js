import { ALIVEDB_PUBKEY_MAX_LENGTH, CUSTOM_JSON_ID, OP_CODES } from './constants.js'
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
                streamer: parsed.value.required_posting_auths[0],
                link: payload.link
            }
            switch (payload.op) {
                case 2:
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
                case 2:
                    await db.client.query('SELECT halive_app.process_stream_update($1,$2,$3,$4,$5);',[result.streamer,result.link,result.l2,result.l2_pub,result.storage])
                    break
                default:
                    break
            }
        }
        return result.valid
    }
}

export default processor