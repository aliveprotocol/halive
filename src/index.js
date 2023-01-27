import db from './db.js'
import schema from './schema.js'

await db.init()
if (!(await schema.loaded()))
    await schema.setup()
await db.disconnect()