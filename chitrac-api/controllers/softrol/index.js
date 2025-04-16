/*** statuses API controller */
/*** Contributors: RTI II */

/** MODULE REQUIRES */
const express = require('express');
const router = express.Router();
const { DateTime, Duration } = require('luxon'); //For handling dates and times

module.exports = function(server) {
    return constructor(server);
}

function constructor(server) {
    const db = server.db;
    const logger = server.logger;
    const xmlParser = server.xmlParser;
    const xml = xmlParser.xml;

    router.get('/levelone/all', async (req, res, next) => {
        const stateCollection = db.collection('state');
        const stateTickerCollection = db.collection('stateTicker');
        const countCollection = db.collection('count');

        let queryDateTime = DateTime.now().toISO();
        const startDate = new Date(queryDateTime);

        const activeMachineStates = await stateTickerCollection.find({'timestamp': {'$lt': new Date(queryDateTime)}}).sort({ "machine.name": 1 }).toArray();

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
                const machineDuration = session.duration;

                const operators = await Promise.all(machineState.operators.map(async (operator) => {
                    if (operator.id == 0) {
                        operator.id = serial + 900000;
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

    return router;
}