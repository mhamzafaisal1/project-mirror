/*** statuses API controller */
/*** Contributors: RTI II */

/** MODULE REQUIRES */
const express = require('express');
const router = express.Router();
const moment = require('moment');

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
                'runTime': '$timers.runTime'
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
                promise = cursorOperatorEfficiency(moment().subtract(5, 'm').toISOString(), serialNumber).toArray();
                break;
            case 'current':
                timeframeMins = 6;
                promise = cursorOperatorEfficiency(moment().subtract(6, 'm').toISOString(), serialNumber).toArray();
                break;
            case 'fifteenMinute':
                timeframeMins = 15;
                promise = cursorOperatorEfficiency(moment().subtract(15, 'm').toISOString(), serialNumber).toArray();
                break;
            case 'hourly':
                timeframeMins = 60;
                promise = cursorOperatorEfficiency(moment().subtract(1, 'h').toISOString(), serialNumber).toArray();
                break;
            case 'daily':
            default:
                timeframeMins = 24 * 60;
                promise = cursorOperatorEfficiency(moment().startOf('day').toISOString(), serialNumber).toArray();
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
                promise = cursorLaneEfficiency(moment().subtract(5, 'm').toISOString(), serialNumber, lane).toArray();
                break;
            case 'current':
                timeframeMins = 6;
                promise = cursorLaneEfficiency(moment().subtract(6, 'm').toISOString(), serialNumber, lane).toArray();
                break;
            case 'fifteenMinute':
                timeframeMins = 15;
                promise = cursorLaneEfficiency(moment().subtract(15, 'm').toISOString(), serialNumber, lane).toArray();
                break;
            case 'hourly':
                timeframeMins = 60;
                promise = cursorLaneEfficiency(moment().subtract(1, 'h').toISOString(), serialNumber, lane).toArray();
                break;
            case 'daily':
            default:
                timeframeMins = 24 * 60;
                promise = cursorLaneEfficiency(moment().startOf('day').toISOString(), serialNumber, lane).toArray();
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

            //console.log(returnValue);
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
        //let promise = cursorTickerAgg(parseInt(serialNumber)).project(projectObject).toArray();

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
                    //console.log(returnOperatorArray);
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

    router.get('/levelone/all', async (req, res, next) => {
        /*let machineJSON = [{
            machineInfo: {
                serial: 63520,
                name: 'Flipper 1'
            },
            fault: {
                code: 3,
                name: 'Stop'
            },
            status: {
                code: 3,
                name: 'Stop'
            },
            timeOnTask: 360,
            totalCount: 216,
            efficiency: 86.52,
            operators: [
				{
				id: 117811,
				"name": "Shaun White",
				pace: 600,
				timeOnTask: 360,
				count: 60,
				efficiency: 96,
				station: 1,
				tasks: [{ "name": "Pool Towel", "standard": 625 }] },
				{ id: 118347, "name": "Hannah Teter", pace: 613, timeOnTask: 360, count: 61, efficiency: 98.08, station: 2, tasks: [{ "name": "Bath Towel", "standard": 625 }] },
				{ id: 119277, "name": "Torah Bright", pace: 407, timeOnTask: 360, count: 41, efficiency: 65.12, station: 3, tasks: [{ "name": "Pool Towel", "standard": 625 }] },
				{ id: 159375, "name": "Jeremy Jones", pace: 543, timeOnTask: 360, count: 54, efficiency: 86.88, station: 4, tasks: [{ "name": "Bath Towel", "standard": 625 }] }
            ],
            tasks: [
                { id: 4, "name": "Pool Towel", "standard": 625, count: 60 },
                { id: 5, "name": "Bath Towel", "standard": 625, count: 61 },
                { id: 4, "name": "Pool Towel", "standard": 625, count: 41 },
                { id: 5, "name": "Bath Towel", "standard": 625, count: 54 },
            ]
        }];
        res.json(machineJSON);*/
        let returnArray = [];
        getMachineLevelOneBase(63520, (err, results) => {
            let machineBase = results[0];
			getOperatorEfficiencyOneLane('current', machineBase.machineInfo.serial, (err, operators) => {
				console.log(operators);
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
                getMachineLevelOneBase(63302, (err, results) => {
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
                });
            });



        });
    });

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