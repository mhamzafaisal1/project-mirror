const express = require('express');
const path = require('path');
const xml = require('xml2js');

function init(app, appRoot, db) {

    app.get(('/docs/api'), (req, res, next) => {
        res.sendFile(path.join(appRoot, '/docs/api.html'));
    })

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
        let xmlString = machineBuilder.buildObject(machineObject);
        return callback(xmlString);
    }

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

    app.get('/api/machine/levelone/:serialNumber/xml', (req, res, next) => {
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

    app.get('/api/machine/leveltwo/:serialNumber/xml', (req, res, next) => {
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
            items = await collection.find({ 'active': true }).project({ '_id': 0, 'active': 0 }).toArray();
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
    app.get('/api/items/config', (req, res, next) => {

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
            machines = await collection.find({ 'active': true }).project({ '_id': 0, 'active': 0 }).toArray();
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
            operators = await collection.find({ 'active': true }).project({ '_id': 0, 'active': 0 }).toArray();
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
    app.get('/api/faults/config', (req, res, next) => {
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
}

module.exports = {
    init: init
}