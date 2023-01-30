import db from './db.js'
import logger from './logger.js'

// protocol_name -> id mapping
const protocols = {
    map: {
        storage: {},
        l2: {}
    },
    defaults: {
        storage: 'ipfs',
        l2: 'gundb' // todo future defaults?
    },
    retrieveMap: async () => {
        let storage = await db.client.query('SELECT * FROM halive_app.storage_protocols;')
        let l2 = await db.client.query('SELECT * FROM halive_app.l2_protocols;')
        for (let i in storage.rows)
            protocols.map.storage[storage.rows[i].protocol_name] = storage.rows[i].id
        for (let i in l2.rows)
            protocols.map.l2[l2.rows[i].protocol_name] = l2.rows[i].id
        logger.debug('Loaded protocol_name -> id mapping, storage:',storage.rowCount,'l2:',l2.rowCount)
        logger.trace(protocols.map)
    }
}

export default protocols