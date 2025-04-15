/*** alpha API controller */
/*** Contributors: RTI II */

/** MODULE REQUIRES */
const express = require('express');
const router = express.Router();
const { DateTime, Duration, Interval } = require('luxon'); //For handling dates and times
const ObjectId = require('mongodb').ObjectId;
const startupDT = DateTime.now();
const bcrypt = require('bcryptjs');


module.exports = function(server) {
    return constructor(server);
}

function constructor(server) {
    const db = server.db;
    const logger = server.logger;
    const passport = server.passport;

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

    function ZZZgetMachineLevelOneBase(serialNumber, callback) {
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

    const getMachinesLevelOneBase = async function() {
        const projectObject = {
            _id: 0,
            machineInfo: {
                serial: '$machine.serial',
                name: '$machine.name'
            },
            status: {
                code: '$status.code',
                name: '$status.name',
                color: '$status.softrolColor'
            },
            fault: '$fault',
            timeOnTask: '$timers.runTime',
            onTime: '$timers.onTime',
            totalCount: '$totals.oneLane',
            items: '$items'
        }

        let tickerPromise = [];
        try {

            tickerPromise = await db.collection('ticker').find().sort({ "machine.name": 1 }).project(projectObject).toArray();
            tickerPromise = tickerPromise.map((machine) => {
                machine.operators = [];
                return machine;
            });
        } catch (error) {
            logger.error(error);
        } finally {
            return tickerPromise
        }
    }

    const getTicker = async function() {
        let tickerPromise = [];
        try {
            tickerPromise = await db.collection('ticker').find().project({
                _id: 0,
                lpOperators: 1,
                spOperators: 1,
                machine: 1,
                mode: 1,
                status: {
                    code: '$status.code',
                    name: '$status.name',
                    color: '$status.softrolColor'
                },
                fault: '$fault',
                timeOnTask: '$timers.runTime',
                onTime: '$timers.onTime',
                totalCount: '$totals.oneLane',
                items: '$items'
            }).sort({ "machine.name": 1 }).toArray();
        } catch (error) {
            logger.error(error);
        } finally {
            return tickerPromise
        }
    }

    const getMachineListFromTicker = async function() {
        let tickerPromise = [];
        try {
            tickerPromise = await db.collection('ticker').find().project({
                _id: 0,
                lpOperators: 1,
                spOperators: 1,
                machine: 1,
                mode: 1,
                status: {
                    code: '$status.code',
                    name: '$status.name',
                    color: '$status.softrolColor'
                },
                fault: '$fault',
                timeOnTask: '$timers.runTime',
                onTime: '$timers.onTime',
                totalCount: '$totals.oneLane',
                items: '$items'
            }).sort({ "machine.name": 1 }).toArray();
        } catch (error) {
            logger.error(error);
        } finally {
            return tickerPromise;
        }
    }

    const getOperatorListFromTicker = async function() {
        let machineList = await getMachineListFromTicker();
        const operatorLists = machineList.map((machine) => {
            if (machine.mode === 'largePiece') {
                const operators = machine.lpOperators.map((operator) => {
                    return { serial: machine.machine.serial, id: operator.id, station: operator.station }
                });
                return operators;
            } else {
                const operators = machine.spOperators.map((operator) => {
                    return { serial: machine.machine.serial, id: operator.id, station: operator.station }
                });
                return operators;
            }
        });

        const operatorList = operatorLists.reduce((finalList, operatorList) => {
            return finalList.concat(operatorList);
        }, [])

        return operatorList;
    }

    const getOperatorCounts = async function(operatorInfo) {
        const pipeline = [{
            '$match': {
                'timestamp': { $gte: new Date(DateTime.now().minus({ hours: 6 }).toISO()) },
                'machineSerial': operatorInfo.serial,
                'operatorID': operatorInfo.id,
                'station': operatorInfo.station
            }
        }, {
            '$group': {
                '_id': '$itemNumber',
                'item': {
                    '$last': '$itemName'
                },
                'station': {
                    '$last': '$station'
                },
                'onTime': {
                    '$sum': '$onTime'
                },
                'runTime': {
                    '$sum': '$runTime'
                },
                'itemCount': {
                    '$sum': {
                        '$sum': '$itemCount'
                    }
                },
                'standard': {
                    '$last': '$itemStandard'
                },
                'machineSerial': {
                    '$last': '$machineSerial'
                },
                'machineName': {
                    '$last': '$machineName'
                },
                'operatorID': {
                    '$last': '$operatorID'
                }
            }
        }];

        return db.collection('newOperatorCount').aggregate(pipeline);
    }

    const ZZZgetAllOperatorCounts = async function() {

        const operatorList = await getOperatorListFromTicker();

        let returnArray = [getOperatorCounts(operatorList[0]), getOperatorCounts(operatorList[1])];

        const operatorCountPromises = operatorList.map((operator) => {
            return getOperatorCounts(operator);
        });

        await Promise.all(operatorCountPromises).then((promises) => {
            logger.error(operatorCountPromises);
            logger.error(promises);
            return { promises: promises };
        });


        /*for await (const promise of operatorCountPromises) {
            for await (const doc of promise) {
                returnArray.push(doc);
            }
        }*/

        /*const operatorCounts = operatorCountPromises.map(async (promise) => {
            return promise;
        });*/

        /*return returnArray.sort((a, b) => {
            return a.machineSerial < b.machineSerial;
        });*/

    }



    const getMachineOperatorLists = async function() {
        let machineList = await getMachineListFromTicker();
        const operatorLists = machineList.map((machine) => {
            if (machine.mode === 'largePiece') {
                const operators = machine.lpOperators.map((operator) => {
                    return { serial: machine.machine.serial, id: operator.id, station: operator.station }
                });
                return operators;
            } else {
                const operators = machine.spOperators.map((operator) => {
                    return { serial: machine.machine.serial, id: operator.id, station: operator.station }
                });
                return operators;
            }
        });
        return operatorLists;
    }

    const getOperatorListCounts = async function() {

    }


    const getMachineOperatorCounts = async function(machine) {
        let operatorCountPromises = machine.map((operator) => {
            return getOperatorCounts(operator);
        });

        let returnArray = [];
        for await (const promise of operatorCountPromises) {
            for await (const doc of promise) {
                returnArray.push(doc);
            }
        }

        return returnArray;
    }

    const getMachineOperatorStats = async function(machine) {
        let operatorsCounts = machine.map((operator) => {
            return getOperatorCounts(operator);
        });

        let returnArray = [];
        for await (const operatorsCount of operatorsCounts) {
            let machineArray = [];
            //TODO: station needs to become item, these are actually records of stats by item for each operator
            //for await (const station of operatorsCount) {
            const arr = await operatorsCount.toArray();
            logger.error(arr);
            if (arr[0]) {
                const station = arr[0];
                let stationStats = {
                    station: station.station,
                    machine: station.machineName,
                    item: station.item,
                    count: station.itemCount,
                    operatorID: station.operatorID,
                    operatorName: station.operatorName,
                    standard: station.standard,
                    runTime: station.runTime
                }
                let efficiency = 0;
                if (station['runTime'] != undefined) {
                    efficiency = parseInt(((station.itemCount / (station.runTime / 60)) / (station.standard / 60)) * 60);
                }
                //returnArray.push(stationStats);

                let opObject = {
                    id: station.operatorID || 420,
                    name: station.operatorName || 'Operator',
                    pace: parseInt(station.standard * (efficiency / 100)) || 0,
                    timeOnTask: station.runTime || 0,
                    onTime: station.onTime || 0,
                    count: station.itemCount || 0,
                    efficiency: efficiency || 0,
                    station: station.station || 0,
                    tasks: [{
                        name: station.item || 'None Entered',
                        standard: station.standard || 0,
                    }],
                    //machineSerial: station.machineSerial
                }
                //machineArray.push(opObject);
                returnArray.push(opObject);

            }
        }

        return returnArray;
    }

    const getAllOperatorCounts = async function() {
        const machineList = await getMachineOperatorLists();
        let resultArray = [];
        for await (const machine of machineList) {
            const machineOperatorCounts = await getMachineOperatorCounts(machine);
            resultArray.push(machineOperatorCounts);
        }
        return resultArray;
    }

    router.get('/timestamp', (req, res, next) => {
        res.json(startupDT);
    });

    router.get('/currentTime/get', async (req, res, next) => {
        const currentDT = DateTime.now();
        const formatString = 'yyyy-LL-dd-TT.SSS'
        //res.json(DateTime.now().toISO());
        const responseJSON = {
            currentTime: currentDT.toUTC().toFormat(formatString),
            currentLocalTime: currentDT.toFormat(formatString),
            timezone: currentDT.toFormat('z'),
            timezoneOffset: currentDT.toFormat('ZZZ')
        }
        res.json(responseJSON);
    });

    router.get('/ac360/get', async (req, res, next) => {
        res.json('Hello AC360!');
    });

    router.get('/ac360/lastSession/get', async (req, res, next) => {
        let lastSessionStart, lastSessionEnd;
        let lastSessionStartTS, lastSessionEndTS;
        let diff;
        const statusCollection = db.collection('ac360-status');
        const countCollection = db.collection('ac360-count');
        const stackCollection = db.collection('ac360-stack');

        const lastStatusFind = await statusCollection.find({ 'machineInfo.serial': 67421 }).sort({ timestamp: -1 }).limit(1).toArray();
        const lastStatus = Object.assign({}, lastStatusFind[0]);
        if (lastStatus.status.code == 0) { //System_Paused
            //Machine is currently paused, find the start of the session, then find the counts in the session
            let lastRunningStatusFind = await statusCollection.find({ 'machineInfo.serial': 67421, timestamp: { $lt: new Date(lastStatus.timestamp) } }).sort({ timestamp: -1 }).limit(1).toArray();
            lastSessionStart = lastRunningStatusFind[0];
            lastSessionStartTS = new Date(lastSessionStart.timestamp);
            lastSessionEnd = lastStatus;
            lastSessionEndTS = new Date(lastSessionEnd.timestamp);
        } else if (lastStatus.status.code == 1) {
            lastSessionStart = lastStatus;
            lastSessionStartTS = new Date(lastSessionStart.timestamp);
        }

        let queryObject = {
            'machineInfo.serial': 67421
        }

        if (lastSessionEndTS) {
            queryObject['timestamp'] = {
                $gte: lastSessionStartTS,
                $lte: lastSessionEndTS
            }
            diff = Interval.fromDateTimes(DateTime.fromISO(lastSessionStartTS.toISOString()), DateTime.fromISO(lastSessionEndTS.toISOString()));
        } else {
            queryObject['timestamp'] = {
                $gte: lastSessionStartTS
            }
            diff = Interval.fromDateTimes(DateTime.fromISO(lastSessionStartTS.toISOString()), DateTime.now());
        }

        const countsFind = await countCollection.find(queryObject).sort({ timestamp: 1 }).toArray();
        const stacksFind = await stackCollection.find(queryObject).sort({ timestamp: 1 }).toArray();

        const sessionDuration = Duration.fromMillis(diff.length());
        const sessionDurationString = sessionDuration.as('seconds') > 60 ? sessionDuration.as('minutes') + ' minutes' : sessionDuration.as('seconds') + ' seconds';

        res.json({ duration: sessionDurationString, countTotal: countsFind.length, stackTotal: stacksFind.length, counts: countsFind, stacks: stacksFind });
    });

    router.post('/ac360/post', async (req, res, next) => {
        let bodyJSON = Object.assign({}, req.body);
        if (bodyJSON.timestamp) {
            bodyJSON.timestamp = new Date(DateTime.fromISO(bodyJSON.timestamp + 'Z'));
            //bodyJSON.timestamp = new Date(DateTime.fromFormat(bodyJSON.timestamp + '+0', "yyyy-MM-dd'T'HH:mm:ss.SSSZ").toISO());
        }

        let storeJSON = Object.assign({}, bodyJSON);
        if (req.socket.remoteAddress) {
            const ipStrings = req.socket.remoteAddress.split(':');
            storeJSON.machineInfo['ipAddress'] = '' + ipStrings[ipStrings.length - 1];
        }
        const machine = Object.assign({}, storeJSON.machineInfo);
        const program = Object.assign({ mode: 'ac360' }, storeJSON.programInfo);
        const operators = [{ id: storeJSON.operatorInfo.code, name: storeJSON.operatorInfo.name }];

        let collection = db.collection('ac360');
        if (storeJSON.status) {
            collection = db.collection('ac360-status');

            const status = Object.assign({}, storeJSON.status);

            const state = {
                timestamp: storeJSON.timestamp,
                machine: {
                    serial: machine.serial,
                    name: 'SPF' + machine.name.slice(-1),
                    ipAddress: machine.ipAddress,
                },
                program: program,
                operators: operators,
                status: status
            }

            const stateTickerResult = await db.collection('stateTicker').replaceOne({ 'machine.serial': machine.serial }, state, { upsert: true });
            const stateResult = await db.collection('state').insertOne(state);
        } else if (storeJSON.item) {
            collection = db.collection('ac360-count');

            const operator = Object.assign({}, storeJSON.operatorInfo);
            const item = Object.assign({}, storeJSON.item);
            

            const formattedCount = {
                timestamp: storeJSON.timestamp,
                machine: {
                    serial: machine.serial,
                    name: 'SPF' + machine.name.slice(-1),
                    ipAddress: machine.ipAddress
                },
                program: program,
                operator: {
                    id: operator.code,
                    name: operator.name
                },
                item: {
                    id: item.id ? item.id : 0,
                    //count: item.count,
                    name: item.name,
                    standard: program.pace
                },
                station: 1,
                lane: item.sortNumber
            }
            logger.debug('here');
            const insertFormattedCount = await db.collection('count').insertOne(formattedCount);

            const state = {
                timestamp: storeJSON.timestamp,
                machine: {
                    serial: machine.serial,
                    name: 'SPF' + machine.name.slice(-1),
                    ipAddress: machine.ipAddress,
                },
                program: program,
                operators: operators,
                status: {
                    code: 1,
                    name: "System_Running"
                }
            }

            const result = await db.collection('stateTicker').replaceOne({ 'machine.serial': machine.serial }, state, { upsert: true });
        } else if (storeJSON.stack) {
            collection = db.collection('ac360-stack');
        }
        const result = await collection.insertOne(storeJSON);


        if (req.is('application/json')) {
            res.json({ receivedBody: storeJSON });
        } else if (req.body) {
            res.send(storeJSON);
        } else {
            res.json('No body received');
        }
    });

    /*router.get('/levelone/all', async (req, res, next) => {
        const stateCollection = db.collection('state');
        const stateTickerCollection = db.collection('stateTicker');
        const countCollection = db.collection('count');

        const currentDateTime = DateTime.now().minus({ minutes: 6 }).toISO();
        const nowDateTime = DateTime.now().toISO();
        const startDate = new Date(currentDateTime);

        const activeMachineStates = await stateTickerCollection.find().sort({ "machine.name": 1 }).toArray();

        async function machineSessions(serial) {

            let sessionArray = [];

            const machineStatesHistorySinceStart = await stateCollection.find({ 'machine.serial': parseInt(serial), status: { $ne: null }, 'timestamp': { '$gte': new Date(currentDateTime) } }).sort({ timestamp: -1 }).toArray();
            const machineStatesHistoryPreviousOne = await stateCollection.find({ 'machine.serial': parseInt(serial), status: { $ne: null }, 'timestamp': { '$lte': new Date(currentDateTime) } }).sort({ timestamp: -1 }).limit(1).toArray();
            const machineStatesHistory = machineStatesHistorySinceStart.concat(machineStatesHistoryPreviousOne);
            while (machineStatesHistory.length) {
                let lastSessionStart, lastSessionEnd;
                let lastSessionStartTS, lastSessionEndTS;
                let diff;

                do {
                    lastSessionStart = machineStatesHistory.pop();

                    if (lastSessionStart.status.code == 1) {
                        const lastSessionStartTSCheck = new Date(lastSessionStart.timestamp);
                        if (startDate > lastSessionStartTSCheck) {
                            lastSessionStartTS = startDate;
                        } else {
                            lastSessionStartTS = new Date(lastSessionStart.timestamp);
                        }
                    }
                } while (machineStatesHistory.length && lastSessionStart.status.code != 1) //HERE, NEED TO CONTINUE UNITL END FOUND

                if (machineStatesHistory.length) {
                    do {
                        lastSessionEnd = machineStatesHistory.pop();
                    } while (machineStatesHistory.length && lastSessionEnd.status.code == 1)
                    if (!lastSessionEnd || lastSessionEnd.status.code == 1) {
                        lastSessionEndTS = new Date();
                    } else {
                        lastSessionEndTS = new Date(lastSessionEnd.timestamp);
                    }
                } else {
                    lastSessionEndTS = new Date();
                }

                if (lastSessionStartTS && lastSessionEndTS) {
                    diff = Interval.fromDateTimes(DateTime.fromISO(lastSessionStartTS.toISOString()), DateTime.fromISO(lastSessionEndTS.toISOString()));
                } else if (lastSessionStartTS) {
                    lastSessionEndTS = new Date();
                    diff = Interval.fromDateTimes(DateTime.fromISO(lastSessionStartTS.toISOString()), DateTime.fromISO(lastSessionEndTS.toISOString()));
                }

                if (diff) {
                    const sessionDuration = Duration.fromMillis(diff.length());
                    const sessionDurationString = sessionDuration.as('seconds') > 60 ? sessionDuration.as('minutes') + ' minutes' : sessionDuration.as('seconds') + ' seconds';
                    let sessionObject = { start: DateTime.fromISO(lastSessionStartTS.toISOString()), duration: sessionDuration.as('seconds') }
                    sessionObject['end'] = DateTime.fromISO(lastSessionEndTS.toISOString());
                    sessionArray.push(sessionObject);
                }

            }
            return sessionArray;
        }

        const machineRunTimesArray = await Promise.all(activeMachineStates.map(async (machineState) => {
            const serial = machineState.machine.serial;
            const arr = await machineSessions(serial);
            const machineDuration = arr.reduce((duration, session) => duration + session.duration, 0);

            const operators = await Promise.all(machineState.operators.map(async (operator) => {
                if (operator.id == 0) {
                    operator.id = serial + 900000;
                    //result.push({ id: serial + 900000, station: operator.station ? operator.station : 1 })
                }

                const pipeline = [{
                    '$match': {
                        'machine.serial': serial,
                        'operator.id': operator.id,
                        'station': operator.station ? operator.station : 1,
                        'timestamp': { '$gte': new Date(currentDateTime) }
                    }
                }, {
                    '$group': {
                        '_id': '$item.name',
                        'count': {
                            '$count': {}
                        },
                        'standard': {
                            '$first': '$item.standard'
                        },
                        'operator': { '$first': '$operator' },
                        'station': { '$first': '$station' }
                    }
                }, {
                    '$addFields': {
                        'timeCreditDenom': {
                            '$divide': [
                                '$standard', 3600
                            ]
                        }
                    }
                }, {
                    '$addFields': {
                        'timeCredit': {
                            '$divide': [
                                '$count', '$timeCreditDenom'
                            ]
                        }
                    }
                }]

                const operatorItemTotals = await countCollection.aggregate(pipeline).toArray();

                if (operatorItemTotals.length) {
                    const runTime = (parseInt(machineDuration) <= 360) ? parseInt(machineDuration) : 360;
                    const operator = operatorItemTotals[0].operator;
                    const station = operatorItemTotals[0].station;
                    const operatorTotal = operatorItemTotals.reduce((total, item) => total + item.count, 0);
                    const operatorTotalTimeCredit = operatorItemTotals.reduce((total, item) => {
                        if (item.standard < 60) {
                            return total + (item.timeCredit / 60);
                        } else {
                            return total + item.timeCredit;
                        }
                        
                    }, 0 );
                    const operatorEfficiency = parseInt((operatorTotalTimeCredit / runTime) * 100);
                    const operatorPace = (operatorTotal / (runTime / 60)) * 60;
                    const tasks = operatorItemTotals.map((item) => {
                        let standard;
                        if (item.standard < 60) {
                            standard = item.standard * 60;
                        } else {
                            standard = item.standard;
                        }
                        return {
                            name: item['_id'],
                            standard: standard
                        }
                    })
                    return {
                        id: operator.id || 0,
                        name: operator.name ? operator.name : operator.id,
                        pace: parseInt(operatorPace),
                        timeOnTask: parseInt(runTime),
                        count: parseInt(operatorTotal) || 0,
                        efficiency: operatorEfficiency,
                        station: station ? station : 1,
                        tasks: tasks
                        *//*operator: operator,
                        totals: operatorItemTotals,
                        operatorTotalTimeCredit: operatorTotalTimeCredit*//*
                    };
                }

                return;
            }));
            delete machineState.machine.ipAddress;
            if (machineState.status.softrolColor) {
                machineState.status.color = '' + machineState.status.softrolColor;
                delete machineState.status.softrolColor;
            }
            let fault = null;
            if (machineState.status.code >= 2) {
                if (machineState.status.color == null) {
                    machineState.status.color = 'Red';
                }
                fault = machineState.status;
            } else if (machineState.status.code == 1) {
                if (machineState.status.color == null) {
                    machineState.status.color = 'Green';
                }
            } else {
                if (machineState.status.color == null) {
                    machineState.status.color = 'Gray';
                }
            }
            const machineTotalCountFind = await countCollection.find({ 'machine.serial': parseInt(serial), 'timestamp': { '$gte': new Date(currentDateTime) } }).toArray();
            let items = [];
            const totalCount = machineTotalCountFind.length;
                    const itemTemplate = {
                id: 1,
                count: 0
            }
            items.push(itemTemplate);
            items.push(itemTemplate);
            items.push(itemTemplate);
            items.push(itemTemplate);
            if ()
            return { status: machineState.status, machineInfo: machineState.machine, fault: fault, timeOnTask: (parseInt(machineDuration) < 360 ? parseInt(machineDuration) : 360), onTime: (parseInt(machineDuration) < 360 ? parseInt(machineDuration) : 360), totalCount: parseInt(totalCount), items: items, operators: operators.filter(element => element != null) };
        }));
        res.json(machineRunTimesArray);
    });*/

    router.get('/levelone/all', async (req, res, next) => {
        const stateCollection = db.collection('state');
        const stateTickerCollection = db.collection('stateTicker');
        const countCollection = db.collection('count');

        //const currentDateTime = DateTime.now().toISO();
        let queryDateTime = DateTime.now().toISO();
        //const nowDateTime = DateTime.now().toISO();
        const startDate = new Date(queryDateTime);

        const activeMachineStates = await stateTickerCollection.find().sort({ "machine.name": 1 }).toArray();

        async function machineSession(serial) {
            let machineStatesMostRecentFind = await stateCollection.find({ 'machine.serial': parseInt(serial), 'status.code': { $ne: null }}).sort({ timestamp: -1 }).limit(1).toArray();
            let machineStatesMostRecent;
            let machineStatesMostRecentTimestamp;
            if (machineStatesMostRecentFind.length) {
                machineStatesMostRecent = machineStatesMostRecentFind[0];
                machineStatesMostRecentTimestamp = new Date(machineStatesMostRecent.timestamp);
            }
             
            let diff;
            if (machineStatesMostRecent.status && machineStatesMostRecent.status.code == 1) {
                let machineStatesNextMostRecent;
                do {
                    machineStatesMostRecentFind = await stateCollection.find({ 'machine.serial': parseInt(serial), 'status.code': { $ne: null }, 'timestamp': { '$lt': new Date(machineStatesMostRecentTimestamp) } }).sort({ timestamp: -1 }).limit(1).toArray();
                    if (machineStatesMostRecentFind.length) {
                        machineStatesNextMostRecent = machineStatesMostRecentFind[0];
                        if (machineStatesNextMostRecent.status.code == 1) {
                            machineStatesMostRecent = Object.assign({}, machineStatesNextMostRecent);
                            machineStatesMostRecentTimestamp = new Date(machineStatesNextMostRecent.timestamp);
                            
                        } else {
                            break;
                        }
                    } else {
                        break;
                    }
                } while (machineStatesNextMostRecent.status.code == 1)
                diff = Interval.fromDateTimes(DateTime.fromISO(machineStatesMostRecentTimestamp.toISOString()), DateTime.now());
                const sessionDuration = Duration.fromMillis(diff.length());
                const sessionObject = { start: DateTime.fromISO(machineStatesMostRecentTimestamp.toISOString()), end: DateTime.now(), duration: sessionDuration.as('seconds'), state: machineStatesMostRecent }
                return sessionObject;
            } else if (machineStatesMostRecent.status) {
                diff = Interval.fromDateTimes(DateTime.fromISO(machineStatesMostRecentTimestamp.toISOString()), DateTime.now());
                const sessionDuration = Duration.fromMillis(diff.length());
                const sessionObject = { start: machineStatesMostRecent.timestamp, end: DateTime.now(), duration: sessionDuration.as('seconds'), state: machineStatesMostRecent }
                return sessionObject;
            } else {
                const sessionObject = { start: DateTime.now(), end: DateTime.now(), duration: 0, state: machineStatesMostRecent };
                return sessionObject;
            }
        }

        const machineRunTimesArray = await Promise.all(activeMachineStates.map(async (machineState) => {
            if (machineState.status.code == 1) {
                const serial = machineState.machine.serial;
                const session = await machineSession(serial);
                //const machineDuration = arr.reduce((duration, session) => duration + session.duration, 0);
                const machineDuration = session.duration;

                const operators = await Promise.all(machineState.operators.map(async (operator) => {
                    if (operator.id == 0) {
                        operator.id = serial + 900000;
                        //result.push({ id: serial + 900000, station: operator.station ? operator.station : 1 })
                    }

                    const pipeline = [{
                        '$match': {
                            'machine.serial': serial,
                            'operator.id': operator.id,
                            'station': operator.station ? operator.station : 1,
                            'timestamp': { '$gte': new Date(session.start) }
                        }
                    }, {
                        '$group': {
                            '_id': '$item.name',
                            'count': {
                                '$count': {}
                            },
                            'standard': {
                                '$first': '$item.standard'
                            },
                            'operator': { '$first': '$operator' },
                            'station': { '$first': '$station' }
                        }
                    }, {
                        '$addFields': {
                            'timeCreditDenom': {
                                '$divide': [
                                    '$standard', 3600
                                ]
                            }
                        }
                    }, {
                        '$addFields': {
                            'timeCredit': {
                                '$divide': [
                                    '$count', '$timeCreditDenom'
                                ]
                            }
                        }
                    }]

                    const operatorItemTotals = await countCollection.aggregate(pipeline).toArray();

                    if (operatorItemTotals.length) {
                        const runTime = parseInt(machineDuration);
                        const operator = operatorItemTotals[0].operator;
                        const station = operatorItemTotals[0].station;
                        const operatorTotal = operatorItemTotals.reduce((total, item) => total + item.count, 0);
                        const operatorTotalTimeCredit = operatorItemTotals.reduce((total, item) => {
                            if (item.standard < 60) {
                                return total + (item.timeCredit / 60);
                            } else {
                                return total + item.timeCredit;
                            }

                        }, 0);
                        const operatorEfficiency = parseInt((operatorTotalTimeCredit / runTime) * 100);
                        const operatorPace = (operatorTotal / (runTime / 60)) * 60;
                        const tasks = operatorItemTotals.map((item) => {
                            let standard;
                            if (item.standard < 60) {
                                standard = item.standard * 60;
                            } else {
                                standard = item.standard;
                            }
                            return {
                                name: item['_id'],
                                standard: standard
                            }
                        })
                        return {
                            id: operator.id || 0,
                            name: operator.name ? operator.name : operator.id,
                            pace: parseInt(operatorPace),
                            timeOnTask: parseInt(runTime),
                            count: parseInt(operatorTotal) || 0,
                            efficiency: operatorEfficiency,
                            station: station ? station : 1,
                            tasks: tasks
                        };
                    }

                    return;
                }));
                delete machineState.machine.ipAddress;
                if (machineState.status.softrolColor) {
                    machineState.status.color = '' + machineState.status.softrolColor;
                    delete machineState.status.softrolColor;
                }
                let fault = null;
                if (machineState.status.code >= 2) {
                    if (machineState.status.color == null) {
                        machineState.status.color = 'Red';
                    }
                    fault = machineState.status;
                } else if (machineState.status.code == 1) {
                    if (machineState.status.color == null) {
                        machineState.status.color = 'Green';
                    }
                } else {
                    if (machineState.status.color == null) {
                        machineState.status.color = 'Gray';
                    }
                }
                const machineTotalCountFind = await countCollection.find({ 'machine.serial': parseInt(serial), 'timestamp': { '$gte': new Date(queryDateTime) } }).toArray();
                let items = [];
                const totalCount = machineTotalCountFind.length;
                const itemTemplate = {
                    id: 1,
                    count: 0
                }
                items.push(itemTemplate);
                items.push(itemTemplate);
                items.push(itemTemplate);
                items.push(itemTemplate);
                return { status: machineState.status, machineInfo: machineState.machine, fault: fault, timeOnTask: parseInt(machineDuration), onTime: parseInt(machineDuration), totalCount: parseInt(totalCount), items: items, operators: operators.filter(element => element != null) };
            } else {
                delete machineState.machine.ipAddress;
                if (machineState.status.softrolColor) {
                    machineState.status.color = '' + machineState.status.softrolColor;
                    delete machineState.status.softrolColor;
                }
                let fault = null;
                if (machineState.status.code >= 2) {
                    if (machineState.status.color == null) {
                        machineState.status.color = 'Red';
                    }
                    fault = machineState.status;
                } else if (machineState.status.code == 1) {
                    if (machineState.status.color == null) {
                        machineState.status.color = 'Green';
                    }
                } else {
                    if (machineState.status.color == null) {
                        machineState.status.color = 'Gray';
                    }
                }
                return { status: machineState.status, machineInfo: machineState.machine, fault: fault, timeOnTask: 0, onTime: 0, totalCount: 0, items: [], operators: [] };
            }
        }));
        res.json(machineRunTimesArray);
    });

    router.get('/levelOne/:serial', async (req, res, next) => {
        let lastSessionStart, lastSessionEnd;
        let lastSessionStartTS, lastSessionEndTS;
        let diff;
        const statusCollection = db.collection('state');
        const countCollection = db.collection('count');
        //const stackCollection = db.collection('stack');

        const lastStatusFind = await statusCollection.find({ 'machine.serial': parseInt(req.params.serial), 'status': { $ne: null } }).sort({ timestamp: -1 }).limit(1).toArray();
        const lastStatus = Object.assign({}, lastStatusFind[0]);
        if (lastStatus.status.code == 0) { //System_Paused
            //Machine is currently paused, find the start of the session, then find the counts in the session
            let lastRunningStatusFind = await statusCollection.find({ 'machine.serial': parseInt(req.params.serial), timestamp: { $lt: new Date(lastStatus.timestamp) }, 'status.code': 1 }).sort({ timestamp: -1 }).limit(1).toArray();
            lastSessionStart = lastRunningStatusFind[0];
            lastSessionStartTS = new Date(lastSessionStart.timestamp);
            lastSessionEnd = lastStatus;
            lastSessionEndTS = new Date(lastSessionEnd.timestamp);
        } else if (lastStatus.status.code == 1) {
            lastSessionStart = lastStatus;
            lastSessionStartTS = new Date(lastSessionStart.timestamp);
        }

        let queryObject = {
            'machine.serial': parseInt(req.params.serial)
        }

        if (lastSessionEndTS) {
            queryObject['timestamp'] = {
                $gte: lastSessionStartTS,
                $lte: lastSessionEndTS
            }
            diff = Interval.fromDateTimes(DateTime.fromISO(lastSessionStartTS.toISOString()), DateTime.fromISO(lastSessionEndTS.toISOString()));
        } else {
            queryObject['timestamp'] = {
                $gte: lastSessionStartTS
            }
            diff = Interval.fromDateTimes(DateTime.fromISO(lastSessionStartTS.toISOString()), DateTime.now());
        }

        const countsFind = await countCollection.find(queryObject).sort({ timestamp: 1 }).toArray();
        //const stacksFind = await stackCollection.find(queryObject).sort({ timestamp: 1 }).toArray();

        const sessionDuration = Duration.fromMillis(diff.length());
        const sessionDurationString = sessionDuration.as('seconds') > 60 ? sessionDuration.as('minutes') + ' minutes' : sessionDuration.as('seconds') + ' seconds';


        res.json({ duration: sessionDurationString, countTotal: countsFind.length, /*stackTotal: stacksFind.length,*/ counts: countsFind, /*stacks: stacksFind */ });
    });

    router.get('/ticker/all', async (req, res, next) => {
        const tickerArray = await getTicker();
        res.json(tickerArray);
    });

    router.get('/ticker/machines/all', async (req, res, next) => {
        const machineListFromTicker = await getMachineListFromTicker();
        res.json(machineListFromTicker);
    });

    router.get('/ticker/operators/all', async (req, res, next) => {

        res.json(operatorListFromTicker);
    });

    router.get('/counts/all', async (req, res, next) => {
        const counts = await getAllOperatorCounts();
        res.json(counts);
    })

    router.get('/machine/operator/lists', async (req, res, next) => {
        const lists = await getMachineOperatorLists();
        res.json(lists);
    })

    router.get('/machine/operator/counts', async (req, res, next) => {
        const machineList = await getMachineOperatorLists();
        let resultArray = [];
        for await (const machine of machineList) {
            const machineOperatorCounts = await getMachineOperatorCounts(machine);
            resultArray.push(machineOperatorCounts);
        }
        res.json(resultArray);
    })

    router.get('/machine/station/stats', async (req, res, next) => {
        const machinesLevelOneBase = await getMachinesLevelOneBase();
        const machineOperatorList = await getMachineOperatorLists();
        let resultArray = [];
        for await (const machineOperator of machineOperatorList) {
            const machineOperatorCounts = await getMachineOperatorStats(machineOperator);
            resultArray.push(machineOperatorCounts);
        }
        res.json({ machinesLevelOneBase: machinesLevelOneBase, machineOperatorList: machineOperatorList, resultArray: resultArray });
    })

    router.get('/levelone/all', async (req, res, next) => {
        let machinesLevelOneBase = await getMachinesLevelOneBase();
        const machineOperatorList = await getMachineOperatorLists();

        let resultArray = [];
        let i = 0;
        for await (let machineOperator of machineOperatorList) {
            const machineOperatorCounts = await getMachineOperatorStats(machineOperator);
            machinesLevelOneBase[i].operators = machineOperatorCounts;
            i++;
        }
        res.json(machinesLevelOneBase);
    })

    router.get('/operator/realtime/:serialNumber/:lane/:timeframe', (req, res, next) => {
        getOperatorEfficiencyByLane(req.params.timeframe, req.params.serialNumber, req.params.lane, (err, results) => {
            res.json(results);
        });
    });

    router.get('/machine/state/all', (req, res, next) => {
        let returnArray = [];
        getMachineLevelOneBase(60022, (err, results) => {
            results[0]['operators'] = [
                { id: 117811, "name": "Shaun White", pace: 600, timeOnTask: 360, count: 60, efficiency: 96, station: 1, tasks: [{ "name": "Pool Towel", "standard": 625 }] },
                { id: 118347, "name": "Hannah Teter", pace: 613, timeOnTask: 360, count: 61, efficiency: 98.08, station: 2, tasks: [{ "name": "Bath Towel", "standard": 625 }] },
                { id: 119277, "name": "Torah Bright", pace: 407, timeOnTask: 360, count: 41, efficiency: 65.12, station: 3, tasks: [{ "name": "Pool Towel", "standard": 625 }] }
            ];
            returnArray.push(results[0]);
            getMachineLevelOneBase(63302, (err, results) => {
                results[0]['operators'] = [
                    { id: 159375, "name": "Jeremy Jones", pace: 543, timeOnTask: 360, count: 54, efficiency: 86.88, station: 4, tasks: [{ "name": "Bath Towel", "standard": 625 }] }
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

    router.get('/passport', (req, res, next) => {
        res.json(server.passport);
    });

    function routePublic(req, res, fileName) {
        var options = {
            root: __dirname + '/../public/',
            dotfiles: 'deny',
            headers: {
                'x-timestamp': Date.now(),
                'x-sent': true
            },
        };
        res.sendFile(fileName, options, function(err) {
            if (err) {
                console.log("error");
                console.log(err);
                res.status(err.status).end();
            } else {
                console.log('Sent:', fileName);
            }
        });
    }

    // route middleware to make sure a user is logged in
    function isLoggedIn(req, res, next) {

        // if user is authenticated in the session, carry on
        if (req.isAuthenticated())
            return next()

        req.flash('messages', 'You are not authorized to access ' + req.path + '. Please log in first')

        //sendFlashJSON(req, res)
        routePublic(req, res, 'index.html')

    }

    function sendFlashJSON(req, res) {
        var json = {
            messages: req.flash('messages')
        };
        res.json(json);
    };

    // =====================================
    // LOGIN ===============================
    // =====================================
    // show the login form
    router.get('/passport/user/login', function(req, res) {
        sendFlashJSON(req, res);
    });

    // process the login form
    router.post('/passport/user/login', passport.authenticate('local-login', {
        successRedirect: '/api/alpha/passport/user', // redirect to the secure profile section
        failureRedirect: '/api/alpha/passport/user/login', // redirect back to the signup page if there is an error
        failureFlash: true // allow flash messages
    }))

    router.get('/passport/user', function(req, res) {
        if (req.isAuthenticated()) {
            var userObject = req.user.local
            delete userObject.password
            res.json({
                user: userObject
            })
        } else {
            sendFlashJSON(req, res)
        }
    })

    // =====================================
    // SIGNUP ==============================
    // =====================================
    // show the signup form
    router.get('/passport/user/signup', function(req, res) {
        sendFlashJSON(req, res);
    });

    // process the signup form
    router.post('/passport/user/signup', isLoggedIn, passport.authenticate('local-signup', {
        successRedirect: '/api/alpha/passport/user', // redirect to the secure profile section
        failureRedirect: '/api/alpha/passport/signup', // redirect back to the signup page if there is an error
        failureFlash: true // allow flash messages
    }))

    router.post('/passport/user/register', async (req, res) => {
        try {
            const userCollection = db.collection('user');
            const user = req.body;
            const userFind = await userCollection.find({ 'local.username': user.username }).toArray();
            if (userFind.length) {
                req.flash('messages', 'That username is already taken.')
                sendFlashJSON(req, res);
            } else {
                // if there is no user with that email
                // create the user
                let newUser = {
                    local: {
                        username: null,
                        password: null,
                    }
                };

                // set the user's local credentials
                newUser.local.username = user.username;

                const salt = bcrypt.genSaltSync(10);
                const hash = bcrypt.hashSync(user.password, salt);
                newUser.local.password = hash;
                if (req.body.email) {
                    newUser.email = req.body.email
                }
                if (req.body.role) {
                    newUser.role = req.body.role
                }
                if (req.body.groups) {
                    newUser.groups = req.body.groups
                }
                if (req.body.restrictions) {
                    newUser.restrictions = req.body.restrictions
                }

                // save the user
                try {
                    const newUserInsert = await userCollection.insertOne(newUser);
                    return res.json(newUser);
                } catch (error) {
                    logger.error(error);
                    return res.json(error)
                }

            }
        } catch (error) {
            logger.error(error);
            return res.json(error);
        }
    })

    // =====================================
    // LOGOUT ==============================
    // =====================================
    router.get('/passport/user/logout', function(req, res, next) {
        if (req.user) {
            console.log("Logging " + req.user.local.username + " out")
            req.flash('messages', 'Thank you for logging out, ' + req.user.local.username)
            req.logout((err) => {
                if (err) return next(err);

            })
        } else {
            req.flash('messages', 'Cannot log out if you are not logged in!')
        }
        sendFlashJSON(req, res);
    })


    return router;
}