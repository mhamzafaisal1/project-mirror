/** Declare server-level variables */
var state, config;
var db, dbCollections, cm;
var benchmarkStart, benchmarkEnd;

/** Declare the custom winston logger and create a blank instance */
const winston = require('./modules/logger');
var logger = new winston();


const params = process.argv;
var inDev = false;
var machineSingleDay = null;
var items = null;
var itemDetails = null;
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

const defaults = {
    'machines': require('./defaults/machines').machines,
    'items': require('./defaults/items').items
}

const assert = require('assert');
/*const equal = require('deep-equal');*/ //KEPT FOR POSTERITY
/*const diff = require('deep-diff');*/ //KEPT FOR POSTERITY
/*const joi = require('joi');*/ //KEPT FOR POSTERITY WHEN REMOVING JOI 02-16-24 RTI II
const moment = require('moment-timezone');
const sql = require('mssql');
const { MongoClient } = require('mongodb');
const util = require('util');
const xml = require('xml2js');
const builder = new xml.Builder({ renderOpts: { 'pretty': false }, explicitRoot: false });
const bodyParser = require('body-parser');
const collectionManager = require('./modules/collection-manager');

/** Load Express and prep it for use */
const express = require('express');
const path = require('path');
const app = express();
const port = process.env.PORT || 9090;

process.on('uncaughtException', error => {
    logger.error('' + error);
});

process.on('error', error => {
    console.log(error);
});

/** Load MySQL driver and create a connection*/
//const pool = new mssql.ConnectionPool(config.sql);
/* Create SQL Connection Pool and connect to SQL */
const sqlConnectionPool = new sql.ConnectionPool({
    user: config.sql.user,
    password: config.sql.password,
    server: config.sql.server,
    database: config.sql.database,
    port: config.sql.port,
    requestTimeout: config.sql.requestTimeout,
    pool: {
        max: 10,
        min: 0
    },
    options: { 'enableArithAbort': false, 'trustServerCertificate': true }
});
var sqlPoolConnection;

/** Load MongoDB */
var dbClient = new MongoClient(config.mongo.url);

/*const machineStateItemDetailSchema = joi.object().keys({
    'id': joi.number(),
    'count': joi.number(),
});*/ //KEPT FOR POSTERITY WHEN REMOVING JOI 02-16-24 RTI II

/*const machineStateSchema = joi.object().keys({
    'machineID': joi.number().required(),
    'serial': joi.number().required(),
    'machineType': joi.number().required(),
    'location': joi.number().required(),
    'line': joi.number().required(),
    'model': joi.number().required(),
    'timeInfo': joi.string(),
    'timestamp': joi.date().iso().required(),
    'ticker': joi.boolean(),
    'fault': joi.number().required(),
    'onTime': joi.number().required(),
    'runTime': joi.number().required(),
    'readyTime': joi.number().required(),
    'brokeTime': joi.number().required(),
    'emptyTime': joi.number().required(),
    'energyinfo': joi.string(),
    'electric': joi.number(),
    'pneumatic': joi.number(),
    'fuel': joi.number(),
    'fuelType': joi.number(),
    'programInfo': joi.string(),
    'programNumber': joi.number(),
    'batchNumber': joi.number(),
    'accountNumber': joi.number(),
    'speed': joi.number(),
    'stations': joi.number(),
    'operatorlp': joi.string(),
    'idcodelp1': joi.number(),
    'idcodelp2': joi.number(),
    'idcodelp3': joi.number(),
    'idcodelp4': joi.number(),
    'operatorsp': joi.string(),
    'idcodesp1': joi.number(),
    'idcodesp2': joi.number(),
    'idcodesp3': joi.number(),
    'idcodesp4': joi.number(),
    'idcodesp5': joi.number(),
    'idcodesp6': joi.number(),
    'idcodesp7': joi.number(),
    'idcodesp8': joi.number(),
    'totals': joi.string(),
    'onelane': joi.number(),
    'twolane': joi.number(),
    'sp': joi.number(),
    'drape': joi.number(),
    'items': joi.array().items(machineStateItemDetailSchema),
    'item1id': joi.number(),
    'item1count': joi.number(),
    'item2id': joi.number(),
    'item2count': joi.number(),
    'item3id': joi.number(),
    'item3count': joi.number(),
    'item4id': joi.number(),
    'item4count': joi.number(),
    'item5id': joi.number(),
    'item5count': joi.number(),
    'item6id': joi.number(),
    'item6count': joi.number(),
    'item7id': joi.number(),
    'item7count': joi.number(),
    'item8id': joi.number(),
    'item8count': joi.number(),
    'rejects': joi.string(),
    'stain': joi.number(),
    'tear': joi.number(),
    'shape': joi.number(),
    'lowQuality': joi.number(),
    'fCount1': joi.string(),
    'fiCount1': joi.number(),
    'foCount1': joi.number(),
    'fmCount1': joi.number(),
    'fCount2': joi.string(),
    'fiCount2': joi.number(),
    'foCount2': joi.number(),
    'fmCount2': joi.number(),
    'fCount3': joi.string(),
    'fiCount3': joi.number(),
    'foCount3': joi.number(),
    'fmCount3': joi.number(),
    'fCount4': joi.string(),
    'fiCount4': joi.number(),
    'foCount4': joi.number(),
    'fmCount4': joi.number(),
    'lCount1': joi.string(),
    'liCount1': joi.number(),
    'lpCount1': joi.number(),
    'xiCount1': joi.number(),
    'xoCount1': joi.number(),
    'soCount1': joi.number(),
    'lCount2': joi.string(),
    'liCount2': joi.number(),
    'lpCount2': joi.number(),
    'xiCount2': joi.number(),
    'xoCount2': joi.number(),
    'soCount2': joi.number(),
    'lCount3': joi.string(),
    'liCount3': joi.number(),
    'lpCount3': joi.number(),
    'xiCount3': joi.number(),
    'xoCount3': joi.number(),
    'soCount3': joi.number(),
    'sCount1': joi.string(),
    'siCount1': joi.number(),
    'spCount1': joi.number(),
    'saCount1': joi.number(),
    'sCount2': joi.string(),
    'siCount2': joi.number(),
    'spCount2': joi.number(),
    'saCount2': joi.number(),
    'sCount3': joi.string(),
    'siCount3': joi.number(),
    'spCount3': joi.number(),
    'saCount3': joi.number(),
    'sCount4': joi.string(),
    'siCount4': joi.number(),
    'spCount4': joi.number(),
    'saCount4': joi.number(),
    'sCount5': joi.string(),
    'siCount5': joi.number(),
    'spCount5': joi.number(),
    'saCount5': joi.number(),
    'sCount6': joi.string(),
    'siCount6': joi.number(),
    'spCount6': joi.number(),
    'saCount6': joi.number(),
    'sCount7': joi.string(),
    'siCount7': joi.number(),
    'spCount7': joi.number(),
    'saCount7': joi.number(),
    'sCount8': joi.string(),
    'siCount8': joi.number(),
    'spCount8': joi.number(),
    'saCount8': joi.number(),
    'worked': joi.number(),
});*/ //KEPT FOR POSTERITY WHEN REMOVING JOI 02-16-24 RTI II


var viewsToCreate = ['aggDay', /* 'aggWeek', 'aggMonth',*/ 'aggYear'];
var viewDateRanges = [{
        'startDate': getMoment().tz('America/Chicago').startOf('day').format(),
        'endDate': getMoment().tz('America/Chicago').startOf('day').add(1, 'days').format()
    },
    /*
        {
            'startDate': getMoment().tz('America/Chicago').startOf('day').subtract(1, 'weeks').format(),
            'endDate': getMoment().tz('America/Chicago').startOf('day').format()
        },
        {
            'startDate': getMoment().tz('America/Chicago').startOf('day').subtract(1, 'months').format(),
            'endDate': getMoment().tz('America/Chicago').startOf('day').format()
        },*/
    {
        'startDate': getMoment().tz('America/Chicago').startOf('day').subtract(1, 'years').format(),
        'endDate': getMoment().tz('America/Chicago').startOf('day').subtract(1, 'second').format()
    }
];

var staticCollections = {};
var topRecordMongoOperatorData;

/* Takes a MongoClient instance and a callback, and connects to the DB */
function connectMongo(mongoClient, callback) {
    return callback(null, mongoClient);
    /*mongoClient.connect((err) => {
        console.log('here');
        if (err) return logger.error({ message: err });
        else logger.info('Connected to Mongo @ ' + config.mongo.url);
        
    });*/
}

function getMoment() {
    if (inDev) {
        let today = moment(config.date + 'T' + moment().format('HH:mm:ssZZ'));
        return today;
    } else {
        return moment();
    }
}

function connectDB(client, name) {
    return client.db(name);
}

function connectSQL(callback) {
    sqlConnectionPool.connect().then((pool) => {
        sqlPoolConnection = pool;
        if (callback) return callback(null);
    });

    /*mssql.connect((err) => {
        if (err) throw err;
        console.log("Connected to SQL!");
        if (callback) return callback(null);
    });*/
}

function getLatestSQLRow(callback) {
    let selectString = "SELECT TOP (1) [ID] ,[SerialNumb] ,[MachineType] ,[AreaLocation] ,[Line] ,[Model] ,[TimeStamp] ,[DateStamp] ,[MachineOn] ,[MachineRun] ,[MachineReady] ,[Broke] ,[Empty] ,[Fault] ,[Electric] ,[Pneumatic] ,[Fuel] ,[FuelType] ,[ProgramNumber] ,[BatchNumber] ,[AccountNumber] ,[Speed] ,[Stations] ,[OneLane] ,[TwoLane] ,[SP] ,[Drape] ,[IDCodeLP1] ,[IDCodeLP2] ,[IDCodeLP3] ,[IDCodeLP4] ,[IDCodeSP1] ,[IDCodeSP2] ,[IDCodeSP3] ,[IDCodeSP4] ,[IDCodeSP5] ,[IDCodeSP6] ,[IDCodeSP7] ,[IDCodeSP8] ,[ItemID1] ,[ItemCount1] ,[ItemID2] ,[ItemCount2] ,[ItemID3] ,[ItemCount3] ,[ItemID4] ,[ItemCount4] ,[ItemID5] ,[ItemCount5] ,[ItemID6] ,[ItemCount6] ,[ItemID7] ,[ItemCount7] ,[ItemID8] ,[ItemCount8] ,[Stain] ,[Tear] ,[Shape] ,[LowQuality] ,[FiCount1] ,[FoCount1] ,[FmCount1] ,[FiCount2] ,[FoCount2] ,[FmCount2] ,[FiCount3] ,[FoCount3] ,[FmCount3] ,[FoCount4] ,[FiCount4] ,[FmCount4] ,[LiCount1] ,[LpCount1] ,[XiCount1] ,[XoCount1] ,[SoCount1] ,[LiCount2] ,[LpCount2] ,[XiCount2] ,[XoCount2] ,[SoCount2] ,[LiCount3] ,[LpCount3] ,[XiCount3] ,[XoCount3] ,[SoCount3] ,[SiCount1] ,[SpCount1] ,[SaCount1] ,[SiCount2] ,[SpCount2] ,[SaCount2] ,[SiCount3] ,[SpCount3] ,[SaCount3] ,[SiCount4] ,[SpCount4] ,[SaCount4] ,[SiCount5] ,[SpCount5] ,[SaCount5] ,[SiCount6] ,[SpCount6] ,[SaCount6] ,[SiCount7] ,[SpCount7] ,[SaCount7] ,[SiCount8] ,[SpCount8] ,[SaCount8] ,[PlaceHolder1] ,[Worked] FROM [ChiTrac].[dbo].[Operator_Data] ORDER BY [ID] DESC";
    sqlConnectionPool.query(selectString, (err, results) => {
        if (err) throw err;
        if (callback) return callback(null, results);
    });
}



function promiseLastRecordMongo(collectionName) {
    let collection = db.collection(collectionName);
    return collection.find().limit(1).sort({ timestamp: -1 }).toArray();
}

function getLastRecordMomentOperatorData(callback) {
    /*if (topRecordMongoOperatorData) {
        return callback(null, topRecordMongoOperatorData);
    } else {*/
    promiseLastRecordMongo('operatorData').then((recordSet) => {
        if (recordSet.length && recordSet[0].timestamp) {
            console.log(recordSet[0]);
            return callback(null, setLastRecordMomentOperatorData(recordSet[0].timestamp));
        } else {
            return callback(0);
        }
    });
    //}
}

function getCurrentMachineStatus(serial, callback) {
    promiseTickerMongo(serial).then((recordSet) => {
        if (recordSet.length) {
            return callback(null, )
        }
    })
}

function setLastRecordMomentOperatorData(timestamp) {
    return topRecordMongoOperatorData = moment(timestamp);
}

function promiseDeleteMostRecentHourMongo(collectionName, lastRecordTimestamp) {
    let queryStartTime = moment(lastRecordTimestamp).startOf('hour').format();
    let collection = db.collection(collectionName);
    return collection.deleteMany({ 'timestamp': { $gte: new Date(queryStartTime) } });
}

function promiseTickerMongo(serial) {
    let collection = db.collection('ticker');
    return collection.find({ 'machine.serial': serial }).toArray();
}

function promiseFCountMongo() {
    let collection = db.collection('operatorData');
    return collection.aggregate([{
        '$match': {
            'timestamp': {
                '$gte': new Date('2017-11-21')
            }
        }
    }, {
        '$addFields': {
            'FCount': {
                '$sum': [
                    '$fiCount1', '$fiCount2', '$fiCount3', '$fiCount4', '$siCount1', '$siCount2', '$siCount3', '$siCount4', '$siCount5', '$siCount6', '$siCount7', '$siCount8'
                ]
            }
        }
    }, {
        '$group': {
            '_id': '$batchNumber',
            'FCounts': {
                '$sum': '$FCount'
            }
        }
    }]).toArray();
}

function promiseQuery18SinceDate(startDate, collectionName) {
    let collection = db.collection(collectionName);
    return collection.aggregate([{
        '$match': {
            'timestamp': {
                '$gte': new Date(startDate)
            }
        }
    }, {
        '$group': {
            '_id': {
                'item': '$Item',
                'Pace': '$Pace'
            },
            'FCount': {
                '$sum': '$FCount'
            },
            'Count': {
                '$sum': '$Count'
            },
            'RunTime': {
                '$sum': '$runTime'
            }
        }
    }, {
        '$replaceRoot': {
            'newRoot': {
                '$mergeObjects': [
                    '$_id', '$$ROOT'
                ]
            }
        }
    }, {
        '$project': {
            '_id': 0,
            'ItemName': '$_id.item',
            'Run': {
                '$divide': [
                    '$RunTime', 60
                ]
            },
            'RunTime': '$RunTime',
            'Standard': {
                '$sum': [
                    '$_id.Pace', 0
                ]
            },
            'FCount': '$FCount',
            'Count': '$Count',
            'PPH': {
                '$divide': [
                    '$FCount', {
                        '$divide': [
                            '$RunTime', 3600
                        ]
                    }
                ]
            },
            'Thruput': {
                '$multiply': [{
                    '$cond': {
                        'if': { '$ne': ['$FCount', 0] },
                        'then': { '$divide': ['$Count', '$FCount'] },
                        'else': 0
                    }
                }, 100]
            },
            'PercentOfTarget': {
                '$multiply': [{
                    '$divide': [{
                        '$divide': [
                            '$FCount', {
                                '$divide': [
                                    '$RunTime', 3600
                                ]
                            }
                        ]
                    }, '$_id.Pace']
                }, 100]
            }
        }
    }]).toArray();
}

function promiseItemGridAgg(startDate, endDate, collectionName) {
    let collection = db.collection(collectionName);
    return collection.aggregate([{
        '$match': {
            'timestamp': {
                '$gte': new Date(startDate),
                '$lt': new Date(endDate)
            }
        }
    }, {
        '$group': {
            '_id': {
                'item': '$Item',
                'Pace': '$Pace'
            },
            'FCount': {
                '$sum': '$FCount'
            },
            'Count': {
                '$sum': '$Count'
            },
            'RunTime': {
                '$sum': '$runTime'
            }
        }
    }, {
        '$replaceRoot': {
            'newRoot': {
                '$mergeObjects': [
                    '$_id', '$$ROOT'
                ]
            }
        }
    }, {
        '$project': {
            '_id': 0,
            'ItemName': '$_id.item',
            'Run': {
                '$divide': [
                    '$RunTime', 60
                ]
            },
            'RunTime': '$RunTime',
            'Standard': {
                '$sum': [
                    '$_id.Pace', 0
                ]
            },
            'FCount': '$FCount',
            'Count': '$Count',
            'PPH': {
                '$divide': [
                    '$FCount', {
                        '$divide': [
                            '$RunTime', 3600
                        ]
                    }
                ]
            },
            'Thruput': {
                '$multiply': [{
                    '$cond': {
                        'if': { '$ne': ['$FCount', 0] },
                        'then': { '$divide': ['$Count', '$FCount'] },
                        'else': 0
                    }
                }, 100]
            },
            'PercentOfTarget': {
                '$multiply': [{
                    '$divide': [{
                        '$divide': [
                            '$FCount', {
                                '$divide': [
                                    '$RunTime', 3600
                                ]
                            }
                        ]
                    }, '$_id.Pace']
                }, 100]
            }
        }
    }, {
        '$sort': {
            'ItemName': 1
        }
    }]).toArray();
}

function promiseItemDetailsAgg(startDate, endDate, collectionName) {
    let collection = db.collection(collectionName);
    return collection.aggregate([{
        '$match': {
            'timestamp': {
                '$gte': new Date(startDate),
                '$lt': new Date(endDate)
            }
        }
    }, {
        '$project': {
            '_id': 0,
            'items': 1
        }
    }, {
        '$unwind': {
            'path': '$items',
            'preserveNullAndEmptyArrays': false
        }
    }, {
        '$group': {
            '_id': '$items.id',
            'Total': {
                '$sum': '$items.count'
            }
        }
    }, {
        '$lookup': {
            'from': 'items',
            'localField': '_id',
            'foreignField': 'number',
            'as': 'ItemDetails'
        }
    }, {
        '$replaceRoot': {
            'newRoot': {
                '$mergeObjects': [{
                    '$arrayElemAt': [
                        '$ItemDetails', 0
                    ]
                }, '$$ROOT']
            }
        }
    }, {
        '$project': {
            '_id': 0,
            'Item': 1,
            'Total': 1
        }
    }, {
        '$match': {
            '_id': { $ne: 0 },
            'Item': { $exists: 1 }
        }
    }, {
        '$sort': {
            'Item': 1
        }
    }, {
        '$project': {
            'item': '$Item',
            'total': '$Total'
        }
    }]).toArray();
}

function promiseOperatorDataSinceDate(startDate) {
    let collection = db.collection('operatorData');
    return collection.aggregate([{
        '$match': {
            'timestamp': {
                '$gte': new Date(startDate)
            }
        }
    }, {
        '$lookup': {
            'from': 'items',
            'localField': 'batchNumber',
            'foreignField': 'number',
            'as': 'itemDetails'
        }
    }, {
        '$replaceRoot': {
            'newRoot': {
                '$mergeObjects': [{
                    '$arrayElemAt': [
                        '$itemDetails', 0
                    ]
                }, '$$ROOT']
            }
        }
    }, {
        '$addFields': {
            'FCount': {
                '$sum': [
                    '$fiCount1', '$fiCount2', '$fiCount3', '$fiCount4', '$siCount1', '$siCount2', '$siCount3', '$siCount4', '$siCount5', '$siCount6', '$siCount7', '$siCount8'
                ]
            },
            'Count': {
                '$sum': [
                    '$onelane', '$twolane', '$drape', '$sp'
                ]
            }
        }
    }, {
        '$group': {
            '_id': {
                'item': '$Item',
                'Pace': '$Pace'
            },
            'FCount': {
                '$sum': '$FCount'
            },
            'Count': {
                '$sum': '$Count'
            },
            'RunTime': {
                '$sum': '$runTime'
            }
        }
    }, {
        '$replaceRoot': {
            'newRoot': {
                '$mergeObjects': [
                    '$_id', '$$ROOT'
                ]
            }
        }
    }, {
        '$project': {
            'Run': {
                '$divide': [
                    '$RunTime', 60
                ]
            },
            'RunTime': '$RunTime',
            'Standard': {
                '$sum': [
                    '$_id.Pace', 0
                ]
            },
            'FCount': '$FCount',
            'Count': '$Count',
            'PPH': {
                '$divide': [
                    '$FCount', {
                        '$divide': [
                            '$RunTime', 3600
                        ]
                    }
                ]
            },
            'Thruput': {
                '$multiply': [{
                    '$cond': {
                        'if': { '$ne': ['$FCount', 0] },
                        'then': { '$divide': ['$Count', '$FCount'] },
                        'else': 0
                    }
                }, 100]
            },
            'PercentOfTarget': {
                '$multiply': [{
                    '$divide': [{
                        '$divide': [
                            '$FCount', {
                                '$divide': [
                                    '$RunTime', 3600
                                ]
                            }
                        ]
                    }, '$_id.Pace']
                }, 100]
            }
        }
    }]).toArray();
}

function sqlQuery18SinceDate(startDate, callback) {
    var selectString = "SELECT i.Item, Sum([FCount]) AS FCount, Sum([Count]) AS Count,  ROUND(CAST(Sum(Run) AS DECIMAL(10,2))/60,2) AS Run, (SELECT (Pace/60) from Items WHERE Items.Item = i.Item) * 60 AS Standard, ROUND(CAST(Sum(FCount) AS DECIMAL(10,2))/CAST(Sum(Run)+1 AS DECIMAL(10,2)) *60*60,2) AS PPH, ROUND(CAST(Sum(Count) AS DECIMAL(10,2))/ CAST(Sum(FCount)+1 AS DECIMAL(10,2)),2)*100 as Thruput, CAST((ROUND((SUM(CAST(FCount AS DECIMAL(10,2))))/(SUM(CAST(Run AS DECIMAL(10,2)))+1) * 60/(Select (Pace/60) from Items where Item = i.Item), 2,2) * 100) AS INT) AS PercentOfTarget, q.BatchNumber AS BatchNumber FROM Query18 q INNER JOIN Items i ON q.BatchNumber = i.ItemNumb WHERE (q.Date >= CONVERT(DATE, '" + startDate + "') ) Group By i.Item, q.BatchNumber ORDER BY i.Item";
    sqlConnectionPool.query(selectString, (err, results) => {
        return callback(err, results);
    })
}

function promiseViewQuery16() {
    let collection = db.collection('operatorData');
    return db.createCollection('query16', {
        viewOn: 'operatorData',
        pipeline: [{
            '$match': {
                'timestamp': {
                    '$gte': new Date('2018-10-20T00:00:00-06:00')
                }
            }
        }, {
            '$lookup': {
                'from': 'items',
                'localField': 'batchNumber',
                'foreignField': 'number',
                'as': 'itemDetails'
            }
        }, {
            '$lookup': {
                'from': 'machines',
                'localField': 'serial',
                'foreignField': 'SerialNumb',
                'as': 'machineDetails'
            }
        }, {
            '$lookup': {
                'from': 'operators',
                'localField': 'idcodelp1',
                'foreignField': 'id',
                'as': 'operatorDetails'
            }
        }, {
            '$lookup': {
                'from': 'faults',
                'localField': 'fault',
                'foreignField': 'code',
                'as': 'faultDetails'
            }
        }, {
            '$replaceRoot': {
                'newRoot': {
                    '$mergeObjects': [{
                        '$arrayElemAt': [
                            '$operatorDetails', 0
                        ]
                    }, {
                        '$arrayElemAt': [
                            '$machineDetails', 0
                        ]
                    }, {
                        '$arrayElemAt': [
                            '$itemDetails', 0
                        ]
                    }, {
                        '$arrayElemAt': [
                            '$faultDetails', 0
                        ]
                    }, '$$ROOT']
                }
            }
        }, {
            '$addFields': {
                'FCount': {
                    '$sum': [
                        '$fiCount1', '$fiCount2', '$fiCount3', '$fiCount4', '$siCount1', '$siCount2', '$siCount3', '$siCount4', '$siCount5', '$siCount6', '$siCount7', '$siCount8'
                    ]
                },
                'Count': {
                    '$sum': [
                        '$onelane', '$twolane', '$drape', '$sp'
                    ]
                }
            }
        }]
    });
}

function promiseMonthAgg() {
    let collection = db.collection('operatorData');
    return collection.aggregate([{
        '$match': {
            'timestamp': {
                '$gte': new Date('2018-10-20T00:00:00-05:00')
            }
        }
    }, {
        '$lookup': {
            'from': 'items',
            'localField': 'batchNumber',
            'foreignField': 'number',
            'as': 'itemDetails'
        }
    }, {
        '$lookup': {
            'from': 'machines',
            'localField': 'serial',
            'foreignField': 'SerialNumb',
            'as': 'machineDetails'
        }
    }, {
        '$lookup': {
            'from': 'operators',
            'localField': 'idcodelp1',
            'foreignField': 'id',
            'as': 'operatorDetails'
        }
    }, {
        '$lookup': {
            'from': 'faults',
            'localField': 'fault',
            'foreignField': 'code',
            'as': 'faultDetails'
        }
    }, {
        '$replaceRoot': {
            'newRoot': {
                '$mergeObjects': [{
                    '$arrayElemAt': [
                        '$operatorDetails', 0
                    ]
                }, {
                    '$arrayElemAt': [
                        '$machineDetails', 0
                    ]
                }, {
                    '$arrayElemAt': [
                        '$itemDetails', 0
                    ]
                }, {
                    '$arrayElemAt': [
                        '$faultDetails', 0
                    ]
                }, '$$ROOT']
            }
        }
    }, {
        '$addFields': {
            'FCount': {
                '$sum': [
                    '$fiCount1', '$fiCount2', '$fiCount3', '$fiCount4', '$siCount1', '$siCount2', '$siCount3', '$siCount4', '$siCount5', '$siCount6', '$siCount7', '$siCount8'
                ]
            },
            'Count': {
                '$sum': [
                    '$onelane', '$twolane', '$drape', '$sp'
                ]
            }
        }
    }, {
        '$out': 'aggMonth'
    }]).toArray();
}

function promiseCreateView(startDate, endDate, viewToCreate) {
    let collection = db.collection('operatorData');
    let pipeline = [{
        '$match': {
            'timestamp': {
                '$gte': new Date(startDate),
                '$lt': new Date(endDate),
            }
        }
    }, {
        '$lookup': {
            'from': 'items',
            'localField': 'batchNumber',
            'foreignField': 'number',
            'as': 'itemDetails'
        }
    }, {
        '$lookup': {
            'from': 'machines',
            'localField': 'serial',
            'foreignField': 'SerialNumb',
            'as': 'machineDetails'
        }
    }, {
        '$lookup': {
            'from': 'operators',
            'localField': 'idcodelp1',
            'foreignField': 'id',
            'as': 'operatorDetails'
        }
    }, {
        '$lookup': {
            'from': 'faults',
            'localField': 'fault',
            'foreignField': 'code',
            'as': 'faultDetails'
        }
    }, {
        '$replaceRoot': {
            'newRoot': {
                '$mergeObjects': [{
                    '$arrayElemAt': [
                        '$operatorDetails', 0
                    ]
                }, {
                    '$arrayElemAt': [
                        '$machineDetails', 0
                    ]
                }, {
                    '$arrayElemAt': [
                        '$itemDetails', 0
                    ]
                }, {
                    '$arrayElemAt': [
                        '$faultDetails', 0
                    ]
                }, '$$ROOT']
            }
        }
    }, {
        '$addFields': {
            'FCount': {
                '$sum': [
                    '$fiCount1', '$fiCount2', '$fiCount3', '$fiCount4', '$siCount1', '$siCount2', '$siCount3', '$siCount4', '$siCount5', '$siCount6', '$siCount7', '$siCount8'
                ]
            },
            'FiCount': {
                '$sum': [
                    '$fiCount1', '$fiCount2', '$fiCount3', '$fiCount4'
                ]
            },
            'FoCount': {
                '$sum': [
                    '$foCount1', '$foCount2', '$foCount3', '$foCount4'
                ]
            },
            'FmCount': {
                '$sum': [
                    '$fmCount1', '$fmCount2', '$fmCount3', '$fmCount4'
                ]
            },
            'Count': {
                '$sum': [
                    '$onelane', '$twolane', '$drape', '$sp'
                ]
            },
            'InCount': {
                '$sum': [
                    '$fiCount1', '$fiCount2', '$fiCount3', '$fiCount4', '$siCount1', '$siCount2', '$siCount3', '$siCount4', '$siCount5', '$siCount6', '$siCount7', '$siCount8'
                ]
            },
            'ICount': {
                '$sum': [
                    '$liCount1', '$liCount2', '$liCount3', '$siCount1', '$siCount2', '$siCount3', '$siCount4', '$siCount5', '$siCount6', '$siCount7', '$siCount8'
                ]
            }
        }
    }, {
        '$project': {
            'faultDetails': 0,
            'operatorDetails': 0,
            'itemDetails': 0,
            'machineDetails': 0
        }
    }, {
        '$out': viewToCreate
    }];
    return collection.aggregate(pipeline).maxTimeMS(5 * 60 * 1000).toArray();
}

function promiseTickerAgg() {
    let collection = db.collection('tickerTable');
    return collection.aggregate([{
        '$lookup': {
            'from': 'items',
            'localField': 'batchNumber',
            'foreignField': 'number',
            'as': 'itemDetails'
        }
    }, {
        '$lookup': {
            'from': 'machines',
            'localField': 'serial',
            'foreignField': 'SerialNumb',
            'as': 'machineDetails'
        }
    }, {
        '$lookup': {
            'from': 'operators',
            'localField': 'idcodelp1',
            'foreignField': 'id',
            'as': 'operatorDetails'
        }
    }, {
        '$lookup': {
            'from': 'faults',
            'localField': 'fault',
            'foreignField': 'code',
            'as': 'faultDetails'
        }
    }, {
        '$replaceRoot': {
            'newRoot': {
                '$mergeObjects': [{
                    '$arrayElemAt': [
                        '$operatorDetails', 0
                    ]
                }, {
                    '$arrayElemAt': [
                        '$machineDetails', 0
                    ]
                }, {
                    '$arrayElemAt': [
                        '$itemDetails', 0
                    ]
                }, {
                    '$arrayElemAt': [
                        '$faultDetails', 0
                    ]
                }, '$$ROOT']
            }
        }
    }, {
        '$addFields': {
            'FCount': {
                '$sum': [
                    '$fiCount1', '$fiCount2', '$fiCount3', '$fiCount4', '$siCount1', '$siCount2', '$siCount3', '$siCount4', '$siCount5', '$siCount6', '$siCount7', '$siCount8'
                ]
            },
            'Count': {
                '$sum': [
                    '$onelane', '$twolane', '$drape', '$sp'
                ]
            },
        }
    }]).toArray();
}

function cursorTickerAgg(serialNumber) {
    let collection = db.collection('ticker');
    let pipeline = [{
        '$match': {
            'machine.serial': serialNumber
        }
    }, {
        '$lookup': {
            'from': 'machines',
            'localField': 'machine.serial',
            'foreignField': 'SerialNumb',
            'as': 'machineInfo'
        }
    }, {
        '$lookup': {
            'from': 'items',
            'localField': 'items.id',
            'foreignField': 'number',
            'as': 'itemInfo'
        }
    }, {
        '$lookup': {
            'from': 'operators',
            'localField': 'lpOperators.id',
            'foreignField': 'id',
            'as': 'lpOperatorInfo'
        }
    }, {
        '$lookup': {
            'from': 'operators',
            'localField': 'spOperators.id',
            'foreignField': 'id',
            'as': 'spOperatorInfo'
        }
    }, {
        '$lookup': {
            'from': 'faults',
            'localField': 'status',
            'foreignField': 'code',
            'as': 'statusInfo'
        }
    }, {
        '$replaceRoot': {
            'newRoot': {
                '$mergeObjects': [{
                    '$arrayElemAt': [
                        '$machineInfo', 0
                    ]
                }, '$$ROOT']
            }
        }
    }, {
        '$project': {
            'machineInfo': 0,
            'itemInfo': {
                '_id': 0
            },
            'lpOperatorInfo': {
                '_id': 0
            },
            'spOperatorInfo': {
                '_id': 0
            },
            'statusInfo': {
                '_id': 0
            }
        }
    }]
    return collection.aggregate(pipeline);
}

function cursorOperatorEfficiency(startDate, serialNumber, lane) {
    let collection = db.collection('operatorRealtime');
    let pipeline = [{
        '$match': {
            'machine.serial': parseInt(serialNumber),
            'timestamp': {
                '$gte': startDate
            }
        }
    }, {
        '$project': {
            'items': 1,
            'onTime': '$timers.onTime',
            'runTime': '$timers.runTime'
        }
    }, {
        '$unwind': {
            'path': '$items',
            'includeArrayIndex': 'itemIndex'
        }
    }, {
        '$match': {
            'itemIndex': (parseInt(lane) - 1)
        }

    }, {
        '$group': {
            '_id': '$itemIndex',
            'onTime': {
                '$sum': '$onTime'
            },
            'runTime': {
                '$sum': '$runTime'
            },
            'itemID': {
                '$last': '$items.id'
            },
            'itemCount': {
                '$sum': {
                    '$sum': '$items.count'
                }
            }
        }
    }, {
        '$lookup': {
            'from': 'items',
            'localField': 'itemID',
            'foreignField': 'number',
            'as': 'itemInfo'
        }
    }, {
        '$replaceRoot': {
            'newRoot': {
                '$mergeObjects': [{
                    '$arrayElemAt': [
                        '$itemInfo', 0
                    ]
                }, '$$ROOT']
            }
        }
    }, {
        '$project': {
            'lane': {
                '$sum': [
                    '$_id', 1
                ]
            },
            'id': '$itemID',
            'count': '$itemCount',
            'pace': '$Pace',
            'onTime': '$onTime',
            'runTime': '$runTime'
        }
    }];
    return collection.aggregate(pipeline);
}

function cursorMachinesQuery(startDate, endDate, collectionName) {
    let collection = db.collection(collectionName);
    let pipeline = [{
        '$match': {
            'timestamp': {
                '$gte': new Date(startDate),
                '$lt': new Date(endDate)
            }
        }
    }, {
        '$group': {
            '_id': {
                'MachineName': '$MachineName',
                'serial': '$serial',
                'Pace': '$Pace',
                'Lanes': '$Lanes'
            },
            'Run': {
                '$sum': '$Run'
            },
            'OnTime': {
                '$sum': '$onTime'
            },
            'ReadyTime': {
                '$sum': '$readyTime'
            },
            'RunTime': {
                '$sum': '$runTime'
            },
            'Worked': {
                '$sum': '$worked'
            },
            'Count': {
                '$sum': '$Count'
            },
            'FCount': {
                '$sum': '$FCount'
            },
            'ICount': {
                '$sum': '$ICount'
            },
            'InCount': {
                '$sum': '$InCount'
            },
            'JCount': {
                '$sum': '$JCount'
            }
        }
    }, {
        '$project': {
            '_id': 0,
            'MachineName': '$_id.MachineName',
            'Pace': '$_id.Pace',
            'Serial': '$_id.serial',
            'Run': {
                '$divide': [
                    '$RunTime', 60
                ]
            },
            'OnTime': '$OnTime',
            'ReadyTime': '$ReadyTime',
            'RunTime': '$RunTime',
            'Standard': {
                '$sum': [
                    '$_id.Pace', 0
                ]
            },
            'FCount': '$FCount',
            'Count': '$Count',
            'JCount': '$JCount',
            'ICount': '$ICount',
            'InCount': '$InCount',
            'Worked': '$Worked',
            'PerformanceNumerator': {
                '$divide': [{
                    '$multiply': [{
                        '$divide': [
                            60, {
                                '$divide': [
                                    '$_id.Pace', 60
                                ]
                            }
                        ]
                    }, '$FCount']
                }, '$_id.Lanes']
            }
        }
    }, {
        '$group': {
            '_id': {
                'MachineName': '$MachineName',
                'Serial': '$Serial',
                'Pace': '$Pace'
            },
            'OnTime': {
                '$sum': '$OnTime'
            },
            'Run': {
                '$sum': '$Run'
            },
            'OnTime': {
                '$sum': '$OnTime'
            },
            'ReadyTime': {
                '$sum': '$ReadyTime'
            },
            'RunTime': {
                '$sum': '$RunTime'
            },
            'Count': {
                '$sum': '$Count'
            },
            'FCount': {
                '$sum': '$FCount'
            },
            'ICount': {
                '$sum': '$ICount'
            },
            'InCount': {
                '$sum': '$InCount'
            },
            'JCount': {
                '$sum': '$JCount'
            },
            'Worked': {
                '$sum': '$Worked'
            },
            'PerformanceNumerator': {
                '$sum': '$PerformanceNumerator'
            }
        }
    }, {
        '$project': {
            '_id': 0,
            'MachineName': '$_id.MachineName',
            'Serial': '$_id.Serial',
            'OnTime': '$OnTime',
            'ReadyTime': '$ReadyTime',
            'RunTime': '$RunTime',
            'Count': '$Count',
            'FCount': '$FCount',
            'Worked': '$Worked',
            'PerformanceNumerator': '$PerformanceNumerator'
        }
    }];
    return collection.aggregate(pipeline);
}

function cursorMachinesDowntime(startDate, endDate, collectionName) {
    let collection = db.collection(collectionName);
    let pipeline = [{
        '$match': {
            'timestamp': {
                '$gte': new Date(startDate),
                '$lt': new Date(endDate)
            },
            'FaultName': {
                '$nin': [
                    'Run', 'Timeout', 'Stop', 'Waiting', 'Feeder Pause', 'Pause @Feeder'
                ]
            }
        }
    }, {
        '$group': {
            '_id': '$MachineName',
            'Downtime': {
                '$sum': '$onTime'
            }
        }
    }];
    return collection.aggregate(pipeline);
}

function cursorMachineDetailItem(startDate, endDate, collectionName, machineName) {
    let collection = db.collection(collectionName);
    let pipeline = [{
        '$match': {
            'timestamp': {
                '$gte': new Date(startDate),
                '$lt': new Date(endDate)
            },
            'MachineName': machineName
        }
    }, {
        '$group': {
            '_id': {
                'Item': '$Item',
                'Pace': '$Pace',
                'Lanes': '$Lanes'
            },
            'FCount': {
                '$sum': '$FCount'
            },
            'Count': {
                '$sum': '$Count'
            },
            'RunTime': {
                '$sum': '$runTime'
            },
            'ReadyTime': {
                '$sum': '$readyTime'
            },
            'OnTime': {
                '$sum': '$onTime'
            },
            'worked': {
                '$sum': '$worked'
            },
            'JCount': {
                '$sum': '$Jam'
            },
            'ICount': {
                '$sum': '$ICount'
            },
            'InCount': {
                '$sum': '$InCount'
            }
        }
    }, {
        '$project': {
            '_id': 0,
            'Item': '$_id.Item',
            'Pace': '$_id.Pace',
            'Run': {
                '$divide': [
                    '$RunTime', 60
                ]
            },
            'OnTime': '$OnTime',
            'ReadyTime': '$ReadyTime',
            'RunTime': '$RunTime',
            'Standard': {
                '$sum': [
                    '$_id.Pace', 0
                ]
            },
            'FCount': '$FCount',
            'Count': '$Count',
            'JCount': '$JCount',
            'ICount': '$ICount',
            'InCount': '$InCount'
        }
    }, {
        '$group': {
            '_id': {
                'Item': '$Item',
                'Pace': '$Pace'
            },
            'Run': {
                '$sum': '$Run'
            },
            'OnTime': {
                '$sum': '$OnTime'
            },
            'ReadyTime': {
                '$sum': '$ReadyTime'
            },
            'RunTime': {
                '$sum': '$RunTime'
            },
            'Count': {
                '$sum': '$Count'
            },
            'FCount': {
                '$sum': '$FCount'
            },
            'ICount': {
                '$sum': '$ICount'
            },
            'InCount': {
                '$sum': '$InCount'
            },
            'JCount': {
                '$sum': '$JCount'
            }
        }
    }, {
        '$project': {
            '_id': 0,
            'OnTime': '$OnTime',
            'ReadyTime': '$ReadyTime',
            'RunTime': '$RunTime',
            'Item': '$_id.Item',
            'Count': '$Count',
            'Jams': '$JCount',
            'Pace': '$_id.Pace',
            'Run': '$Run',
            'InCount': '$InCount',
            'ICount': '$ICount'
        }
    }];
    return collection.aggregate(pipeline);
}

function cursorMachineDetailFault(startDate, endDate, collectionName, machineName) {
    let collection = db.collection(collectionName);
    let pipeline = [{
        '$match': {
            'timestamp': {
                '$gte': new Date(startDate),
                '$lt': new Date(endDate)
            },
            'MachineName': machineName
        }
    }, {
        '$group': {
            '_id': {
                'Fault': '$fault',
                'FaultName': '$FaultName'
            },
            'FaultCount': {
                '$sum': 1
            },
            'FCount': {
                '$sum': '$FCount'
            },
            'Count': {
                '$sum': '$Count'
            },
            'RunTime': {
                '$sum': '$runTime'
            },
            'ReadyTime': {
                '$sum': '$readyTime'
            },
            'OnTime': {
                '$sum': '$onTime'
            },
            'worked': {
                '$sum': '$worked'
            },
            'JCount': {
                '$sum': '$Jam'
            },
            'ICount': {
                '$sum': '$ICount'
            },
            'InCount': {
                '$sum': '$InCount'
            }
        }
    }, {
        '$project': {
            '_id': 0,
            'Fault': '$_id.Fault',
            'FaultName': '$_id.FaultName',
            'FaultCount': '$FaultCount',
            'OnTime': '$OnTime',
            'ReadyTime': '$ReadyTime',
            'RunTime': '$RunTime',
            'FCount': '$FCount',
            'Count': '$Count',
            'JCount': '$JCount',
            'ICount': '$ICount',
            'InCount': '$InCount'
        }
    }, {
        '$group': {
            '_id': {
                'Fault': '$Fault',
                'FaultName': '$FaultName'
            },
            'FaultCount': {
                '$sum': '$FaultCount'
            },
            'Run': {
                '$sum': '$Run'
            },
            'OnTime': {
                '$sum': '$OnTime'
            },
            'ReadyTime': {
                '$sum': '$ReadyTime'
            },
            'RunTime': {
                '$sum': '$RunTime'
            },
            'Count': {
                '$sum': '$Count'
            },
            'FCount': {
                '$sum': '$FCount'
            },
            'ICount': {
                '$sum': '$ICount'
            },
            'InCount': {
                '$sum': '$InCount'
            },
            'JCount': {
                '$sum': '$JCount'
            }
        }
    }, {
        '$project': {
            '_id': 0,
            'Fault': '$_id.Fault',
            'FaultName': '$_id.FaultName',
            'OnTime': '$OnTime',
            'ReadyTime': '$ReadyTime',
            'RunTime': '$RunTime',
            'FaultCount': '$FaultCount',
            'Pace': '$_id.Pace'
        }
    }];
    return collection.aggregate(pipeline);
}

function cursorMachineStatusAndCountsByHour(startDate, endDate, collectionName, machineName) {
    let collection = db.collection(collectionName);
    let pipeline = [{
        '$match': {
            'timestamp': {
                '$gte': new Date(startDate),
                '$lt': new Date(endDate)
            },
            'MachineName': machineName
        }
    }, {
        '$group': {
            '_id': {
                'hour': {
                    '$hour': '$timestamp'
                },
                'day': {
                    '$dayOfMonth': '$timestamp'
                },
                'month': {
                    '$month': '$timestamp'
                },
                'year': {
                    '$year': '$timestamp'
                }
            },
            'RunTime': {
                '$sum': '$runTime'
            },
            'ReadyTime': {
                '$sum': '$readyTime'
            },
            'OnTime': {
                '$sum': '$onTime'
            },
            'FCount': {
                '$sum': '$FCount'
            }
        }
    }, {
        '$project': {
            '_id': 0,
            'day': {
                '$concat': [{
                    '$toString': '$_id.year'
                }, '-', {
                    '$toString': '$_id.month'
                }, '-', {
                    '$toString': '$_id.day'
                }]
            },
            'hour': '$_id.hour',
            'OnTime': '$OnTime',
            'ReadyTime': '$ReadyTime',
            'RunTime': '$RunTime',
            'FCount': '$FCount'
        }
    }];
    return collection.aggregate(pipeline);
}

function cursorMachineStatusAndCountsByDay(startDate, endDate, collectionName, machineName) {
    let collection = db.collection(collectionName);
    let pipeline = [{
        '$match': {
            'timestamp': {
                '$gte': new Date(startDate),
                '$lt': new Date(endDate)
            },
            'MachineName': machineName
        }
    }, {
        '$group': {
            '_id': {
                'day': {
                    '$dayOfMonth': '$timestamp'
                },
                'month': {
                    '$month': '$timestamp'
                },
                'year': {
                    '$year': '$timestamp'
                }
            },
            'RunTime': {
                '$sum': '$runTime'
            },
            'ReadyTime': {
                '$sum': '$readyTime'
            },
            'OnTime': {
                '$sum': '$onTime'
            },
            'FCount': {
                '$sum': '$FCount'
            }
        }
    }, {
        '$project': {
            '_id': 0,
            'day': {
                '$concat': [{
                    '$toString': '$_id.year'
                }, '-', {
                    '$toString': '$_id.month'
                }, '-', {
                    '$toString': '$_id.day'
                }]
            },
            'OnTime': '$OnTime',
            'ReadyTime': '$ReadyTime',
            'RunTime': '$RunTime',
            'FCount': '$FCount'
        }
    }];
    return collection.aggregate(pipeline);
}

function cursorMachineFaultHistory(startDate, endDate, collectionName, machineName) {
    let collection = db.collection(collectionName);
    let pipeline = [{
        '$match': {
            'timestamp': {
                '$gte': new Date(startDate),
                '$lt': new Date(endDate)
            },
            'MachineName': machineName,
            'FaultName': {
                '$ne': 'Run'
            }
        }
    }, {
        '$project': {
            '_id': 0,
            'day': {
                '$concat': [{
                    '$toString': '$_id.year'
                }, '-', {
                    '$toString': '$_id.month'
                }, '-', {
                    '$toString': '$_id.day'
                }]
            },
            'OnTime': '$OnTime',
            'ReadyTime': '$ReadyTime',
            'RunTime': '$RunTime'
        }
    }];
    return collection.aggregate(pipeline);
}

function cursorOperatorPerformance(startDate, endDate, collectionName, machineName, operatorName) {
    let collection = db.collection(collectionName);
    let pipeline = [{
        '$match': {
            /*'OperatorName': operatorName,*/
            'MachineName': machineName,
            'timestamp': {
                '$gte': new Date(startDate),
                '$lt': new Date(endDate)
            }
        }
    }, {
        '$group': {
            '_id': {
                'Item': '$Item',
                'Pace': '$Pace'
            },
            'FiCount': {
                '$sum': '$FiCount'
            },
            'Run': {
                '$sum': '$runTime'
            }
        }
    }, {
        '$project': {
            'item': '$_id.Item',
            'pace': '$_id.Pace',
            'efficiency': {
                '$multiply': [{
                    '$divide': [{
                        '$divide': [
                            '$FiCount', '$Run'
                        ]
                    }, {
                        '$divide': [
                            '$_id.Pace', 60
                        ]
                    }]
                }, 6000]
            },
            '_id': 0
        }
    }, {
        '$sort':
        /*{
                   'MachineName': 1
               }*/
        {
            'efficiency': -1
        }
    }];
    return collection.aggregate(pipeline);
}

function getApplicableViews(startDate, endDate) {
    let returnArray = [];
    for (var i = 0; i < viewDateRanges.length; i++) {
        if (moment(startDate).isBetween(viewDateRanges[i].startDate, viewDateRanges[i].endDate)) {
            returnArray.push(true);
        }
    }
    return returnArray;
}

/*function dataCacheSync(callback) {
    logger.info('Beginning dataCacheSync');
    var queryStartDate, queryStartTime;
    benchmarkStart = moment();

    function processRecord(row) {
        let dsDate = row['Date'];
        let tsSplit = row['Time'].split(":");
        let tsCorrectedString = '';


        tsSplit.forEach((chunk, i, arr) => {
            if (chunk.length === 2) {
                tsCorrectedString += chunk
            } else if (chunk.length === 1) {
                tsCorrectedString += '0' + chunk;
            } else {
                tsCorrectedString += '00';
            }
            if (i != (arr.length - 1)) {
                tsCorrectedString += ':'
            }
        });
        let dsDay = function() {
            let day = dsDate.getUTCDate().toString();
            if (day.length === 2) {
                return day;
            } else if (day.length === 1) {
                return '0' + day;
            } else {
                return '';
            }
        }
        let dsMonth = function() {
            let month = dsDate.getUTCMonth() + 1;
            month = month.toString();
            if (month.length === 2) {
                return month;
            } else if (month.length === 1) {
                return '0' + month;
            } else {
                return '';
            }
        }
        let UTCdateString = dsDate.getUTCFullYear() + '-' + dsMonth() + '-' + dsDay() + 'T' + tsCorrectedString + '-05:00';

        let tsUTC = moment(UTCdateString).utc().format();
        row.timestamp = tsUTC;
        delete row.Time;
        delete row.Date;

        let itemDetailArray = [];

        for (var j = 1; j <= 8; j++) {
            let itemDetail = {
                'id': row['item' + j + 'id'],
                'count': row['item' + j + 'count']
            };
            if (itemDetail.count) {
                itemDetailArray.push(itemDetail);
            }
        }

        row.items = itemDetailArray;

        return row;
    }

    function sqlNextBlockOfRecords(queryStartDate, callback, queryStartTime) {
        var queryEndDate = moment(queryStartDate).add(7, 'days').format("YYYY-MM-DD");
        var selectString = "SELECT [ID] AS machineID ,[SerialNumb] AS serial ,[MachineType] AS machineType ,[AreaLocation] as location ,[Line] as line ,[Model] AS model, [TimeStamp] AS Time,[DateStamp] AS Date,[MachineOn] AS onTime,[MachineRun] AS runTime,[MachineReady] AS readyTime,[Broke] AS brokeTime,[Empty] AS emptyTime,[Fault] AS fault,[Electric] AS electric,[Pneumatic] AS pneumatic,[Fuel] AS fuel,[FuelType] AS fuelType,[ProgramNumber] AS programNumber,[BatchNumber] AS batchNumber,[AccountNumber] AS accountNumber,[Speed] AS speed,[Stations] AS stations,[OneLane] AS onelane,[TwoLane] AS twolane,[SP] AS sp,[Drape] AS drape,[IDCodeLP1] AS idcodelp1,[IDCodeLP2] AS idcodelp2,[IDCodeLP3] AS idcodelp3,[IDCodeLP4] AS idcodelp4,[IDCodeSP1] AS idcodesp1,[IDCodeSP2] AS idcodesp2,[IDCodeSP3] AS idcodesp3,[IDCodeSP4] AS idcodesp4,[IDCodeSP5] AS idcodesp5,[IDCodeSP6] AS idcodesp6,[IDCodeSP7] AS idcodesp7,[IDCodeSP8] AS idcodesp8,[ItemID1] AS item1id,[ItemCount1] AS item1count,[ItemID2] AS item2id,[ItemCount2] AS item2count,[ItemID3] AS item3id,[ItemCount3] AS item3count,[ItemID4] AS item4id,[ItemCount4] AS item4count,[ItemID5] AS item5id,[ItemCount5] AS item5count,[ItemID6] AS item6id,[ItemCount6] AS item6count,[ItemID7] AS item7id,[ItemCount7] AS item7count,[ItemID8] AS item8id,[ItemCount8] AS item8count,[Stain] AS stain,[Tear] AS tear,[Shape] AS shape,[LowQuality] AS lowQuality,[FiCount1] AS fiCount1,[FoCount1] AS foCount1,[FmCount1] AS fmCount1,[FiCount2] AS fiCount2,[FoCount2] AS foCount2,[FmCount2] AS fmCount2,[FiCount3] AS fiCount3,[FoCount3] AS foCount3,[FmCount3] AS fmCount3,[FoCount4] AS foCount4,[FiCount4] AS fiCount4,[FmCount4] AS fmCount4,[LiCount1] AS liCount1,[LpCount1] AS lpCount1,[XiCount1] AS xiCount1,[XoCount1] AS xoCount1,[SoCount1] AS soCount1,[LiCount2] AS liCount2,[LpCount2] AS lpCount2,[XiCount2] AS xiCount2,[XoCount2] AS xoCount2,[SoCount2] AS soCount2,[LiCount3] AS liCount3,[LpCount3] AS lpCount3,[XiCount3] AS xiCount3,[XoCount3] AS xoCount3,[SoCount3] AS soCount3,[SiCount1] AS siCount1,[SpCount1] AS spCount1,[SaCount1] AS saCount1,[SiCount2] AS siCount2,[SpCount2] AS spCount2,[SaCount2] AS saCount2,[SiCount3] AS siCount3,[SpCount3] AS spCount3,[SaCount3] AS saCount3,[SiCount4] AS siCount4,[SpCount4] AS spCount4,[SaCount4] AS saCount4,[SiCount5] AS siCount5,[SpCount5] AS spCount5,[SaCount5] AS saCount5,[SiCount6] AS siCount6,[SpCount6] AS spCount6,[SaCount6] AS saCount6,[SiCount7] AS siCount7,[SpCount7] AS spCount7,[SaCount7] AS saCount7,[SiCount8] AS siCount8,[SpCount8] AS spCount8,[SaCount8] AS saCount8, [Worked] AS worked FROM [ChiTrac].[dbo].[Operator_Data]"
        if (queryStartTime) {
            queryEndDate = moment(queryStartDate).add(1, 'days').format("YYYY-MM-DD");
            selectString += "WHERE ([DateStamp] >= CONVERT(DATE, '" + queryStartDate + "') AND TimeStamp > CONVERT(TIME, '" + queryStartTime + "')) AND [DateStamp] < CONVERT(DATE, '" + queryEndDate + "') ORDER BY [TIME]";
        } else {
            selectString += "WHERE [DateStamp] >= CONVERT(DATE, '" + queryStartDate + "') AND [DateStamp] < CONVERT(DATE, '" + queryEndDate + "') ORDER BY [TIME]";
        }
        console.log(selectString);
        sqlConnectionPool.query(selectString, (err, results) => {
            if (err) throw err;
            let saveArray = [];
            records = results.recordset;
            if (records.length === 0) {
                logger.info('zero records found starting ' + queryStartDate);
                let moreToSync = getMoment().isAfter(moment(queryEndDate));
                if (moreToSync) {
                    logger.info('recurse following block starting ' + queryStartDate);
                    return sqlNextBlockOfRecords(queryEndDate, callback);
                } else {
                    return callback(null);
                }
            } else {
                for (var i = 0; i < records.length; i++) {
                    let row = processRecord(records[i]);
                    saveArray.push(row);
                }

                let rowsSchema = joi.array().items(machineStateSchema);

                joi.validate(saveArray, rowsSchema, (err, values) => {
                    if (err)
                        logger.error(err);
                    else {
                        logger.info('valid block');
                        let collection = db.collection('operatorData');
                        let savePromise = collection.insertMany(values);
                        savePromise.then((result) => {
                            setLastRecordMomentOperatorData(values[0].timestamp);
                            let moreToSync = getMoment().isAfter(moment(queryEndDate));
                            if (moreToSync) {
                                logger.info('recurse following week starting ' + queryStartDate);
                                return sqlNextBlockOfRecords(queryEndDate, callback);
                            } else {
                                return callback(null);
                            }
                        });
                    }
                });
            }
        });
    }

    function refreshItemsCollection() {
        let collection = db.collection('items');
        let selectString = 'SELECT  ItemNumb as "number", Item as "name", Active as "active", Pace as "pace", Area as "area", ' +
            'Department as "department", Weight as "weight" FROM [ChiTrac].[dbo].[Items]'

        sqlConnectionPool.query(selectString, (err, results) => {
            const dataArray = JSON.parse(JSON.stringify(results.recordset));
            dataArray.forEach((item, i) => {
                dataArray[i].active = item.active == 'Yes' ? true : false;
            });
            let cacheIsSame = equal(staticCollections['items'], dataArray);
            if (cacheIsSame) {
                logger.info('Items collection still up to date, no resync needed');
            } else {
                staticCollections['items'] = dataArray;
                collection.deleteMany({}, {}, (dropSuccess) => {
                    let savePromise = collection.insertMany(dataArray);
                    savePromise.then((saveResults) => {

                        return null;
                    })
                })
            }
        })
    }

    function refreshMachinesCollection() {
        let collection = db.collection('machines');
        let selectString = 'SELECT SerialNumb as "serial", MachineName as "name", Active as "active", IPAddress as "ipAddress", Lanes as "lanes" ' +
            ' FROM [ChiTrac].[dbo].[Machines]';

        sqlConnectionPool.query(selectString, (err, results) => {
            const dataArray = JSON.parse(JSON.stringify(results.recordset));
            dataArray.forEach((machine, i) => {
                dataArray[i].active = machine.active == 'Yes' ? true : false;
            });
            let cacheIsSame = equal(staticCollections['machines'], dataArray);
            if (cacheIsSame) {
                logger.info('Machines collection still up to date, no resync needed');
            } else {
                staticCollections['machines'] = dataArray;
                collection.deleteMany({}, {}, (dropSuccess) => {
                    let savePromise = collection.insertMany(dataArray);
                    savePromise.then((saveResults) => {

                        return null;
                    })
                })
            }
        })
    }

    /*function refreshShiftCollection() {
        let collection = db.collection('shift');
        let selectString = "SELECT [Day] ,CONVERT(varchar, [Shift1Start]) AS 'Shift1Start',CONVERT(varchar, [Shift1End]) AS 'Shift1End',CONVERT(varchar, [Shift1LunchStart]) AS 'Shift1LunchStart',CONVERT(varchar, [Shift1LunchEnd]) AS 'Shift1LunchEnd',CONVERT(varchar, [Shift2Start]) AS 'Shift2Start',CONVERT(varchar, [Shift2End]) AS 'Shift2End',CONVERT(varchar, [Shift2LunchStart]) AS 'Shift2LunchStart',CONVERT(varchar, [Shift2LunchEnd]) AS 'Shift2LunchEnd',CONVERT(varchar, [Shift3Start]) AS 'Shift3Start',CONVERT(varchar, [Shift3End]) AS 'Shift3End',CONVERT(varchar, [Shift3LunchStart]) AS 'Shift3LunchStart',CONVERT(varchar, [Shift3LunchEnd]) AS 'Shift3LunchEnd'FROM [ChiTrac].[dbo].[Shift]";
        function processWorkdays(workdaysFromSQL) {
            let workdays = [];
            for (let i = 0; i < workdaysFromSQL.length; i++) {
                let shifts = [];
                let currentDay = workdaysFromSQL[i];
                if (currentDay['Day'] === 'AllDay') {
                    let shiftObject = {};
                    let tsSplit = currentDay['Shift1Start'].split(":");
                    let tsObject = {
                        'hour': parseInt(tsSplit[0]),
                        'minute': parseInt(tsSplit[1]),
                        'second': parseInt(tsSplit[2])
                    }
                    shiftObject['start'] = tsObject;

                    tsSplit = currentDay['Shift3End'].split(":");
                    tsObject = {
                        'hour': parseInt(tsSplit[0]),
                        'minute': parseInt(tsSplit[1]),
                        'second': parseInt(tsSplit[2])
                    }
                    shiftObject['end'] = tsObject;

                    shifts.push(shiftObject)
                } else {
                    for (let j = 1; j <= 3; j++) {
                        let shiftString = 'Shift' + j;

                        let shiftObject = {};
                        if (currentDay[shiftString + 'Start']) {
                            let tsSplit = currentDay[shiftString + 'Start'].split(":");
                            let tsObject = {
                                'hour': parseInt(tsSplit[0]),
                                'minute': parseInt(tsSplit[1]),
                                'second': parseInt(tsSplit[2])
                            }
                            shiftObject['start'] = tsObject;
                        }
                        if (currentDay[shiftString + 'End']) {
                            let tsSplit = currentDay[shiftString + 'End'].split(":");
                            let tsObject = {
                                'hour': parseInt(tsSplit[0]),
                                'minute': parseInt(tsSplit[1]),
                                'second': parseInt(tsSplit[2])
                            }
                            shiftObject['end'] = tsObject;
                        }
                        if (currentDay[shiftString + 'LunchStart']) {
                            let tsSplit = currentDay[shiftString + 'LunchStart'].split(":");
                            let tsObject = {
                                'hour': parseInt(tsSplit[0]),
                                'minute': parseInt(tsSplit[1]),
                                'second': parseInt(tsSplit[2])
                            }
                            shiftObject['lunchStart'] = tsObject;
                        }
                        if (currentDay[shiftString + 'LunchEnd']) {
                            let tsSplit = currentDay[shiftString + 'LunchEnd'].split(":");
                            let tsObject = {
                                'hour': parseInt(tsSplit[0]),
                                'minute': parseInt(tsSplit[1]),
                                'second': parseInt(tsSplit[2])
                            }
                            shiftObject['lunchEnd'] = tsObject;
                        }
                        if (shiftObject['start']) {
                            shifts.push(shiftObject);
                        }
                        
                    }
                }
                let workday = {
                    'day': currentDay['Day'],
                    'shifts': shifts
                }
                workdays.push(workday);
            }
            return workdays;
        }

        sqlConnectionPool.query(selectString, (err, results) => {
            const dataArray = JSON.parse(JSON.stringify(results.recordset));
            let workdays = processWorkdays(dataArray);
            let cacheIsSame = equal(staticCollections['shift'], workdays);
            if (cacheIsSame) {
                logger.info('Shift collection still up to date, no resync needed');
            } else {
                let workweekSchema = joi.array().items(workdaySchema);
                joi.validate(workdays, workweekSchema, (err, values) => {
                    if (err)
                        logger.error(err);
                    else {
                        staticCollections['shift'] = values;
                        collection.deleteMany({}, {}, (dropSuccess) => {
                            let savePromise = collection.insertMany(values);
                            savePromise.then((saveResults) => {

                                return null; //console.log(saveResults);
                            })
                        })
                    }
                })

            }
        })
    }*/
/*

    function refreshOperatorsCollection() {
        let collection = db.collection('operators');
        let selectString = 'SELECT ID_Code as "code", OperatorName as "fullName", Active as "active" FROM [ChiTrac].[dbo].[Operators]';
        sqlConnectionPool.query(selectString, (err, results) => {
            const dataArray = JSON.parse(JSON.stringify(results.recordset));
            let operatorArray = [];
            dataArray.forEach((operator) => {
                let nameWords = operator.fullName.split(' ');
                let newOperator = {
                    'code': operator.code,
                    'name': {
                        'full': operator.fullName,
                        'first': nameWords[0],
                        'last': nameWords[1],
                        'middle': null,
                        'prefix': null,
                        'suffix': null,
                    },
                    'active': operator.active == 'Yes' ? true : false
                };
                operatorArray.push(newOperator);
            })
            let cacheIsSame = equal(staticCollections['operators'], operatorArray);
            if (cacheIsSame) {
                logger.info('Operators collection still up to date, no resync needed');
            } else {
                staticCollections['operators'] = dataArray;
                collection.deleteMany({}, {}, (dropSuccess) => {
                    let savePromise = collection.insertMany(operatorArray);
                    savePromise.then((saveResults) => {

                        return null;
                    });
                });
            }
        });
    }

    function refreshFaultsCollection() {
        let collection = db.collection('faults');
        let selectString = 'SELECT ID_Code as "code", FaultName as "name", Jam as "jam" FROM [ChiTrac].[dbo].[Faults]';

        sqlConnectionPool.query(selectString, (err, results) => {
            const dataArray = JSON.parse(JSON.stringify(results.recordset));
            let cacheIsSame = equal(staticCollections['faults'], dataArray);
            if (cacheIsSame) {
                logger.info('Faults collection still up to date, no resync needed');
            } else {
                staticCollections['faults'] = dataArray;
                collection.deleteMany({}, {}, (dropSuccess) => {
                    let savePromise = collection.insertMany(results.recordset);
                    savePromise.then((saveResults) => {

                        return null;
                    });
                });
            }
        });
    }

    function refreshTTCollection() {
        let collection = db.collection('tickerTable');
        let selectString = "SELECT [ID] AS machineID ,[SerialNumb] AS serial ,[MachineType] AS machineType ,[AreaLocation] as location ,[Line] as line ,[Model] AS model, [TimeStamp] AS Time,[DateStamp] AS Date,[MachineOn] AS onTime,[MachineRun] AS runTime,[MachineReady] AS readyTime,[Broke] AS brokeTime,[Empty] AS emptyTime,[Fault] AS fault,[Electric] AS electric,[Pneumatic] AS pneumatic,[Fuel] AS fuel,[FuelType] AS fuelType,[ProgramNumber] AS programNumber,[BatchNumber] AS batchNumber,[AccountNumber] AS accountNumber,[Speed] AS speed,[Stations] AS stations,[OneLane] AS onelane,[TwoLane] AS twolane,[SP] AS sp,[Drape] AS drape,[IDCodeLP1] AS idcodelp1,[IDCodeLP2] AS idcodelp2,[IDCodeLP3] AS idcodelp3,[IDCodeLP4] AS idcodelp4,[IDCodeSP1] AS idcodesp1,[IDCodeSP2] AS idcodesp2,[IDCodeSP3] AS idcodesp3,[IDCodeSP4] AS idcodesp4,[IDCodeSP5] AS idcodesp5,[IDCodeSP6] AS idcodesp6,[IDCodeSP7] AS idcodesp7,[IDCodeSP8] AS idcodesp8,[ItemID1] AS item1id,[ItemCount1] AS item1count,[ItemID2] AS item2id,[ItemCount2] AS item2count,[ItemID3] AS item3id,[ItemCount3] AS item3count,[ItemID4] AS item4id,[ItemCount4] AS item4count,[ItemID5] AS item5id,[ItemCount5] AS item5count,[ItemID6] AS item6id,[ItemCount6] AS item6count,[ItemID7] AS item7id,[ItemCount7] AS item7count,[ItemID8] AS item8id,[ItemCount8] AS item8count,[Stain] AS stain,[Tear] AS tear,[Shape] AS shape,[LowQuality] AS lowQuality,[FiCount1] AS fiCount1,[FoCount1] AS foCount1,[FmCount1] AS fmCount1,[FiCount2] AS fiCount2,[FoCount2] AS foCount2,[FmCount2] AS fmCount2,[FiCount3] AS fiCount3,[FoCount3] AS foCount3,[FmCount3] AS fmCount3,[FoCount4] AS foCount4,[FiCount4] AS fiCount4,[FmCount4] AS fmCount4,[LiCount1] AS liCount1,[LpCount1] AS lpCount1,[XiCount1] AS xiCount1,[XoCount1] AS xoCount1,[SoCount1] AS soCount1,[LiCount2] AS liCount2,[LpCount2] AS lpCount2,[XiCount2] AS xiCount2,[XoCount2] AS xoCount2,[SoCount2] AS soCount2,[LiCount3] AS liCount3,[LpCount3] AS lpCount3,[XiCount3] AS xiCount3,[XoCount3] AS xoCount3,[SoCount3] AS soCount3,[SiCount1] AS siCount1,[SpCount1] AS spCount1,[SaCount1] AS saCount1,[SiCount2] AS siCount2,[SpCount2] AS spCount2,[SaCount2] AS saCount2,[SiCount3] AS siCount3,[SpCount3] AS spCount3,[SaCount3] AS saCount3,[SiCount4] AS siCount4,[SpCount4] AS spCount4,[SaCount4] AS saCount4,[SiCount5] AS siCount5,[SpCount5] AS spCount5,[SaCount5] AS saCount5,[SiCount6] AS siCount6,[SpCount6] AS spCount6,[SaCount6] AS saCount6,[SiCount7] AS siCount7,[SpCount7] AS spCount7,[SaCount7] AS saCount7,[SiCount8] AS siCount8,[SpCount8] AS spCount8,[SaCount8] AS saCount8, [Worked] AS worked FROM [ChiTrac].[dbo].[TickerTable]"

        sqlConnectionPool.query(selectString, (err, results) => {
            if (err) throw err;
            let saveArray = [];
            records = results.recordset;

            for (var i = 0; i < records.length; i++) {
                let row = processRecord(records[i]);
                row['ticker'] = true;
                saveArray.push(row);
            }

            let rowsSchema = joi.array().items(machineStateSchema);

            joi.validate(saveArray, rowsSchema, (err, values) => {
                if (err)
                    logger.error(err);
                else {
                    logger.info('valid block TickerTable');
                    collection.deleteMany({}, {}, (dropSuccess) => {
                        let savePromise = collection.insertMany(values);
                        savePromise.then((saveResults) => {
                            let collection = db.collection('operatorData');
                            let unionPromise = collection.insertMany(values);
                            unionPromise.then((unionResults) => {
                                return null;
                            });
                        });
                    });
                }
            });
        });
    }

    refreshItemsCollection();
    refreshMachinesCollection();
    refreshOperatorsCollection();
    refreshFaultsCollection();
    //refreshShiftCollection();


    /*getLastRecordMomentOperatorData((err, lastRecordTimestamp) => {
        let queryTimestamp;
        if (err === 0) {
            logger.info('No mongo records found');
            queryTimestamp = moment.tz('2016-01-01T00:00:00Z', "UTC").tz("America/Chicago"); //get the UTC time of the last record in the cache
            queryStartDate = queryTimestamp.format("YYYY-MM-DD");
            queryStartTime = queryTimestamp.format("HH:mm:ss");

            sqlNextBlockOfRecords(queryStartDate, (err) => {
                benchmarkEnd = moment();
                logger.info('Done recursing');

                var benchmarkTime = moment.duration(benchmarkEnd.diff(benchmarkStart));

                logger.info(benchmarkTime._milliseconds);
                return callback(null);
            });
        } else if (lastRecordTimestamp) {
            logger.info('Top mongo record gotten');
            queryTimestamp = moment.tz(lastRecordTimestamp, "UTC").tz("America/Chicago").startOf('hour').subtract(1, 'hour'); //get the UTC time of the last record in the cache
            console.log(queryTimestamp);
            queryStartDate = queryTimestamp.format("YYYY-MM-DD");
            queryStartTime = queryTimestamp.format("HH:mm:ss");

            promiseDeleteMostRecentHourMongo('operatorData', lastRecordTimestamp).then((result) => {
                logger.info('Refilling most recent hour in Mongo');

                sqlNextBlockOfRecords(queryStartDate, (err) => {
                    logger.info('Done recursing');
                    refreshTTCollection();
                    benchmarkEnd = moment();
                    var benchmarkTime = moment.duration(benchmarkEnd.diff(benchmarkStart));
                    logger.info(benchmarkTime._milliseconds);
                    refreshDayView();
                    return callback(null);
                }, queryStartTime);
            });
        }
    });*/
/*
}*/ //KEPT FOR POSTERITY WHEN REMOVING JOI 02-16-24 RTI II

/*function dataCacheSyncPoll() {
    dataCacheSync((err) => {
        setTimeout(dataCacheSyncPoll, 30000);
    })
}*/ //KEPT FOR POSTERITY WHEN REMOVING JOI 02-16-24 RTI II

function createHistoricalViews() {
    viewsToCreate.forEach((viewToCreate, i) => {
        logger.info('Creating ' + viewToCreate);
        promiseCreateView(viewDateRanges[i]['startDate'], viewDateRanges[i]['endDate'], viewToCreate).then((results) => {
            logger.info(viewToCreate + ' created from ' + viewDateRanges[i]['startDate'] + ' to ' + viewDateRanges[i]['endDate']);
        });
    });
}

function refreshYearView(req, res) {
    let message = 'aggYear updating from ' + viewDateRanges[1]['startDate'] + ' to ' + viewDateRanges[1]['endDate'];
    if (res) {
        res.json({ 'message': message });
    }
    promiseCreateView(viewDateRanges[1]['startDate'], viewDateRanges[1]['endDate'], 'aggYear').then((results) => {
        return logger.info(message);
    });
}

function refreshDayView(req, res, cb) {
    let message = 'aggDay updated from ' + viewDateRanges[0]['startDate'] + ' to ' + viewDateRanges[0]['endDate'];
    if (res) {
        res.json({ 'message': message });
    }

    promiseCreateView(viewDateRanges[0]['startDate'], viewDateRanges[0]['endDate'], 'aggDay').then((results) => {
        /*promiseTickerAgg().then((resultsTicker) => {
            let collection = db.collection('aggDay');
            let savePromise = collection.insertMany(resultsTicker);

            function savePromiseSuccess(result) {
                let message = 'aggDay updated from ' + viewDateRanges[0]['startDate'] + ' to ' + viewDateRanges[0]['endDate'];
                if (res) {
                    res.json({ 'message': message });
                } else if (cb) {
                    return cb(null);
                }
                return logger.info(message);
            }
            savePromise.catch((err) => {
                setTimeout(() => {
                    let savePromise = collection.insertMany(resultsTicker);
                    savePromise.then(savePromiseSuccess);
                }, 1000)
            })
            savePromise.then(savePromiseSuccess);
        }).catch((err) => { return cb(err) });*/
        return logger.info(message);
    });
}

function getLatestSQLRow(callback) {
    //let selectString = "SELECT TOP (1) [ID] ,[SerialNumb] ,[MachineType] ,[AreaLocation] ,[Line] ,[Model] ,[TimeStamp] ,[DateStamp] ,[MachineOn] ,[MachineRun] ,[MachineReady] ,[Broke] ,[Empty] ,[Fault] ,[Electric] ,[Pneumatic] ,[Fuel] ,[FuelType] ,[ProgramNumber] ,[BatchNumber] ,[AccountNumber] ,[Speed] ,[Stations] ,[OneLane] ,[TwoLane] ,[SP] ,[Drape] ,[IDCodeLP1] ,[IDCodeLP2] ,[IDCodeLP3] ,[IDCodeLP4] ,[IDCodeSP1] ,[IDCodeSP2] ,[IDCodeSP3] ,[IDCodeSP4] ,[IDCodeSP5] ,[IDCodeSP6] ,[IDCodeSP7] ,[IDCodeSP8] ,[ItemID1] ,[ItemCount1] ,[ItemID2] ,[ItemCount2] ,[ItemID3] ,[ItemCount3] ,[ItemID4] ,[ItemCount4] ,[ItemID5] ,[ItemCount5] ,[ItemID6] ,[ItemCount6] ,[ItemID7] ,[ItemCount7] ,[ItemID8] ,[ItemCount8] ,[Stain] ,[Tear] ,[Shape] ,[LowQuality] ,[FiCount1] ,[FoCount1] ,[FmCount1] ,[FiCount2] ,[FoCount2] ,[FmCount2] ,[FiCount3] ,[FoCount3] ,[FmCount3] ,[FoCount4] ,[FiCount4] ,[FmCount4] ,[LiCount1] ,[LpCount1] ,[XiCount1] ,[XoCount1] ,[SoCount1] ,[LiCount2] ,[LpCount2] ,[XiCount2] ,[XoCount2] ,[SoCount2] ,[LiCount3] ,[LpCount3] ,[XiCount3] ,[XoCount3] ,[SoCount3] ,[SiCount1] ,[SpCount1] ,[SaCount1] ,[SiCount2] ,[SpCount2] ,[SaCount2] ,[SiCount3] ,[SpCount3] ,[SaCount3] ,[SiCount4] ,[SpCount4] ,[SaCount4] ,[SiCount5] ,[SpCount5] ,[SaCount5] ,[SiCount6] ,[SpCount6] ,[SaCount6] ,[SiCount7] ,[SpCount7] ,[SaCount7] ,[SiCount8] ,[SpCount8] ,[SaCount8] ,[PlaceHolder1] ,[Worked] FROM [ChiTrac].[dbo].[Operator_Data] ORDER BY [ID] DESC";
    let selectString = "SELECT TOP (1) [ID] AS machineID ,[SerialNumb] AS serial ,[MachineType] AS machineType ,[AreaLocation] as location ,[Line] as line ,[Model] AS model, [TimeStamp] ,[DateStamp] ,DATEADD(day, 0, DATEDIFF(day, 0, [DateStamp])) + DATEADD(day, 0 - DATEDIFF(day, 0, [TimeStamp]), [TimeStamp]) AS timestamp,[MachineOn] AS 'on',[MachineRun] AS run,[MachineReady] ,[Broke] ,[Empty] ,[Fault] ,[Electric] ,[Pneumatic] ,[Fuel] ,[FuelType] ,[ProgramNumber] ,[BatchNumber] ,[AccountNumber] ,[Speed] ,[Stations] ,[OneLane] ,[TwoLane] ,[SP] ,[Drape] ,[IDCodeLP1] ,[IDCodeLP2] ,[IDCodeLP3] ,[IDCodeLP4] ,[IDCodeSP1] ,[IDCodeSP2] ,[IDCodeSP3] ,[IDCodeSP4] ,[IDCodeSP5] ,[IDCodeSP6] ,[IDCodeSP7] ,[IDCodeSP8] ,[ItemID1] ,[ItemCount1] ,[ItemID2] ,[ItemCount2] ,[ItemID3] ,[ItemCount3] ,[ItemID4] ,[ItemCount4] ,[ItemID5] ,[ItemCount5] ,[ItemID6] ,[ItemCount6] ,[ItemID7] ,[ItemCount7] ,[ItemID8] ,[ItemCount8] ,[Stain] ,[Tear] ,[Shape] ,[LowQuality] ,[FiCount1] ,[FoCount1] ,[FmCount1] ,[FiCount2] ,[FoCount2] ,[FmCount2] ,[FiCount3] ,[FoCount3] ,[FmCount3] ,[FoCount4] ,[FiCount4] ,[FmCount4] ,[LiCount1] ,[LpCount1] ,[XiCount1] ,[XoCount1] ,[SoCount1] ,[LiCount2] ,[LpCount2] ,[XiCount2] ,[XoCount2] ,[SoCount2] ,[LiCount3] ,[LpCount3] ,[XiCount3] ,[XoCount3] ,[SoCount3] ,[SiCount1] ,[SpCount1] ,[SaCount1] ,[SiCount2] ,[SpCount2] ,[SaCount2] ,[SiCount3] ,[SpCount3] ,[SaCount3] ,[SiCount4] ,[SpCount4] ,[SaCount4] ,[SiCount5] ,[SpCount5] ,[SaCount5] ,[SiCount6] ,[SpCount6] ,[SaCount6] ,[SiCount7] ,[SpCount7] ,[SaCount7] ,[SiCount8] ,[SpCount8] ,[SaCount8] ,[PlaceHolder1] ,[Worked] FROM [ChiTrac].[dbo].[Operator_Data] ORDER BY [ID] DESC";
    sqlConnectionPool.query(selectString, (err, results) => {
        if (err) throw err;
        logger.info(results);
        if (callback) return callback(null, results);
    });
}

function getMachineSingleDay(callback) {
    var selectString = "SELECT Machine, RIGHT('0' + CAST(SUM(On1) / 3600 AS VARCHAR(5)),3) + ':' + RIGHT('0' + CAST((SUM(On1) / 60) % 60 AS VARCHAR),2) + ':' + RIGHT('0' + CAST(SUM(On1) % 60 AS VARCHAR),2) AS On1, RIGHT('0' + CAST(SUM(Ready) / 3600 AS VARCHAR(5)),3) + ':' + RIGHT('0' + CAST((SUM(Ready) / 60) % 60 AS VARCHAR),2) + ':' + RIGHT('0' + CAST(SUM(Ready) % 60 AS VARCHAR),2) AS Ready, RIGHT('0' + CAST(SUM(Run) / 3600 AS VARCHAR(5)),3) + ':' + RIGHT('0' + CAST((SUM(Run) / 60) % 60 AS VARCHAR),2) + ':' + RIGHT('0' + CAST(SUM(Run) % 60 AS VARCHAR),2) AS Run, Sum(Count) AS Count, Sum(Fcount) AS Fcount, CAST(ROUND(CAST(Sum(Count) AS DECIMAL(10,2))/CAST(Sum(Query18.Worked) AS DECIMAL(10,2)) *60*60,2) AS NUMERIC(10,1))  AS PPH, ROUND(CAST(Sum(Count) AS DECIMAL(10,2))/CAST(Sum(FCount) + 1 AS DECIMAL(10,2)),2)*100 as Thruput, CAST(Sum(Run) AS DECIMAL(10,2))/DATEDIFF(ss, '2018/11/14 00:00:00', '2018/11/15 00:00:00')*100 AS Usage, f.FaultName AS Fault, SUM(CAST(60 / (Query18.Pace/60) AS DECIMAL(10, 2)) * CAST(FCount AS DECIMAL(10, 2)) / m.Lanes)/Sum(Run)  * 100 AS Performance, CONVERT(nvarchar, DATEADD(s,(Select SUM(q.On1) FROM Query18 q WHERE (q.Fault <> 'Run' AND q.Fault <> 'Timeout' AND q.Fault <> 'Stop' AND q.Fault <> 'Waiting' AND  q.Fault <> 'Feeder Pause' AND q.Fault <> 'Pause @Feeder') AND q.Machine = Query18.Machine AND CONVERT(DATE, '2018/11/14 00:00:00') <= q.Date AND CONVERT(TIME, '2018/11/14 00:00:00') <= q.TS AND CONVERT(DATE, '2018/11/15 00:00:00') >= q.Date AND CONVERT(TIME, '2018/11/15 00:00:00') >= q.TS ),0), 108) AS Downtime From Query18 INNER JOIN [dbo].[Machines] m ON Query18.Machine = m.MachineName INNER JOIN TickerTable tt ON m.SerialNumb = tt.SerialNumb INNER JOIN [dbo].[Faults] f ON tt.Fault = f.ID_Code WHERE Query18.Date >= CONVERT(DATE, '2018/11/14 00:00:00') AND Query18.TS >= CONVERT(TIME, '2018/11/14 00:00:00') AND Query18.Date <= CONVERT(DATE, '2018/11/15 00:00:00') AND Query18.TS <= CONVERT(TIME, '2018/11/15 00:00:00') GROUP By [Machine], f.FaultName ORDER BY Machine";

    sqlConnectionPool.query(selectString, (err, results) => {
        if (err) throw err;
        machineSingleDay = results;
        if (callback) return callback(null);
    });
}

function getItems(callback) {
    var selectString = "SELECT i.Item, Sum([FCount]) AS FCount, Sum([Count]) AS Count,  ROUND(CAST(Sum(Run) AS DECIMAL(10,2))/60,2) AS Run, (SELECT (Pace/60) from Items WHERE Items.Item = i.Item) * 60 AS Standard, ROUND(CAST(Sum(FCount) AS DECIMAL(10,2))/CAST(Sum(Run)+1 AS DECIMAL(10,2)) *60*60,2) AS PPH, ROUND(CAST(Sum(Count) AS DECIMAL(10,2))/ CAST(Sum(FCount)+1 AS DECIMAL(10,2)),2)*100 as Thruput, CAST((ROUND((SUM(CAST(FCount AS DECIMAL(10,2))))/(SUM(CAST(Run AS DECIMAL(10,2)))+1) * 60/(Select (Pace/60) from Items where Item = i.Item), 2,2) * 100) AS INT) AS PercentOfTarget, q.BatchNumber AS BatchNumber FROM Query18 q INNER JOIN Items i ON q.BatchNumber = i.ItemNumb WHERE (q.Date >= CONVERT(DATE, '2018/11/14 00:00:00') AND q.TS >= CONVERT(TIME, '2018/11/14 00:00:00') AND q.Date <= CONVERT(DATE, '2018/11/15 00:00:00') AND q.TS <= CONVERT(TIME, '2018/11/15 00:00:00') ) Group By i.Item, q.BatchNumber ORDER BY i.Item";

    sqlConnectionPool.query(selectString, (err, results) => {
        if (err) throw err;
        items = results;
        if (callback) return callback(null);
    })
}

function getItemDetails(callback) {
    var selectString = "SELECT Itm, SUM(Tot) AS Total FROM Query_BatchBreakOut WHERE DateTimeStamp >= '2018/11/14 00:00:00' AND DateTimeStamp <= '2018/11/15 00:00:00' GROUP BY Itm";

    sqlConnectionPool.query(selectString, (err, results) => {
        if (err) throw err;
        itemDetails = results;
        if (callback) return callback(null);
    })
}

function getActiveMachinesByType(machineType, callback) {
    let selectString = "SELECT OperatorName AS operatorName, Item AS item, FiCount AS fiCount, FoCount AS foCount, FmCount AS fmCount, Run AS run, Date AS date, Timestamp AS timestamp, Machine AS machine, Lane AS lane, Fault AS fault, BatchNumber AS batchNumber FROM Query_fcount_active ";
    if ((typeof machineType) === 'string') {
        selectString += "WHERE Machine LIKE '" + machineType + "%'"
    } else if (Array.isArray(machineType)) {
        selectString += "WHERE ";
        for (var i = 0; i < machineType.length; i++) {
            selectString += "Machine LIKE '" + machineType[i] + "%' ";
            if ((i + 1) < machineType.length) {
                selectString += "OR ";
            } else {
                selectString += " ORDER BY machine"
            }
        }
    }

    sqlConnectionPool.query(selectString, (err, results) => {
        if (err) throw err;
        logger.info(results);
        if (callback) return callback(null, results);
    })
}


function getTickerBySerial(serialNumber, callback) {
    let promise = cursorTickerAgg(parseInt(serialNumber)).project({ _id: 0 }).toArray();

    promise.then((results) => {
        let onDuration = moment.duration(results[0].timers.onTime, 'seconds');
        let onHours = onDuration.get('hours');
        let onMinutes = onDuration.get('minutes');
        let onSeconds = onDuration.get('seconds');
        let onDurationString = '' + (onHours.toString().length > 1 ? onHours : '0' + onHours) + ':' + (onMinutes.toString().length > 1 ? onMinutes : '0' + onMinutes) + ':' + (onSeconds.toString().length > 1 ? onSeconds : '0' + onSeconds);
        results[0].timers['onDuration'] = onDurationString;
        callback(null, results);
    });
}

function getOperatorEfficiencyByLane(timeframe, serialNumber, lane, callback) {
    let timeframeString = "";
    let promise;
    let timeframeMins = 0;

    switch (timeframe) {
        case 'fiveMinute':
            timeframeMins = 5;
            promise = cursorOperatorEfficiency(moment().subtract(5, 'm').toISOString(), serialNumber, lane).toArray();
            break;
        case 'fifteenMinute':
            timeframeMins = 15;
            promise = cursorOperatorEfficiency(moment().subtract(15, 'm').toISOString(), serialNumber, lane).toArray();
            break;
        case 'hourly':
            timeframeMins = 60;
            promise = cursorOperatorEfficiency(moment().subtract(1, 'h').toISOString(), serialNumber, lane).toArray();
            break;
        case 'daily':
        default:
            timeframeMins = 24 * 60;
            promise = cursorOperatorEfficiency(moment().startOf('day').toISOString(), serialNumber, lane).toArray();
            break;
    }

    promise.then((results) => {
        let returnValue = results[0];
        if (returnValue != undefined) {
            returnValue['timeframe'] = timeframeMins;
            if (returnValue.count === 0) {
                returnValue['efficiency'] = 0;
            } else if (returnValue['runTime'] != undefined) {
                returnValue['efficiency'] = ((returnValue.count / (returnValue.runTime / 60)) / (returnValue.pace / 60)) * 60;
            } else {
                returnValue['efficiency'] = 0;
            }
        }
        callback(null, returnValue);
    })
}

function getMachineOperatorPerformance(timeframe, machine, operator, callback) {
    let timeframeString = "";
    let promise;

    switch (timeframe) {
        case 'fiveMinute':
            promise = cursorOperatorPerformance(moment().subtract(5, 'm').format(), moment().format(), 'aggDay', machine, operator).toArray();
            break;
        case 'hourly':
            promise = cursorOperatorPerformance(moment().subtract(1, 'h').format(), moment().format(), 'aggDay', machine, operator).toArray();
            break;
        case 'daily':
        default:
            promise = cursorOperatorPerformance(moment().startOf('day').format(), moment().format(), 'aggDay', machine, operator).toArray();
            break;
    }

    promise.then((results) => {
        callback(null, results[0]);
    })

}

function pollMachineSingleDay(scanrate, callback) {
    logger.info('Poll requested');
    getMachineSingleDay((err) => {
        logger.info('SQL polled @ ' + Date.now());
        if (err) throw err;
        setTimeout(() => { pollMachineSingleDay(scanrate) }, scanrate);
    })
}

function pollItemPageData(scanrate, callback) {
    logger.info('Poll requested');
    getItems((err) => {
        getItemDetails((err) => {
            logger.info('SQL polled @ ' + Date.now());
            if (err) throw err;
            setTimeout(() => { pollItemPageData(scanrate) }, scanrate);
        })
    })
}

app.use((req, res, next) => {
    /*res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");*/
    res.header("Cache-Control", "no-cache, no-store, must-revalidate");
    next();
});

app.get(('/docs/api'), (req, res, next) => {
    res.sendFile(path.join(__dirname, '/docs/api.html'));
})

app.get(('/api/commands/createHistoricalViews'), (req, res, next) => {
    createHistoricalViews();
    res.json({ message: 'Creating Historical Views' });
});

app.get(('/api/commands/refreshYearView'), (req, res, next) => {
    refreshYearView(req, res);
});

app.get(('/api/commands/refreshDayView'), (req, res, next) => {
    refreshDayView(req, res);
});



app.get('/api/test', (req, res, next) => {
    promiseTestAgg().then((results) => {
        res.json(results);
    })
});

/*app.get('/api/items/:startDate/:endDate', (req, res, next) => {
    for (var i = 0; i < viewsToCreate.length; i++) {
        let startDateIncluded = (moment(req.params.startDate).isSameOrAfter(viewDateRanges[i]['startDate']));
        let endDateIncluded = (moment(req.params.endDate).isSameOrBefore(viewDateRanges[i]['endDate']));
        if (startDateIncluded) {
            promiseItemGridAgg(req.params.startDate, req.params.endDate, 'aggYear').then((results) => {
                res.json(results);
            });
            break;
        }
    }
});*/

app.get('/api/itemDetails/:startDate/:endDate', (req, res, next) => {
    for (var i = 0; i < viewsToCreate.length; i++) {
        let startDateIncluded = (moment(req.params.startDate).isSameOrAfter(viewDateRanges[i]['startDate']));
        let endDateIncluded = (moment(req.params.endDate).isSameOrBefore(viewDateRanges[i]['endDate']));
        if (startDateIncluded) {
            promiseItemGridAgg(req.params.startDate, req.params.endDate, 'aggYear').then((results) => {
                res.json(results);
            });
            break;
        }
    }
});

app.get('/api/itemTotals/:startDate/:endDate', (req, res, next) => {
    for (var i = 0; i < viewsToCreate.length; i++) {
        let startDateIncluded = (moment(req.params.startDate).isSameOrAfter(viewDateRanges[i]['startDate']));
        let endDateIncluded = (moment(req.params.endDate).isSameOrBefore(viewDateRanges[i]['endDate']));
        if (startDateIncluded) {
            promiseItemDetailsAgg(req.params.startDate, req.params.endDate, 'aggYear').then((results) => {
                res.json(results);
            });
            break;
        }
    }
});

app.get('/api/machines/active/:machineType', (req, res, next) => {
    getActiveMachinesByType(req.params.machineType, (err, results) => {
        res.json(results['recordset']);
    });
});

app.get('/api/machine/ticker/:serialNumber', (req, res, next) => {
    getTickerBySerial(req.params.serialNumber, (err, results) => {
        res.json(results);
    });
});

app.get('/api/operator/realtime/:serialNumber/:lane/:timeframe', (req, res, next) => {
    getOperatorEfficiencyByLane(req.params.timeframe, req.params.serialNumber, req.params.lane, (err, results) => {
        res.json(results);
    })
})

app.get('/api/machine/operatorPerformance/:timeframe/:machineName/:operatorName/', (req, res, next) => {
    getMachineOperatorPerformance(req.params.timeframe, req.params.machineName, req.params.operatorName, (err, results) => {
        if (err) { res.json(err) };
        console.log(results);
        if (results) {
            res.json(results);
        } else {
            res.json({ 'efficiency': 0 })
        }

    });
});

function xmlArrayBuilder(rootLabel, array, excludeHeader, callback) {
    let arrayBuilder = new xml.Builder({ renderOpts: { 'pretty': false }, headless: true, rootName: rootLabel });
    let returnString;
    if (excludeHeader) {
        returnString = '<' + rootLabel + 's>';
    } else {
        returnString = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><' + rootLabel + 's>';
    }

    array.forEach((element) => {
        returnString += arrayBuilder.buildObject(element);
    });
    returnString += '</' + rootLabel + 's>'
    if (callback) {
        return callback(returnString);
    } else {
        return returnString;
    }
}

function xmlMachineStateBuilder(machineObject, callback) {
    machineObject.machine['id'] = machineObject.ID;
    machineObject.machine['name'] = machineObject.MachineName;
    machineObject.machine['lanes'] = machineObject.Lanes;
    delete machineObject.ID;
    delete machineObject.SerialNumb;
    delete machineObject.MachineName;
    delete machineObject.Active;
    delete machineObject.DateAdded;
    delete machineObject.IPAddress;
    delete machineObject.Lanes;
    delete machineObject.timestamp;

    //Deep copy the object arrays for separate parsing
    let lpOperators = machineObject.lpOperators.map((x) => x);
    let spOperators = machineObject.spOperators.map((x) => x);
    let items = machineObject.items.map((x) => x);
    let itemInfo = machineObject.itemInfo.map((x) => x);
    let lpOperatorInfo = machineObject.lpOperatorInfo.map((x) => x);
    let spOperatorInfo = machineObject.spOperatorInfo.map((x) => x);
    let statusInfo = machineObject.statusInfo.map((x) => x);

    //Delete the arrays from the object so we can parse the main object easily
    delete machineObject.lpOperators;
    delete machineObject.spOperators;
    delete machineObject.items;
    delete machineObject.itemInfo;
    delete machineObject.lpOperatorInfo;
    delete machineObject.spOperatorInfo;
    delete machineObject.statusInfo;

    let machineBuilder = new xml.Builder({ renderOpts: { 'pretty': false }, rootName: 'machineState' });
    /*let lpOperatorsBuilder = new xml.Builder({ renderOpts: { 'pretty': false }, headless: true, rootName: 'lpOperators' });
    let spOperatorsBuilder = new xml.Builder({ renderOpts: { 'pretty': false }, headless: true, rootName: 'spOperators' });
    let itemsBuilder = new xml.Builder({ renderOpts: { 'pretty': false }, headless: true, rootName: 'items' });
    let itemInfoBuilder = new xml.Builder({ renderOpts: { 'pretty': false }, headless: true, rootName: 'itemInfo' });
    let lpOperatorInfoBuilder = new xml.Builder({ renderOpts: { 'pretty': false }, headless: true, rootName: 'lpOperatorInfo' });
    let spOperatorInfoBuilder = new xml.Builder({ renderOpts: { 'pretty': false }, headless: true, rootName: 'spOperatorInfo' });
    let statusInfoBuilder = new xml.Builder({ renderOpts: { 'pretty': false }, headless: true, rootName: 'statusInfo' });*/
    let xmlString = machineBuilder.buildObject(machineObject);
    /*let splitArray = xmlString.split('</machineState>');
    xmlString = splitArray[0];
    xmlString += xmlArrayBuilder('lpOperator', lpOperators);
    xmlString += xmlArrayBuilder('spOperator', spOperators);
    xmlString += xmlArrayBuilder('item', items);
    xmlString += xmlArrayBuilder('itemInfo', itemInfo);
    if (lpOperatorInfo.length) { xmlString += xmlArrayBuilder('lpOperatorInfo', lpOperatorInfo); }
    if (spOperatorInfo.lenght) { xmlString += xmlArrayBuilder('spOperatorInfo', spOperatorInfo); }
    xmlString += statusInfoBuilder.buildObject(statusInfo[0]);
    xmlString += '</machineState>';*/
    return callback(xmlString);
}

function xmlLevelOneMultilaneBuilder(machineObject, callback) {

}


app.get('/api/machines/now/xml', (req, res, next) => {
    res.set('Content-Type', 'text/xml');
    //List back either the machine definitions from the DB, or if now, list the machines currently online
    /*getMachineConfiguration((err, results) => {
        if (err) { res.send(builder.buildObject(err)) };
        if (results) {
            xmlArrayBuilder('machine', results, false, (xmlString) => {
                res.send(xmlString);
            });
        } else {*/
    xmlArrayBuilder('machine', [], false, (xmlString) => {
        res.send(xmlString);
    });
    /*}
    });*/
});
app.get('/api/machines/now', (req, res, next) => {
    //List back either the machine definitions from the DB, or if now, list the machines currently online
    /*getMachineConfiguration((err, results) => {
        if (err) { res.json(err) };
        console.log(results);
    });*/
    res.json([]);
});


app.get('/api/operators/now/xml', (req, res, next) => {
    res.set('Content-Type', 'text/xml');
    //List back either the machine definitions from the DB, or if now, list the machines currently online
    /*getOperatorConfiguration((err, results) => {
        if (err) { res.send(builder.buildObject(err)) };
        if (results) {
            xmlArrayBuilder('operator', results, false, (xmlString) => {
                res.send(xmlString);
            });
        } else {*/
    xmlArrayBuilder('operator', [], false, (xmlString) => {
        res.send(xmlString);
    });
    /*}
    });*/
});
app.get('/api/operators/now', (req, res, next) => {
    //List back either the machine definitions from the DB, or if now, list the machines currently online
    res.json([]);
});


app.get('/api/items/now/xml', (req, res, next) => {
    res.set('Content-Type', 'text/xml');
    /*getItemConfiguration((err, results) => {
        if (err) { res.send(builder.buildObject(err)) };
        if (results) {
            xmlArrayBuilder('item', results, false, (xmlString) => {
                res.send(xmlString);
            });
        } else {*/
    xmlArrayBuilder('item', [], false, (xmlString) => {
        res.send(xmlString);
    });
    /*}
    });*/
});
app.get('/api/items/now/', (req, res, next) => {
    getItemConfiguration((err, results) => {
        console.log(results);
        if (err) { res.json(err) };
        if (results) {
            res.json(results);
        } else {
            res.json({ 'efficiency': 0 });
        }
    });
});


app.get('/api/machine/state/:serialNumber/xml', (req, res, next) => {
    res.set('Content-Type', 'text/xml');

    getTickerBySerial(req.params.serialNumber, (err, results) => {
        xmlMachineStateBuilder(results[0], (xmlString) => {
            res.send(xmlString);
        });
    });
});
app.get('/api/machine/state/:serialNumber', (req, res, next) => {
    getTickerBySerial(req.params.serialNumber, (err, results) => {
        res.json(results);
    });
});



app.get('/api/machine/levelone/multilaneDemo/xml', (req, res, next) => {
    res.set('Content-Type', 'text/xml');

    let machineJSON = {
        'fault': {
            'code': 3,
            'name': 'Stop'
        }
    };

    let lanesJSON = [{
        'operator': {
            'id': null,
            'name': 'None Entered'
        },
        'task': {
            'id': 24,
            'name': 'BarMop'
        },
        'pace': {
            'standard': 1380,
            'current': 0
        },
        'timeOnTask': 0,
        'totalCount': 0,
        'efficiency': 0,
    }, {
        'operator': {
            'id': null,
            'name': 'None Entered'
        },
        'task': {
            'id': 24,
            'name': 'BarMop'
        },
        'pace': {
            'standard': 1380,
            'current': 0
        },
        'timeOnTask': 0,
        'totalCount': 0,
        'efficiency': 0,
    }, {
        'operator': {
            'id': null,
            'name': 'None Entered'
        },
        'task': {
            'id': 24,
            'name': 'BarMop'
        },
        'pace': {
            'standard': 1380,
            'current': 0
        },
        'timeOnTask': 0,
        'totalCount': 0,
        'efficiency': 0,
    }, {
        'operator': {
            'id': null,
            'name': 'None Entered'
        },
        'task': {
            'id': 24,
            'name': 'BarMop'
        },
        'pace': {
            'standard': 1380,
            'current': 0
        },
        'timeOnTask': 0,
        'totalCount': 0,
        'efficiency': 0,
    }];



    let levelOneBuilder = new xml.Builder({ renderOpts: { 'pretty': false }, rootName: 'levelOne' });
    let xmlString = levelOneBuilder.buildObject(machineJSON);
    let splitArray = xmlString.split('</levelOne>');
    xmlString = splitArray[0];
    xmlString += xmlArrayBuilder('lane', lanesJSON, true);
    xmlString += '</levelOne>';

    res.send(xmlString);
});

app.get('/api/machine/levelone/:serialNumber/xml/', (req, res, next) => {
    res.set('Content-Type', 'text/xml');

    let jsonPackage = {
        'operator': {
            'id': null,
            'name': 'None Entered'
        },
        'task': {
            'id': 24,
            'name': 'BarMop'
        },
        'pace': {
            'standard': 1380,
            'current': 0
        },
        'timeOnTask': 0,
        'totalCount': 0,
        'efficiency': 0,
        'fault': {
            'code': 3,
            'name': 'Stop'
        }
    };

    let levelOneBuilder = new xml.Builder({ renderOpts: { 'pretty': false }, rootName: 'levelOne' });
    let xmlString = levelOneBuilder.buildObject(jsonPackage);

    res.send(xmlString);
});

app.get('/api/machine/leveltwo/:serialNumber/xml/', (req, res, next) => {
    res.set('Content-Type', 'text/xml');

    let jsonPackage = {
        'timers': {
            'run': 63,
            'down': 0,
            'total': 63
        },
        'programNumber': 2,
        'item': {
            'id': 1,
            'name': 'Incontinent Pad',
        },
        'currentStats': {
            'pace': 640,
            'count': 284
        },
        'totals': {
            'in': 2493,
            'out': 2384,
            'thru': 95.63,
            'faults': 3,
            'jams': 14
        },
        'availability': 86.55,
        'oee': 68.47,
        'operatorEfficiency': 68.47
    };

    let levelTwoBuilder = new xml.Builder({ renderOpts: { 'pretty': false }, rootName: 'levelTwo' });
    let xmlString = levelTwoBuilder.buildObject(jsonPackage);

    res.send(xmlString);
});

/** Configuration FUDs */
/*** Item Config Functions */
async function getItemConfiguration(callback) {
    let collection, items;
    collection = db.collection('items');
    try {
        items = await collection.find({'active': true}).project({ '_id': 0, 'active': 0 }).toArray();
        callback(null, items);
    } catch (error) {
        callback(error);
    }
}

async function upsertItemConfiguration(id, updateObject, callback) {
    let collection, items;
    collection = db.collection('items');
    try {
        items = await collection.updateOne({ '_id': id }, { '$set': updateObject }, { 'upsert': true });
        callback(null, items);
    } catch (error) {
        callback(error);
    }
}

async function deleteItemConfiguration(id, callback) {
    let collection, items;
    collection = db.collection('items');
    try {
        items = await collection.deleteOne({ '_id': id });
        callback(null, items);
    } catch (error) {
        callback(error);
    }
}

/*** Item Config Routes */
app.get('/api/items/config/xml', (req, res, next) => {
    res.set('Content-Type', 'text/xml');
    getItemConfiguration((err, results) => {
        if (err) {
            res.send(builder.buildObject(err))
        } else if (results) {

            let xmlString = xmlArrayBuilder('item', results, true);
            res.send(xmlString);

            /*xmlArrayBuilder('item', results, false, (xmlString) => {
            });*/
        } else {
            xmlArrayBuilder('item', [], false, (xmlString) => {
                res.send(xmlString);
            });
        }
    });
});
app.get('/api/items/config/', (req, res, next) => {
    
    getItemConfiguration((err, results) => {
        if (err) {
            res.json(err)
        } else if (results) {
            res.json(results);
        } else {
            res.json({ 'efficiency': 0 });
        }
    });
});
app.put('/api/items/config/:id', (req, res, next) => {
    const id = req.params.id;
    let updates = req.body;
    if (updates._id) {
        delete updates._id;
    };
    upsertItemConfiguration(id, updates, (err, results) => {
        if (err) {
            res.json(err)
        } else if (results) {
            res.json(results);
        } else {
            res.json({});
        }
    });
});
app.delete('/api/items/config/:id', (req, res, next) => {
    const id = req.params.id;
    deleteItemConfiguration(id, (err, results) => {
        if (err) {
            res.json(err)
        } else if (results) {
            res.json(results);
        } else {
            res.json({});
        }
    });
});


/*** Machine Config Functions */
async function getMachineConfiguration(callback) {
    let collection, machines;
    collection = db.collection('machines');
    try {
        machines = await collection.find({'active': true}).project({ '_id': 0, 'active': 0 }).toArray();
        callback(null, machines);
    } catch (error) {
        callback(error);
    }
}

async function upsertMachineConfiguration(id, updateObject, callback) {
    let collection, machines;
    collection = db.collection('machines');
    try {
        machines = await collection.updateOne({ '_id': id }, { '$set': updateObject }, { 'upsert': true });
        callback(null, machines);
    } catch (error) {
        callback(error);
    }
}

async function deleteMachineConfiguration(id, callback) {
    let collection, machines;
    collection = db.collection('machines');
    try {
        machines = await collection.deleteOne({ '_id': id });
        callback(null, machines);
    } catch (error) {
        callback(error);
    }
}

/*** Machine Config Routes */
app.get('/api/machines/config/xml', (req, res, next) => {
    res.set('Content-Type', 'text/xml');
    //List back either the machine definitions from the DB, or if now, list the machines currently online
    getMachineConfiguration((err, results) => {
        if (err) {
            res.send(builder.buildObject(err))
        } else if (results) {
            xmlArrayBuilder('machine', results, false, (xmlString) => {
                res.send(xmlString);
            });
        } else {
            xmlArrayBuilder('machine', [], false, (xmlString) => {
                res.send(xmlString);
            });
        }
    });
});
app.get('/api/machines/config', (req, res, next) => {
    //List back either the machine definitions from the DB, or if now, list the machines currently online
    getMachineConfiguration((err, results) => {
        if (err) {
            res.json(err)
        } else if (results) {
            res.json(results);
        } else {
            res.json([]);
        }
    });
});
app.put('/api/machines/config/:id', (req, res, next) => {
    const id = req.params.id;
    let updates = req.body;
    if (updates._id) {
        delete updates._id;
    };
    upsertMachineConfiguration(id, updates, (err, results) => {
        if (err) {
            res.json(err)
        } else if (results) {
            res.json(results);
        } else {
            res.json({});
        }
    });
});
app.delete('/api/machines/config/:id', (req, res, next) => {
    const id = req.params.id;
    deleteMachineConfiguration(id, (err, results) => {
        if (err) {
            res.json(err)
        } else if (results) {
            res.json(results);
        } else {
            res.json({});
        }
    });
});


/*** Operator Config Functions */
async function getOperatorConfiguration(callback) {
    let collection, operators;
    collection = db.collection('operators');
    try {
        operators = await collection.find({'active': true}).project({ '_id': 0, 'active': 0 }).toArray();
        let operatorArray = [];
        operators.forEach((operator) => {
            let newOperator = {
                'code': operator.code,
                'name': operator.name.full
            }
            operatorArray.push(newOperator);
        });
        callback(null, operatorArray);
    } catch (error) {
        callback(error);
    }
}

async function upsertOperatorConfiguration(id, updateObject, callback) {
    let collection, operators;
    collection = db.collection('operators');
    try {
        operators = await collection.updateOne({ '_id': id }, { '$set': updateObject }, { 'upsert': true });
        callback(null, operators);
    } catch (error) {
        callback(error);
    }
}

async function deleteOperatorConfiguration(id, callback) {
    let collection, operators;
    collection = db.collection('operators');
    try {
        operators = await collection.deleteOne({ '_id': id });
        callback(null, operators);
    } catch (error) {
        callback(error);
    }
}

/*** Operator Config Routes */
app.get('/api/operators/config/xml', (req, res, next) => {
    res.set('Content-Type', 'text/xml');
    //List back either the machine definitions from the DB, or if now, list the machines currently online
    getOperatorConfiguration((err, results) => {
        if (err) {
            res.send(builder.buildObject(err))
        } else if (results) {
            xmlArrayBuilder('operator', results, false, (xmlString) => {
                res.send(xmlString);
            });
        } else {
            xmlArrayBuilder('operator', [], false, (xmlString) => {
                res.send(xmlString);
            });
        }
    });
});
app.get('/api/operators/config', (req, res, next) => {
    //List back either the machine definitions from the DB, or if now, list the machines currently online
    getOperatorConfiguration((err, results) => {
        if (err) {
            res.json(err)
        } else if (results) {
            res.json(results);
        } else {
            res.json([]);
        }
    });
});
app.put('/api/operators/config/:id', (req, res, next) => {
    const id = req.params.id;
    let updates = req.body;
    if (updates._id) {
        delete updates._id;
    };
    upsertOperatorConfiguration(id, updates, (err, results) => {
        if (err) {
            res.json(err);
        } else if (results) {
            res.json(results);
        } else {
            res.json({});
        }
    });
});
app.delete('/api/operators/config/:id', (req, res, next) => {
    const id = req.params.id;
    deleteOperatorConfiguration(id, (err, results) => {
        if (err) {
            res.json(err)
        } else if (results) {
            res.json(results);
        } else {
            res.json({});
        }
    });
});

/*** Fault Config Functions */
async function getFaultConfiguration(callback) {
    let collection, faults;
    collection = db.collection('faults');
    try {
        faults = await collection.find().project({ '_id': 0, 'active': 0 }).toArray();
        callback(null, faults);
    } catch (error) {
        callback(error);
    }
}

async function upsertFaultConfiguration(id, updateObject, callback) {
    let collection, faults;
    collection = db.collection('faults');
    try {
        faults = await collection.updateOne({ '_id': id }, { '$set': updateObject }, { 'upsert': true });
        callback(null, faults);
    } catch (error) {
        callback(error);
    }
}

async function deleteFaultConfiguration(id, callback) {
    let collection, faults;
    collection = db.collection('faults');
    try {
        faults = await collection.deleteOne({ '_id': id });
        callback(null, faults);
    } catch (error) {
        callback(error);
    }
}

/*** Fault Config Routes */
app.get('/api/faults/config/xml', (req, res, next) => {
    res.set('Content-Type', 'text/xml');
    getFaultConfiguration((err, results) => {
        if (err) {
            res.send(builder.buildObject(err));
        } else if (results) {
            xmlArrayBuilder('fault', results, false, (xmlString) => {
                res.send(xmlString);
            });
        } else {
            xmlArrayBuilder('fault', [], false, (xmlString) => {
                res.send(xmlString);
            });
        }
    });
});
app.get('/api/faults/config/', (req, res, next) => {
    getFaultConfiguration((err, results) => {
        if (err) {
            res.json(err);
        } else if (results) {
            res.json(results);
        } else {
            res.json({ 'efficiency': 0 });
        }
    });
});
app.put('/api/faults/config/:id', (req, res, next) => {
    const id = req.params.id;
    let updates = req.body;
    if (updates._id) {
        delete updates._id;
    };
    upsertFaultConfiguration(id, updates, (err, results) => {
        if (err) {
            res.json(err);
        } else if (results) {
            res.json(results);
        } else {
            res.json({});
        }
    });
});
app.delete('/api/faults/config/:id', (req, res, next) => {
    const id = req.params.id;
    deleteFaultConfiguration(id, (err, results) => {
        if (err) {
            res.json(err);
        } else if (results) {
            res.json(results);
        } else {
            res.json({});
        }
    });
});







/*app.get('/api/shifts/:today', (req, res, next) => {
    if (req.params.today) {

    } else {

    }

});

app.get('/api/machines/:startDate/:endDate', (req, res, next) => {

});*/

/** Commented but kept for posterity 12-20-23 RTI II */

/*app.get('/api/benchmarks/1', (req, res, next) => {
    let benchmarks = {};
    benchmarkStart = moment();
    promiseQuery18SinceDate('2018-11-20T00:00:00-06:00', 'aggMonth').then((results) => {
        benchmarkEnd = moment();
        let benchmarkTime = moment.duration(benchmarkEnd.diff(benchmarkStart));
        benchmarks['cacheData'] = {
            'data': results,
            'elapsed': benchmarkTime
        };
        benchmarkStart = moment();
        sqlQuery18SinceDate('2018-11-20', (err, results) => {
            benchmarkEnd = moment();
            benchmarkTime = moment.duration(benchmarkEnd.diff(benchmarkStart));
            benchmarks['sqlData'] = {
                //'data': results,
                'elapsed': benchmarkTime
            };
            res.json(benchmarks);
        });
    });
});

app.get('/api/benchmarks/2', (req, res, next) => {
    let benchmarks = {};
    benchmarkStart = moment();
    promiseQuery18SinceDate('2018-11-13T00:00:00-06:00', 'aggMonth').then((results) => {
        benchmarkEnd = moment();
        let benchmarkTime = moment.duration(benchmarkEnd.diff(benchmarkStart));
        benchmarks['cacheData'] = {
            'data': results,
            'elapsed': benchmarkTime
        };
        benchmarkStart = moment();
        sqlQuery18SinceDate('2018-11-13', (err, results) => {
            benchmarkEnd = moment();
            benchmarkTime = moment.duration(benchmarkEnd.diff(benchmarkStart));
            benchmarks['sqlData'] = {
                //'data': results,
                'elapsed': benchmarkTime
            };
            res.json(benchmarks);
        });
    });
});

app.get('/api/benchmarks/3', (req, res, next) => {
    let benchmarks = {};
    benchmarkStart = moment();
    promiseQuery18SinceDate('2018-10-20T00:00:00-06:00', 'aggMonth').then((results) => {
        benchmarkEnd = moment();
        let benchmarkTime = moment.duration(benchmarkEnd.diff(benchmarkStart));
        benchmarks['cacheData'] = {
            'data': results,
            'elapsed': benchmarkTime
        };
        benchmarkStart = moment();
        sqlQuery18SinceDate('2018-10-20', (err, results) => {
            benchmarkEnd = moment();
            benchmarkTime = moment.duration(benchmarkEnd.diff(benchmarkStart));
            benchmarks['sqlData'] = {
                //'data': results,
                'elapsed': benchmarkTime
            };
            res.json(benchmarks);
        });
    });
});

app.get('/api/benchmarks/4', (req, res, next) => {
    let benchmarks = {};
    benchmarkStart = moment();
    promiseQuery18SinceDate('2018-01-01T00:00:00-06:00', 'aggView').then((results) => {
        benchmarkEnd = moment();
        let benchmarkTime = moment.duration(benchmarkEnd.diff(benchmarkStart));
        benchmarks['cacheData'] = {
            'data': results,
            'elapsed': benchmarkTime
        };
        benchmarkStart = moment();
        sqlQuery18SinceDate('2018-01-01', (err, results) => {
            benchmarkEnd = moment();
            benchmarkTime = moment.duration(benchmarkEnd.diff(benchmarkStart));
            benchmarks['sqlData'] = {
                //'data': results,
                'elapsed': benchmarkTime
            };
            res.json(benchmarks);
        });
    });
});*/

async function initializeCollections() {
    logger.info('Initializing machines collection...');
    await cm.createCollection('machines').then(() => {
        let machinesCollection = db.collection('machines');
        machinesCollection.insertMany(defaults.machines);
        logger.info('Machines collection initialized!');
    }).catch((error) => {
        if (error.codeName == 'NamespaceExists') {
            logger.info('Machines collection already initialized!');
        } else {
            logger.error(error.toString());
        }
    });

    logger.info('Initializing items collection...');
    await cm.createCollection('items').then(() => {
        let machinesCollection = db.collection('items');
        machinesCollection.insertMany(defaults.items);
        logger.info('Items collection initialized!');
    }).catch((error) => {
        if (error.codeName == 'NamespaceExists') {
            logger.info('Items collection already initialized!');
        } else {
            logger.error(error.toString());
        }
    });

    logger.info('Initializing faults collection...');
    await cm.createCollection('faults').then(() => {
        let machinesCollection = db.collection('faults');
        machinesCollection.insertMany(defaults.faults);
        logger.info('Faults collection initialized!');
    }).catch((error) => {
        if (error.codeName == 'NamespaceExists') {
            logger.info('Faults collection already initialized!');
        } else {
            logger.error(error.toString());
        }
    });

    logger.info('Initializing operators collection...');
    await cm.createCollection('operators').then(() => {
        let machinesCollection = db.collection('operators');
        machinesCollection.insertMany(defaults.operators);
        logger.info('Operators collection initialized!');
    }).catch((error) => {
        if (error.codeName == 'NamespaceExists') {
            logger.info('Operators collection already initialized!');
        } else {
            logger.error(error.toString());
        }
    });
}

connectMongo(dbClient, async (err, client) => {
    
    db = connectDB(client, config.mongo.db);
    logger = new winston(db);
    cm = new collectionManager(db, logger);
    await app.listen(port, () => logger.info(`ChiTracAPI listening on port ${port}`));
    //initializeCollections();
    

    

    connectSQL((err) => {
        if (err) logger.error(err);
        //dataCacheSync((err) => {

        //setTimeout(dataCacheSyncPoll, 500);
        //});
    });
});