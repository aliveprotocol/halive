import * as fs from 'fs'
import { dirname } from 'path'
import { fileURLToPath } from 'url'
import { START_BLOCK, DB_VERSION, APP_CONTEXT } from './constants.js'
import db from './db.js'
import context from './context.js'
import logger from './logger.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SCHEMA_NAME = 'halive_app'
const HAF_TABLES = [
    'streamer',
    'streams',
    'hls_segments'
]
const HAF_FKS = {
    streamer_fk: {
        table: SCHEMA_NAME+'.streamer',
        fk: 'id',
        ref: 'hive.accounts(id)'
    },
    streams_streamer_fk: {
        table: SCHEMA_NAME+'.streams',
        fk: 'streamer',
        ref: SCHEMA_NAME+'.streamer(id)'
    },
    streams_l2_protocol_fk: {
        table: SCHEMA_NAME+'.streams',
        fk: 'l2_protocol',
        ref: SCHEMA_NAME+'.l2_protocols(id)'
    },
    streams_storage_protocol_fk: {
        table: SCHEMA_NAME+'.streams',
        fk: 'storage_protocol',
        ref: SCHEMA_NAME+'.storage_protocols(id)'
    },
    hls_segment_stream_id_fk: {
        table: SCHEMA_NAME+'.hls_segments',
        fk: 'stream_id',
        ref: SCHEMA_NAME+'.streams(id)'
    }
}

const schema = {
    setup: async () => {
        logger.info('Setting up HAF app database...')
        await db.client.query(`CREATE SCHEMA IF NOT EXISTS ${SCHEMA_NAME};`)

        // setup app context
        let ctxExists = await context.exists()
        if (!ctxExists)
            await context.create()
        
        // setup app tables
        await db.client.query(fs.readFileSync(__dirname+'/sql/create_tables.sql','utf-8'))

        // inheritance for forking app
        for (let t in HAF_TABLES)
            await db.client.query(`ALTER TABLE ${SCHEMA_NAME}.${HAF_TABLES[t]} INHERIT hive.${SCHEMA_NAME};`)

        // use 'accounts' state provider
        await db.client.query(`SELECT hive.app_state_provider_import('ACCOUNTS',$1);`,[APP_CONTEXT])
        logger.info('Imported accounts state provider')

        // detach app context
        await context.detach()

        // start block
        let startBlock = Math.max(START_BLOCK-1,0)
        logger.info('Set start block to #'+(startBlock+1))

        // fill with initial values
        await db.client.query(`INSERT INTO ${SCHEMA_NAME}.l2_protocols(protocol_name) VALUES('gundb');`)
        await db.client.query(`INSERT INTO ${SCHEMA_NAME}.storage_protocols(protocol_name) VALUES('ipfs');`)
        await db.client.query(`INSERT INTO ${SCHEMA_NAME}.storage_protocols(protocol_name) VALUES('skynet');`)
        await db.client.query(`INSERT INTO ${SCHEMA_NAME}.state(last_processed_block, db_version) VALUES($1, $2);`,[startBlock,DB_VERSION])

        // create relevant functions
        await schema.createFx()

        logger.info('HAF app database set up successfully!')
    },
    loaded: async () => {
        let schemaTbls = await db.client.query('SELECT 1 FROM pg_catalog.pg_tables WHERE schemaname=$1;',[SCHEMA_NAME])
        return schemaTbls.rowCount > 0
    },
    createFx: async () => {
        await db.client.query(fs.readFileSync(__dirname+'/sql/create_functions.sql','utf-8'))
        logger.info('Created relevant PL/pgSQL functions and types')
    },
    fkExists: async (fk) => {
        let constraint = await db.client.query('SELECT * FROM information_schema.constraint_column_usage WHERE constraint_name=$1',[fk])
        return constraint.rowCount > 0
    },
    fkCreate: async () => {
        for (let fk in HAF_FKS) {
            logger.info('Creating FK',fk)
            if (await schema.fkExists(fk)) {
                logger.info('FK',fk,'already exists, skipping')
                continue
            }
            let start = new Date().getTime()
            await db.client.query(`ALTER TABLE ${HAF_FKS[fk].table} ADD CONSTRAINT ${fk} FOREIGN KEY(${HAF_FKS[fk].fk}) REFERENCES ${HAF_FKS[fk].ref} DEFERRABLE INITIALLY DEFERRED;`)
            logger.info('FK',fk,'created in',(new Date().getTime()-start),'ms')
        }
    },
    fkDrop: async () => {
        for (let fk in HAF_FKS)
            if (await schema.fkExists(fk)) {
                logger.info('Droping FK',fk)
                let start = new Date().getTime()
                await db.client.query(`ALTER TABLE ${HAF_FKS[fk].table} DROP CONSTRAINT IF EXISTS ${fk};`)
                logger.info('FK',fk,'dropped in',(new Date().getTime()-start),'ms')
            }
    }
}

export default schema