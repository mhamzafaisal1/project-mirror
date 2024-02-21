module.exports = function(db) {
    return constructor(db);
}

function constructor(db) {
    const winston = require('winston');
    //require('winston-mongodb');

    const logger = winston.createLogger({
        level: 'info',
        format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
        transports: [
            //
            // - Write to all logs with level `info` and below to `combined.log` 
            // - Write all logs error (and below) to `error.log`.
            //
            new winston.transports.File({ filename: './logs/error.log', level: 'error', handleExceptions: true }),
            new winston.transports.File({ filename: './logs/combined.log' })
        ]
    });

    //
    // If we're not in production then log to the `console` with the format:
    // `${info.level}: ${info.message} JSON.stringify({ ...rest }) `
    // 
    if (process.env.NODE_ENV !== 'production') {
        logger.add(new winston.transports.Console({
            format: winston.format.combine(
                winston.format.cli(),
                winston.format.timestamp(),
                winston.format.printf(info => `${info.timestamp} ${info.level}: ${info.message}`)
            ),
        }));
    }

    /*if (db) {
        logger.add(new winston.transports.MongoDB({
            'level': 'info',
            'db': db,
            'storeHost': true,
            'handleExceptions': true 
        }))
    }*/

    return logger;
}