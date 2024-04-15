module.exports = function(db) {
    return constructor(db);
}

function constructor(db) {
    const winston = require('winston');
    require('winston-mongodb');
    require('winston-daily-rotate-file');
    const path = require('path');

    let exceptionFileTransport = new winston.transports.DailyRotateFile({
        filename: path.join('logs', '/%DATE%_exception.log'),
        level: 'error',
        zippedArchive: true,
        maxFiles: '365d'
    });
    let errorFileTransport = new winston.transports.DailyRotateFile({
        filename: path.join('logs', '/%DATE%_error.log'),
        level: 'error',
        zippedArchive: true,
        maxFiles: '365d'
    });
    let httpFileTransport = new winston.transports.DailyRotateFile({
        filename: path.join('logs', '/%DATE%_http.log'),
        level: 'http',
        zippedArchive: true,
        maxFiles: '60d'
    });

    const logger = winston.createLogger({
        format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
        transports: [errorFileTransport, httpFileTransport],
        exceptionHandlers: [errorFileTransport]
    });

    if (process.env.NODE_ENV !== 'production') {
        if (process.env.NODE_ENV === 'development') {
            logger.add(new winston.transports.Console({
                format: winston.format.combine(
                    winston.format.cli(),
                    winston.format.timestamp(),
                    winston.format.printf(info => `${info.timestamp} ${info.level}: ${info.message}`)
                ),
                level: 'silly'
            }));
        }
        logger.add(new winston.transports.DailyRotateFile({
            filename: path.join('logs', '/%DATE%_everything.log'),
            level: 'silly',
            zippedArchive: true,
            maxFiles: '3d'
        }));
    } else {
        if (db) {
            logger.exceptions.handle(new winston.transports.MongoDB({
                level: 'error',
                db: db,
                collection: 'api-error',
                options: { useUnifiedTopology: true },
                storeHost: true
            }));
            logger.add(new winston.transports.MongoDB({
                level: 'error',
                db: db,
                collection: 'api-error',
                options: { useUnifiedTopology: true },
                storeHost: true
            }));
            logger.add(new winston.transports.MongoDB({
                level: 'http',
                db: db,
                collection: 'api-http',
                options: { useUnifiedTopology: true },
                storeHost: true
            }));
        }
    }
    return logger;
}