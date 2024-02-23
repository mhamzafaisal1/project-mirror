/** Get any process arguments as params */
const params = process.argv;

/** Import defaults */
const defaults = {
    'machines': require('./defaults/machines').machines,
    'items': require('./defaults/items').items
}

/** Declare server-level variables */
var state, config;
var inDev = false;

/** Load dependencies */
const assert = require('assert');
const util = require('util');

/** Declare the custom winston logger and create a blank instance */
const winston = require('./modules/logger');
var logger = new winston();

/** Handle run parameters */
params.forEach((param, i) => {
    switch (param) {
        case 'dev':
            inDev = true;
            config = require('./config/dev');
            logger.info('Running in dev');
            break;
        default:
            config = require('./config/default');
            break;
    }
});

/** Load MongoDB */
const { MongoClient } = require('mongodb');
const dbClient = new MongoClient(config.mongo.url);
const db = dbClient.db(config.mongo.db);

/** Load ChiTrac modules */
const collectionManager = require('./modules/collection-manager');
const cm = new collectionManager(db, logger);

/** Load xml2js an */
const xml = require('xml2js');
const builder = new xml.Builder({ renderOpts: { 'pretty': false }, explicitRoot: false });

/** Load Express and prep it for use */
const express = require('express');
const path = require('path');
const app = express();
const port = process.env.PORT || 9090;
const routes = require('./routes');
logger.info('here');

/** Catch uncaught exceptions/errors and log them */
process.on('uncaughtException', error => {
    logger.error(error.toString());
});
process.on('error', error => {
    logger.error(error.toString());
});

app.use(express.static(path.join(__dirname, 'ng/browser'))); // Point static path to dist
routes.init(app, __dirname, db);

app.listen(port, () => logger.info(`ChiTracAPI listening on port ${port}`));