/*** alpha API controller */
/*** Contributors: RTI II */

/** MODULE REQUIRES */
const express = require('express');
const router = express.Router();
const { DateTime, Duration } = require('luxon'); //For handling dates and times
const mongo = require('mongodb').ObjectID;

module.exports = function(server) {
    return constructor(server);
}

function constructor(server) {
    const db = server.db;

    function cursorCurrentMachines() {
        return null;
    }

    function cursorOperatorEfficiency(startDate, serialNumber, lane) {
        let collection = db.collection('operatorRealtime');
        let pipeline = [{
            '$match': {
                'machine.serial': parseInt(serialNumber),
                'timestamp': {
                    '$gte': new Date(startDate)
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
                '_id': 0,
                'station': {
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

    function getOperatorEfficiencyByLane(timeframe, serialNumber, lane, callback) {
        let timeframeString = "";
        let promise;
        let timeframeMins = 0;

        switch (timeframe) {
            case 'fiveMinute':
                timeframeMins = 5;
                promise = cursorOperatorEfficiency(DateTime.now().minus({ minutes: 5 }).toISO(), serialNumber, lane).toArray();
                break;
            case 'current':
                timeframeMins = 6;
                promise = cursorOperatorEfficiency(DateTime.now().minus({ minutes: 6 }).toISO(), serialNumber, lane).toArray();
                break;
            case 'fifteenMinute':
                timeframeMins = 15;
                promise = cursorOperatorEfficiency(DateTime.now().minus({ minutes: 15 }).toISO(), serialNumber, lane).toArray();
                break;
            case 'hourly':
                timeframeMins = 60;
                promise = cursorOperatorEfficiency(DateTime.now().minus({ hour: 1 }).toISO(), serialNumber, lane).toArray();
                break;
            case 'daily':
            default:
                timeframeMins = DateTime.now().diff(DateTime.now().startOf('day'), 'minutes');
                promise = cursorOperatorEfficiency(DateTime.now().startOf('day').toISO(), serialNumber, lane).toArray();
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

    function getTickerBySerial(serialNumber, callback) {
        let promise = cursorTickerAgg(parseInt(serialNumber)).project({ '_id': 0 }).toArray();

        promise.then((results) => {
            results[0].timers['onDuration'] = Duration.fromObject({ seconds: results[0].timers.onTime }).toFormat('hh:mm:ss');
            callback(null, results);
        });
    }

    function getMachineLevelOneBase(serialNumber, callback) {
        let projectObject = {
            _id: 0,
            machineInfo: {
                serial: '$machine.serial',
                name: '$machine.name'
            },
            status: '$status',
            fault: '$fault',
            timeOnTask: '$timers.runTime',
            totalCount: '$totals.oneLane',
            items: '$items'
        }
        let promise = cursorTickerAgg(parseInt(serialNumber)).project(projectObject).toArray();

        promise.then((results) => {
            callback(null, results);
        });
    }

    router.get('/operator/realtime/:serialNumber/:lane/:timeframe', (req, res, next) => {
        getOperatorEfficiencyByLane(req.params.timeframe, req.params.serialNumber, req.params.lane, (err, results) => {
            res.json(results);
        });
    });

    router.get('/machine/state/all', (req, res, next) => {
        let returnArray = [];
        getMachineLevelOneBase(60022, (err, results) => {
            results[0]['operators'] = [
                { id: 117811, "name": "Shaun White", pace: 600, timeOnTask: 360, count: 60, efficiency: 96, station: 1, tasks: [{ "name": "Pool Towel", "standard": 625 } ] },
                { id: 118347, "name": "Hannah Teter", pace: 613, timeOnTask: 360, count: 61, efficiency: 98.08, station: 2, tasks: [{ "name": "Bath Towel", "standard": 625 }] },
                { id: 119277, "name": "Torah Bright", pace: 407, timeOnTask: 360, count: 41, efficiency: 65.12, station: 3, tasks: [{ "name": "Pool Towel", "standard": 625 } ] }
            ];
            returnArray.push(results[0]);
            getMachineLevelOneBase(63302, (err, results) => {
                results[0]['operators'] = [
                    { id: 159375, "name": "Jeremy Jones", pace: 543, timeOnTask: 360, count: 54, efficiency: 86.88, station: 4, tasks: [{ "name": "Bath Towel", "standard": 625 } ] }
                ];
                returnArray.push(results[0]);
                getMachineLevelOneBase(61616, (err, results) => {
                    results[0]['operators'] = [
                        { id: 119277, "name": "Torah Bright", pace: 407, timeOnTask: 360, count: 41, efficiency: 65.12, station: 3, tasks: [{ "name": "Pool Towel", "standard": 625 }] },
                        { id: 159375, "name": "Jeremy Jones", pace: 543, timeOnTask: 360, count: 54, efficiency: 86.88, station: 4, tasks: [{ "name": "Bath Towel", "standard": 625 }] }
                    ];
                    returnArray.push(results[0]);
                    res.json(returnArray);
                });
            });
        });
    });


    router.get('/machine/state/:serialNumber', (req, res, next) => {
        getMachineLevelOneBase(req.params.serialNumber, (err, results) => {
            res.json(results);
        });
    });


    return router;
}