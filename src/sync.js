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
        if (sync.terminating) return sync.close()

        // query next block
        let nextBlocks = await context.nextBlocks()
        if (nextBlocks.first_block === null) 
            return setTimeout(() => sync.begin(),1000)

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
        if (sync.terminating) return sync.close()
        let start = new Date().getTime()
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
        let timeTaken = (new Date().getTime()-start)/1000
        logger.debug('Commited ['+firstBlock+','+lastBlock+'] successfully')
        logger.info('Massive Sync - Block #'+firstBlock+' to #'+lastBlock+' / '+targetBlock+' - '+count+' ops - '+((lastBlock-firstBlock)/timeTaken).toFixed(3)+'b/s, '+(count/timeTaken).toFixed(3)+'op/s')
        if (lastBlock >= targetBlock)
            sync.postMassive(targetBlock)
        else
            sync.massive(lastBlock+1,Math.min(lastBlock+MASSIVE_SYNC_BATCH,targetBlock),targetBlock)
    },
    postMassive: async (lastBlock) => {
        logger.info('Begin post-massive sync')
        logger.info('Post-masstive sync complete, entering live sync')
        await context.attach(lastBlock)
        sync.live()
    },
    live: async () => {
        if (sync.terminating) return sync.close()

        // query next blocks
        let nextBlock = (await context.nextBlocks()).first_block
        if (nextBlock === null) 
            return setTimeout(() => sync.live(),500)

        let start = new Date().getTime()
        await db.client.query('START TRANSACTION;')
        let ops = await db.client.query('SELECT * FROM halive_app.enum_op($1,$2);',[nextBlock,nextBlock])
        let count = 0
        for (let op in ops.rows) {
            let processed = await processor.process(ops.rows[op])
            if (processed)
                count++
        }
        await db.client.query('UPDATE halive_app.state SET last_processed_block=$1;',[nextBlock])
        await db.client.query('COMMIT;')
        let timeTakenMs = new Date().getTime()-start
        logger.info('Alive - Block #'+nextBlock+' - '+count+' ops - '+timeTakenMs+'ms')
        sync.live()
    },
    close: async () => {
        await db.disconnect()
        process.exit(0)
    }
}

export default sync