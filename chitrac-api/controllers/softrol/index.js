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

    /*function cursorTickerAgg(serialNumber) {
    	let collection = db.collection('ticker');
    	let pipeline = [{
    		'$match': {
    			'machine.serial': serialNumber
    		}
    	}]
    	return collection.aggregate(pipeline);
    }*/

    function cursorOperatorEfficiency(startDate, serialNumber) {
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
                'runTime': '$timers.runTime',

            }
        }, {
            '$unwind': {
                'path': '$items',
                'includeArrayIndex': 'itemIndex'
            }
        }, {
            '$match': {
                'items.count': {
                    '$gt': 0
                }
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
                'from': 'item',
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
                'itemID': '$itemID',
                'itemName': '$name',
                'count': '$itemCount',
                'standard': '$standard',
                'onTime': '$onTime',
                'timeOnTask': '$runTime'
            }
        }];
        return collection.aggregate(pipeline);
    }

    function getOperatorEfficiencyOneLane(timeframe, serialNumber, callback) {
        let timeframeString = "";
        let promise;
        let timeframeMins = 0;

        switch (timeframe) {
            case 'fiveMinute':
                timeframeMins = 5;
                promise = cursorOperatorEfficiency(DateTime.now().minus({ minutes: 5 }).toISO(), serialNumber).toArray();
                break;
            case 'current':
                timeframeMins = 6;
                promise = cursorOperatorEfficiency(DateTime.now().minus({ minutes: 6 }).toISO(), serialNumber).toArray();
                break;
            case 'fifteenMinute':
                timeframeMins = 15;
                promise = cursorOperatorEfficiency(DateTime.now().minus({ minutes: 15 }).toISO(), serialNumber).toArray();
                break;
            case 'hourly':
                timeframeMins = 60;
                promise = cursorOperatorEfficiency(DateTime.now().minus({ hours: 1 }).toISO(), serialNumber).toArray();
                break;
            case 'daily':
            default:
                timeframeMins = DateTime.now().diff(DateTime.now().startOf('day'), 'minutes');
                promise = cursorOperatorEfficiency(DateTime.now().startOf('day').toISO(), serialNumber).toArray();
                break;
        }

        promise.then((results) => {
            console.log(results);
            let returnValue = results[0];
            if (returnValue != undefined) {
                returnValue['timeframe'] = timeframeMins;
                returnValue['operatorTotal'] = results.reduce((total, currentItem) => total + currentItem.count, 0);
                if (returnValue.count === 0) {
                    returnValue['efficiency'] = 0;
                } else if (returnValue['timeOnTask'] != undefined) {
                    returnValue['efficiency'] = parseInt(((returnValue.count / (returnValue.timeOnTask / 60)) / (returnValue.standard / 60)) * 60);
                } else {
                    returnValue['efficiency'] = 0;
                }
            }


            //console.log(returnValue);
            callback(null, returnValue);
        })
    }

    function cursorLaneEfficiency(startDate, serialNumber, lane) {
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
                'from': 'item',
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
                'itemID': '$itemID',
                'itemName': '$name',
                'count': '$itemCount',
                'standard': '$standard',
                'onTime': '$onTime',
                'timeOnTask': '$runTime'
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
                promise = cursorLaneEfficiency(DateTime.now().minus({ minutes: 5 }).toISO(), serialNumber, lane).toArray();
                break;
            case 'current':
                timeframeMins = 6;
                promise = cursorLaneEfficiency(DateTime.now().minus({ minutes: 6 }).toISO(), serialNumber, lane).toArray();
                break;
            case 'fifteenMinute':
                timeframeMins = 15;
                promise = cursorLaneEfficiency(DateTime.now().minus({ minutes: 15 }).toISO(), serialNumber, lane).toArray();
                break;
            case 'hourly':
                timeframeMins = 60;
                promise = cursorLaneEfficiency(DateTime.now().minus({ hours: 1 }).toISO(), serialNumber, lane).toArray();
                break;
            case 'daily':
            default:
                timeframeMins = DateTime.now().diff(DateTime.now().startOf('day'), 'minutes');
                promise = cursorLaneEfficiency(DateTime.now().startOf('day').toISO(), serialNumber, lane).toArray();
                break;
        }

        promise.then((results) => {
            let returnValue = results[0];
            if (returnValue != undefined) {
                returnValue['timeframe'] = timeframeMins;
                if (returnValue.count === 0) {
                    returnValue['efficiency'] = 0;
                } else if (returnValue['timeOnTask'] != undefined) {
                    returnValue['efficiency'] = parseInt(((returnValue.count / (returnValue.timeOnTask / 60)) / (returnValue.standard / 60)) * 60);
                } else {
                    returnValue['efficiency'] = 0;
                }
            }
            callback(null, returnValue);
        })
    }

    function getMachineLevelOneBase(serialNumber, callback) {
        let projectObject = {
            _id: 0,
            lpOperators: 1,
            spOperators: 1,
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
        const collection = db.collection('ticker');
        let promise = collection.find({ 'machine.serial': serialNumber }).project(projectObject).toArray();

        promise.then((results) => {
            callback(null, results);
        });
    }

    function isLpMachine(machine) {
        let returnBoolean = false;
        machine.lpOperators.forEach((lpOperator) => {
            if (lpOperator.id >= 0) {
                returnBoolean = true;
            }
        });
        machine.spOperators.forEach((spOperator) => {
            if (spOperator.id >= 0) {
                returnBoolean = false;
            }
        });
        return returnBoolean;
    }

    function lpOperators(machine, callback) {
        if (machine) {
            let returnOperatorArray = [];
            let lpOperators = [...machine.lpOperators];
            getOperatorEfficiencyByLane('current', machine.machineInfo.serial, 1, (err, operator) => {
                if (lpOperators[0].id >= 0) {
                    returnOperatorArray.push(Object.assign(lpOperators[0], operator));
                }
                getOperatorEfficiencyByLane('current', machine.machineInfo.serial, 2, (err, operator) => {
                    if (lpOperators[1].id >= 0) {
                        returnOperatorArray.push(Object.assign(lpOperators[1], operator));
                    }
                    getOperatorEfficiencyByLane('current', machine.machineInfo.serial, 3, (err, operator) => {
                        if (lpOperators[2].id >= 0) {
                            returnOperatorArray.push(Object.assign(lpOperators[2], operator));
                        }
                        getOperatorEfficiencyByLane('current', machine.machineInfo.serial, 4, (err, operator) => {
                            if (lpOperators[3].id >= 0) {
                                returnOperatorArray.push(Object.assign(lpOperators[3], operator));
                            }
                            return callback(returnOperatorArray);
                        });
                    });
                });
            });
        } else {
            return callback([]);
        }
    }

    const queryTicker = async function() {
		let tickerPromise = [];
    	try {
			tickerPromise = await db.collection('ticker').find().toArray();
    	} catch (error) {
			logger.error(error);
    	} finally {
    		return tickerPromise
    	}
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

    const getOperatorCounts = async function(operatorInfo) {
        const pipeline = [{
            '$match': {
                'timestamp': { $gte: new Date(DateTime.now().minus({ minutes: 6 }).toISO()) },
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
                },
                'operatorName': {
                    '$last': '$operatorName'
                }
            }
        }];

        return db.collection('newOperatorCount').aggregate(pipeline);
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

    router.get('/levelone/all', (req, res, next) => {
        const resJSON = [{"status":{"code":1,"name":"Run","color":"Green"},"machineInfo":{"serial":67801,"name":"Blanket1"},"fault":null,"timeOnTask":288,"onTime":288,"totalCount":34,"items":[{"id":1,"count":0},{"id":1,"count":0},{"id":1,"count":0},{"id":1,"count":0}],"operators":[{"id":967801,"name":"Operator","pace":425,"timeOnTask":288,"count":34,"efficiency":94,"station":3,"tasks":[{"name":"Bath Blankets","standard":450}]}]},{"status":{"code":103,"name":"Ironer Stopped","color":"Red"},"machineInfo":{"serial":67802,"name":"Blanket2"},"fault":{"code":103,"name":"Ironer Stopped","color":"Red"},"timeOnTask":217,"onTime":217,"totalCount":16,"items":[{"id":1,"count":0},{"id":1,"count":0},{"id":1,"count":0},{"id":1,"count":0}],"operators":[{"id":967802,"name":"Operator","pace":132,"timeOnTask":217,"count":8,"efficiency":29,"station":1,"tasks":[{"name":"Bath Blankets","standard":450}]},{"id":967802,"name":"Operator","pace":132,"timeOnTask":217,"count":8,"efficiency":29,"station":3,"tasks":[{"name":"Bath Blankets","standard":450}]}]},{"status":{"code":1,"name":"Run","color":"Green"},"machineInfo":{"serial":67798,"name":"LPL1"},"fault":null,"timeOnTask":360,"onTime":360,"totalCount":50,"items":[{"id":1,"count":0},{"id":1,"count":0},{"id":1,"count":0},{"id":1,"count":0}],"operators":[{"id":967798,"name":"Operator","pace":270,"timeOnTask":360,"count":27,"efficiency":64,"station":1,"tasks":[{"name":"None Entered","standard":420}]},{"id":967798,"name":"Operator","pace":230,"timeOnTask":360,"count":23,"efficiency":54,"station":3,"tasks":[{"name":"None Entered","standard":420}]}]},{"status":{"code":1,"name":"Run","color":"Green"},"machineInfo":{"serial":67799,"name":"LPL2"},"fault":null,"timeOnTask":360,"onTime":360,"totalCount":47,"items":[{"id":1,"count":0},{"id":1,"count":0},{"id":1,"count":0},{"id":1,"count":0}],"operators":[{"id":967799,"name":"Operator","pace":180,"timeOnTask":360,"count":18,"efficiency":51,"station":1,"tasks":[{"name":"Sheets","standard":350}]},{"id":967799,"name":"Operator","pace":290,"timeOnTask":360,"count":29,"efficiency":82,"station":3,"tasks":[{"name":"Sheets","standard":350}]}]},{"status":{"code":1,"name":"System_Running","color":"Green"},"machineInfo":{"serial":67808,"name":"SPF1"},"fault":null,"timeOnTask":348,"onTime":348,"totalCount":23,"items":[{"id":1,"count":0},{"id":1,"count":0},{"id":1,"count":0},{"id":1,"count":0}],"operators":[{"id":967808,"name":"Unknown","pace":237,"timeOnTask":348,"count":23,"efficiency":48,"station":1,"tasks":[{"name":"Regular","standard":480},{"name":"Baby Blankets","standard":780}]}]},{"status":{"code":1,"name":"System_Running","color":"Green"},"machineInfo":{"serial":67806,"name":"SPF2"},"fault":null,"timeOnTask":360,"onTime":360,"totalCount":20,"items":[{"id":1,"count":0},{"id":1,"count":0},{"id":1,"count":0},{"id":1,"count":0}],"operators":[{"id":967806,"name":"Unknown","pace":200,"timeOnTask":360,"count":20,"efficiency":40,"station":1,"tasks":[{"name":"Towels","standard":900},{"name":"Regular","standard":480}]}]},{"status":{"code":1,"name":"System_Running","color":"Green"},"machineInfo":{"serial":67807,"name":"SPF3"},"fault":null,"timeOnTask":340,"onTime":340,"totalCount":65,"items":[{"id":1,"count":0},{"id":1,"count":0},{"id":1,"count":0},{"id":1,"count":0}],"operators":[{"id":967807,"name":"Unknown","pace":688,"timeOnTask":340,"count":65,"efficiency":76,"station":1,"tasks":[{"name":"Hand Towel","standard":900},{"name":"Towels","standard":900}]}]},{"status":{"code":1,"name":"System_Running","color":"Green"},"machineInfo":{"serial":67804,"name":"SPF5"},"fault":null,"timeOnTask":360,"onTime":360,"totalCount":26,"items":[{"id":1,"count":0},{"id":1,"count":0},{"id":1,"count":0},{"id":1,"count":0}],"operators":[{"id":967804,"name":"Unknown","pace":260,"timeOnTask":360,"count":26,"efficiency":54,"station":1,"tasks":[{"name":"Regular","standard":480}]}]},{"status":{"code":1,"name":"Run","color":"Green"},"machineInfo":{"serial":67800,"name":"SPL1"},"fault":null,"timeOnTask":360,"onTime":360,"totalCount":81,"items":[{"id":1,"count":0},{"id":1,"count":0},{"id":1,"count":0},{"id":1,"count":0}],"operators":[{"id":967800,"name":"Operator","pace":160,"timeOnTask":360,"count":16,"efficiency":22,"station":1,"tasks":[{"name":"Pillowcases","standard":700}]},{"id":967800,"name":"Operator","pace":130,"timeOnTask":360,"count":13,"efficiency":18,"station":2,"tasks":[{"name":"Pillowcases","standard":700}]},{"id":967800,"name":"Operator","pace":520,"timeOnTask":360,"count":52,"efficiency":74,"station":3,"tasks":[{"name":"Pillowcases","standard":700}]}]}];
        res.json(resJSON);
        });

    /*router.get('/levelone/all', async (req, res, next) => {
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
    })*/

    /*router.get('/levelone/all', async (req, res, next) => {
        let returnArray = [];
        getMachineLevelOneBase(67800, (err, results) => {
            let machineBase = results[0];
            lpOperators(machineBase, (operators) => {
                if (machineBase && operators) {
                    let formattedOperators = operators.map((operator) => {
                        let opObject = {
                            id: operator.id || 0,
                            name: 'Operator',
                            pace: parseInt(operator.standard * (operator.efficiency / 100)) || 0,
                            timeOnTask: operator.timeOnTask || 0,
                            onTime: operator.onTime || 0,
                            count: operator.count || 0,
                            efficiency: operator.efficiency || 0,
                            station: operator.station || 0,
                            tasks: [{
                                name: operator.itemName || 'None Entered',
                                standard: operator.standard || 0,
                            }]
                        }
                        return opObject;
                    })

                    machineBase['operators'] = formattedOperators;
                    delete machineBase.lpOperators;
                    delete machineBase.spOperators;
                    returnArray.push(machineBase);
                }
                getMachineLevelOneBase(67802, (err, results) => {
                    let machineBase = results[0];
                    lpOperators(machineBase, (operators) => {
                        if (machineBase && operators) {
                            let formattedOperators = operators.map((operator) => {
                                let opObject = {
                                    id: operator.id || 0,
                                    name: 'Operator',
                                    pace: parseInt(operator.standard * (operator.efficiency / 100)) || 0,
                                    timeOnTask: operator.timeOnTask || 0,
                                    onTime: operator.onTime || 0,
                                    count: operator.count || 0,
                                    efficiency: operator.efficiency || 0,
                                    station: operator.station || 0,
                                    tasks: [{
                                        name: operator.itemName || 'None Entered',
                                        standard: operator.standard || 0,
                                    }]
                                }
                                return opObject;
                            })

                            machineBase['operators'] = formattedOperators;
                            delete machineBase.lpOperators;
                            delete machineBase.spOperators;
                            returnArray.push(machineBase);
                        }
						getMachineLevelOneBase(67801, (err, results) => {
							let machineBase = results[0];
							lpOperators(machineBase, (operators) => {
								if (machineBase && operators) {
									let formattedOperators = operators.map((operator) => {
										let opObject = {
											id: operator.id || 0,
											name: 'Operator',
											pace: parseInt(operator.standard * (operator.efficiency / 100)) || 0,
											timeOnTask: operator.timeOnTask || 0,
											onTime: operator.onTime || 0,
											count: operator.count || 0,
											efficiency: operator.efficiency || 0,
											station: operator.station || 0,
											tasks: [{
												name: operator.itemName || 'None Entered',
												standard: operator.standard || 0,
											}]
										}
										return opObject;
									})

									machineBase['operators'] = formattedOperators;
									delete machineBase.lpOperators;
									delete machineBase.spOperators;
									returnArray.push(machineBase);
								}
								getMachineLevelOneBase(67799, (err, results) => {
									let machineBase = results[0];
									lpOperators(machineBase, (operators) => {
										if (machineBase && operators) {
											let formattedOperators = operators.map((operator) => {
												let opObject = {
													id: operator.id || 0,
													name: 'Operator',
													pace: parseInt(operator.standard * (operator.efficiency / 100)) || 0,
													timeOnTask: operator.timeOnTask || 0,
													onTime: operator.onTime || 0,
													count: operator.count || 0,
													efficiency: operator.efficiency || 0,
													station: operator.station || 0,
													tasks: [{
														name: operator.itemName || 'None Entered',
														standard: operator.standard || 0,
													}]
												}
												return opObject;
											})

											machineBase['operators'] = formattedOperators;
											delete machineBase.lpOperators;
											delete machineBase.spOperators;
											returnArray.push(machineBase);
										}

										getMachineLevelOneBase(67798, (err, results) => {
											let machineBase = results[0];
											lpOperators(machineBase, (operators) => {
												if (machineBase && operators) {
													let formattedOperators = operators.map((operator) => {
														let opObject = {
															id: operator.id || 0,
															name: 'Operator',
															pace: parseInt(operator.standard * (operator.efficiency / 100)) || 0,
															timeOnTask: operator.timeOnTask || 0,
															onTime: operator.onTime || 0,
															count: operator.count || 0,
															efficiency: operator.efficiency || 0,
															station: operator.station || 0,
															tasks: [{
																name: operator.itemName || 'None Entered',
																standard: operator.standard || 0,
															}]
														}
														return opObject;
													})

													machineBase['operators'] = formattedOperators;
													delete machineBase.lpOperators;
													delete machineBase.spOperators;
													returnArray.push(machineBase);
												}
												res.json(returnArray);
											});
										});
									});
								});
							});
						});
                    });
                });*/

                /*getMachineLevelOneBase(63302, (err, results) => {
                    let machineBase = results[0];
                    lpOperators(machineBase, (operators) => {
                        if (machineBase && operators) {
                            let formattedOperators = operators.map((operator) => {
								let opObject = {
									id: operator.id || 0,
									name: 'Operator',
									pace: parseInt(operator.standard * (operator.efficiency / 100)) || 0,
									timeOnTask: operator.timeOnTask || 0,
									onTime: operator.onTime || 0,
									count: operator.count || 0,
									efficiency: operator.efficiency || 0,
									station: operator.station || 0,
									tasks: [{
										name: operator.itemName || 'None Entered',
										standard: operator.standard || 0,
									}]
								}
                                return opObject;
                            })

                            machineBase['operators'] = formattedOperators;
                            delete machineBase.lpOperators;
                            delete machineBase.spOperators;
                            returnArray.push(machineBase);
                        }
                        getMachineLevelOneBase(60022, (err, results) => {
                            let machineBase = results[0];
                            lpOperators(machineBase, (operators) => {
                                if (machineBase && operators) {
                                    let formattedOperators = operators.map((operator) => {
										let opObject = {
											id: operator.id || 0,
											name: 'Operator',
											pace: parseInt(operator.standard * (operator.efficiency / 100)) || 0,
											timeOnTask: operator.timeOnTask || 0,
											onTime: operator.onTime || 0,
											count: operator.count || 0,
											efficiency: operator.efficiency || 0,
											station: operator.station || 0,
											tasks: [{
												name: operator.itemName || 'None Entered',
												standard: operator.standard || 0,
											}]
										}
                                        return opObject;
                                    })

                                    machineBase['operators'] = formattedOperators;
                                    delete machineBase.lpOperators;
                                    delete machineBase.spOperators;
                                    returnArray.push(machineBase);
                                }
                                getMachineLevelOneBase(65320, (err, results) => {
                                    let machineBase = results[0];
                                    lpOperators(machineBase, (operators) => {
                                        if (machineBase && operators) {
                                            let formattedOperators = operators.map((operator) => {
												let opObject = {
													id: operator.id || 0,
													name: 'Operator',
													pace: parseInt(operator.standard * (operator.efficiency / 100)) || 0,
													timeOnTask: operator.timeOnTask || 0,
													onTime: operator.onTime || 0,
													count: operator.count || 0,
													efficiency: operator.efficiency || 0,
													station: operator.station || 0,
													tasks: [{
														name: operator.itemName || 'None Entered',
														standard: operator.standard || 0,
													}]
												}
                                                return opObject;
                                            })

                                            machineBase['operators'] = formattedOperators;
                                            delete machineBase.lpOperators;
                                            delete machineBase.spOperators;
                                            returnArray.push(machineBase);

                                        }
                                        res.json(returnArray);
                                    })
                                });
                            });
                        });
                    });
                });*/
            /*});
        });
    });*/

    router.get('/levelone/all/xml', async (req, res, next) => {
        res.set('Content-Type', 'text/xml');

        let machineJSON = [{
            machineInfo: {
                serial: 63520,
                name: 'Flipper 1'
            }, ///
            fault: {
                code: 3,
                name: 'Stop'
            }, ///
            status: {
                code: 3,
                name: 'Stop'
            }, ///
            timeOnTask: 360, ///
            totalCount: 216, ///
            efficiency: 86.52,
            operators: [
                { id: 117811, "name": "Shaun White", pace: 600, timeOnTask: 360, count: 60, efficiency: 96, station: 1, tasks: [{ task: { "name": "Pool Towel", "standard": 625 } }] },
                { id: 118347, "name": "Hannah Teter", pace: 613, timeOnTask: 360, count: 61, efficiency: 98.08, station: 2, tasks: [{ task: { "name": "Bath Towel", "standard": 625 } }] },
                { id: 119277, "name": "Torah Bright", pace: 407, timeOnTask: 360, count: 41, efficiency: 65.12, station: 3, tasks: [{ task: { "name": "Pool Towel", "standard": 625 } }] },
                { id: 159375, "name": "Jeremy Jones", pace: 543, timeOnTask: 360, count: 54, efficiency: 86.88, station: 4, tasks: [{ task: { "name": "Bath Towel", "standard": 625 } }] }
            ], ///NEED TO ADD JOINING OPERATORS INTO DATAFEED
            tasks: [
                { id: 4, "name": "Pool Towel", "standard": 625, count: 60 },
                { id: 5, "name": "Bath Towel", "standard": 625, count: 61 },
                { id: 4, "name": "Pool Towel", "standard": 625, count: 41 },
                { id: 5, "name": "Bath Towel", "standard": 625, count: 54 },
            ] ///
        }];

        let returnXML = await xmlParser.levelOneBuilder(machineJSON);
        res.send(returnXML);
    });


    router.get('/api/machine/levelone/:serialNumber/xml', (req, res, next) => {
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

    router.get('/api/machine/leveltwo/:serialNumber/xml', (req, res, next) => {
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

    return router;
}