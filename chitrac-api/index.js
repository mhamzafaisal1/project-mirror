/** Declare server-level variables */
var state, server = {};

/** Declare reqlib */
server.appRoot = require('app-root-path');
global.reqlib = require('app-root-path').require;

/** Load config */
const config = reqlib('/modules/parameterizer')(__dirname);
const db = reqlib('/modules/mongoConnector')(config);

/** Load Morgan for http logging */
const morgan = require('morgan');

/** Declare the custom winston logger and create a blank instance */
const winston = reqlib('/modules/logger');
const logger = new winston(config.mongoLog.url + '/' + config.mongoLog.db);

server.config = config;
server.db = db;
server.logger = logger;

server.defaults = {
    machine: reqlib('/defaults/machine').machine,
    item: reqlib('/defaults/item').item,
    operator: reqlib('/defaults/operator').operator,
    status: reqlib('/defaults/status').status,
    fault: reqlib('/defaults/fault').fault
}

const xmlParser = reqlib('/modules/xmlParser');
server.xmlParser = xmlParser;

/** Load ChiTrac modules */
const collectionManager = reqlib('/modules/collection-manager');
const cm = new collectionManager(db, logger);

/** Load Express and prep it for use */
const express = require('express');
const path = require('path');
const app = express();
const port = process.env.PORT || server.config.api.port;

const morganMiddleware = morgan(
    ':method :url :status :res[content-length] - :response-time ms',
    {
        stream: {
            // Configure Morgan to use our custom logger with the http severity
            write: (message) => logger.http(message.trim()),
        },
    }
);

app.use(morganMiddleware);

const routes = reqlib('/routes');
routes.init(app, server);

app.listen(port, () => logger.info(`ChiTracAPI Started and listening on port ${port}`));

/**** HACKY GROSS SECTION TO CLEAN UP */
async function initializeCollections() {
    logger.debug('Initializing machine collection...');
    await cm.createCollection('machine').then(() => {
        let collection = db.collection('machine');
        collection.insertMany(server.defaults.machine);
        logger.debug('Machine collection initialized!');
    }).catch((error) => {
        if (error.codeName == 'NamespaceExists') {
            logger.debug('Machine collection already initialized!');
        } else {
            logger.error(error.toString());
        }
    });

    logger.debug('Initializing item collection...');
    await cm.createCollection('item').then(() => {
        let collection = db.collection('item');
        collection.insertMany(server.defaults.item);
        logger.debug('Item collection initialized!');
    }).catch((error) => {
        if (error.codeName == 'NamespaceExists') {
            logger.debug('Item collection already initialized!');
        } else {
            logger.error(error.toString());
        }
    });

    logger.debug('Initializing fault collection...');
    await cm.createCollection('fault').then(() => {
        let collection = db.collection('fault');
        collection.insertMany(server.defaults.fault);
        logger.debug('Fault collection initialized!');
    }).catch((error) => {
        if (error.codeName == 'NamespaceExists') {
            logger.debug('Fault collection already initialized!');
        } else {
            logger.error(error.toString());
        }
    });

    logger.debug('Initializing status collection...');
    await cm.createCollection('status').then(() => {
        let collection = db.collection('status');
        collection.insertMany(server.defaults.status);
        logger.debug('Status collection initialized!');
    }).catch((error) => {
        if (error.codeName == 'NamespaceExists') {
            logger.debug('Status collection already initialized!');
        } else {
            logger.error(error.toString());
        }
    });

    logger.debug('Initializing operator collection...');
    await cm.createCollection('operator').then(() => {
        let collection = db.collection('operator');
        collection.insertMany(server.defaults.operator);
        logger.debug('Operators collection initialized!');
    }).catch((error) => {
        if (error.codeName == 'NamespaceExists') {
            logger.debug('Operators collection already initialized!');
        } else {
            logger.error(error.toString());
        }
    });
}

initializeCollections();