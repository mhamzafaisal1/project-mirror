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
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');

server.xmlParser = xmlParser;

/** Load ChiTrac modules */
const collectionManager = reqlib('/modules/collection-manager');
const cm = new collectionManager(db, logger);

/** Load Express and prep it for use */
const express = require('express');
const session = require('express-session');
const path = require('path');
const app = express();
const port = process.env.PORT || server.config.api.port;

//Passport
const passport = require('passport');

// pass passport for configuration
require('./configuration/passport')(passport, server);
server['passport'] = passport;

app.use(cookieParser());
app.use(bodyParser.json()); // get information from html forms
app.use(bodyParser.urlencoded({ extended: true }));

app.use(session({
    "secret": 'supersecretchitracsecret',
    "resave": true,
    "saveUninitialized": true
}));

app.use(passport.initialize());
app.use(passport.session());

//require and use connect-flash for flash messaging
const flash = require('connect-flash');
app.use(flash());

const allowCrossDomain = function(req, res, next) {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Length, X-Requested-With');

    // intercept OPTIONS method
    if ('OPTIONS' == req.method) {
        res.sendStatus(200);
        //console.log(res)
    } else {
        next();
    }
};

app.use(allowCrossDomain);

const morganMiddleware = morgan(':method :url :status :res[content-length] - :response-time ms',
    {
        stream: {
            // Configure Morgan to use our custom logger with the http severity
            write: (message) => logger.http(message.trim()),
        },
    });

/*** Load middleware */
app.use(morganMiddleware);
//app.use(express.json());

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
    }).catch(async (error) => {
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
    }).catch(async (error) => {
        if (error.codeName == 'NamespaceExists') {
            let cursor = db.collection('operator').find({});
            let found = await cursor.toArray();
            if (found.length) {
                logger.debug('Operator collection already initialized!');
            } else {
                logger.debug('Operator collection already exists but is empty!');
                db.collection('operator').insertMany(server.defaults.operator);
                logger.debug('Operator collection initialized!');
            }
        } else {
            logger.error(error.toString());
        }
    });
}

initializeCollections();