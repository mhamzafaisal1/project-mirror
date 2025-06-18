/*** machines API controller */
/*** Contributors: RTI II */

/** MODULE REQUIRES */
const express = require('express');
const router = express.Router();

module.exports = function(server) {
	return constructor(server);
}

function constructor(server) {
	const db = server.db;
	const collection = db.collection('machine');
	const logger = server.logger;
	const xmlParser = server.xmlParser;
	const configService = require('../../services/mongo/');

	/*** Service consumption functions */
	async function getMachineXML(req, res, next) {
		try {
			res.set('Content-Type', 'text/xml');
			let machines = await configService.getConfiguration(collection, {}, { '_id': 0, 'active': 0 });
			let xmlString = await xmlParser.xmlArrayBuilder('machine', machines, false);
			res.send(xmlString);
		} catch (error) {
			next(error);
		}
	}

	async function getMachine(req, res, next) {
		try {
			let machines = await configService.getConfiguration(collection);
			res.json(machines);
		} catch (error) {
			next(error);
		}
	}

	async function createMachine(req, res, next) {
		try {
			const machine = req.body;
			// Validate required fields
			if (!machine.name || !machine.serial) {
				return res.status(400).json({ error: 'Name and number are required fields' });
			}
			let results = await configService.upsertConfiguration(collection, machine, true, 'serial');

			res.status(201).json(results);
		} catch (error) {
			next(error);
		}
	}

	async function upsertMachine(req, res, next) {
		try {
			const id = req.params.id;
			let updates = req.body;
			if (updates._id) {
				delete updates._id;
			}
			// Validate required fields
			if (!updates.name || !updates.serial) {
				return res.status(400).json({ error: 'Name and number are required fields' });
			}
			let results = await configService.upsertConfiguration(
				collection,
				id ? { _id: id, ...updates } : updates,
				true,
				'serial' // <-- key change here
			  );
			  

			res.json(results);
		} catch (error) {
			next(error);
		}
	}

	async function deleteMachine(req, res, next) {
		try {
			const id = req.params.id;
			let results = await configService.deleteConfiguration(collection, id);
			res.json(results);
		} catch (error) {
			next(error);
		}
	}

	/*** Machine Config Routes */
	/** GET routes */
	router.get('/machines/config/xml', getMachineXML);
	router.get('/machines/config', getMachine);

	/** POST routes */
	router.post('/machines/config', createMachine);

	/** PUT routes */
	router.put('/machines/config/:id', upsertMachine);

	/** DELETE routes */
	router.delete('/machines/config/:id', deleteMachine);

	return router;
}