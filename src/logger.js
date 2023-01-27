import log4js from 'log4js'
import haliveConfig from './config.js'

log4js.configure({
    levels: {},
    appenders: {
        out: {
            type: 'stdout',
            layout: {
                type: 'pattern',
                pattern: '%[%d [%p]%] %m',
            }
        },
        file: {
            type: 'file',
            filename: './logs/output.log',
            maxLogSize: 10485760,
            backups: 3,
            compress: true
        }
    },
    categories: { 
        default: { 
            appenders: ['out', 'file'],
            level: haliveConfig.log_level
        }
    }
})

let logger = log4js.getLogger()
logger.info('Logger initialized')
export default logger