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
	const configService = reqlib('/services/mongo/');

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

	async function upsertMachine(req, res, next) {
		try {
			const id = req.params.id;
			let updates = req.body;
			if (updates._id) {
				delete updates._id;
			};
			let results = await configService.upsertConfiguration(collection, id, updates, true);
			res.json(results);
		} catch (error) {
			next(error);
		}
	}

	async function deleteMachine(req, res, next) {
		try {
			const id = req.params.id;
			let results = configService.deleteConfiguration(collection, id);
			res.json(results);
		} catch (error) {
			next(error);
		}
	}

	/*** Machine Config Routes */
	/** GET routes */
	router.get('/machines/config/xml', getMachineXML);
	router.get('/machines/config', getMachine);

	/** PUT routes */
	router.put('/machines/config/:id', upsertMachine);

	/** DELETE routes */
	router.delete('/machines/config/:id', deleteMachine);

	return router;
}