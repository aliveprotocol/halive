import db from './db.js'
import context from './context.js'
import logger from './logger.js'
import processor from './processor.js'
import protocols from './protocols.js'

const MASSIVE_SYNC_THRESHOLD = 100
const MASSIVE_SYNC_BATCH = 100

const sync = {
    terminating: false,
    prebegin: async () => {
        // retrieve protocols map
        await protocols.retrieveMap()

        // attach context
        let head = (await db.client.query('SELECT last_processed_block FROM halive_app.state;')).rows[0].last_processed_block
        await context.attach(head)
        sync.begin()
    },
    begin: async () => {
        if (sync.terminating) return

        // query next block
        let nextBlocks = await context.nextBlocks()
        if (nextBlocks.first_block === null)
            return sync.begin()

        let firstBlock = nextBlocks.first_block
        let lastBlock = nextBlocks.last_block
        let count = lastBlock - firstBlock + 1
        logger.info('Blocks to sync: ['+firstBlock+','+lastBlock+'], count:',count)
        if (count > MASSIVE_SYNC_THRESHOLD) {
            await context.detach()
            logger.info('Begin massive sync')
            sync.massive(firstBlock,Math.min(firstBlock+MASSIVE_SYNC_BATCH-1,Math.floor((firstBlock+MASSIVE_SYNC_BATCH-1)/MASSIVE_SYNC_BATCH)*MASSIVE_SYNC_BATCH,lastBlock),lastBlock)
        } else
            sync.live()
    },
    massive: async (firstBlock,lastBlock,targetBlock) => {
        if (sync.terminating) return
        await db.client.query('START TRANSACTION;')
        let ops = await db.client.query('SELECT * FROM halive_app.enum_op($1,$2);',[firstBlock,lastBlock])
        let count = 0
        for (let op in ops.rows) {
            let processed = await processor.process(ops.rows[op])
            if (processed)
                count++
        }
        await db.client.query('UPDATE halive_app.state SET last_processed_block=$1;',[lastBlock])
        await db.client.query('COMMIT;')
        logger.debug('Commited ['+firstBlock+','+lastBlock+'] successfully')
        logger.info('Massive Sync - Block #'+firstBlock+' to #'+lastBlock+' / '+targetBlock+' - '+count+' ops')
        if (lastBlock >= targetBlock)
            sync.postMassive()
        else
            sync.massive(lastBlock+1,Math.min(lastBlock+MASSIVE_SYNC_BATCH,targetBlock),targetBlock)
    },
    postMassive: async () => {
        logger.info('Begin post-massive sync')
    },
    live: async () => {

    },
}

export default sync