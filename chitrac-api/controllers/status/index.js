/*** statuses API controller */
/*** Contributors: RTI II */

/** MODULE REQUIRES */
const express = require('express');
const router = express.Router();

module.exports = function(server) {
	return constructor(server);
}

function constructor(server) {
	const db = server.db;
	const collection = db.collection('status');
	const logger = server.logger;
	const xmlParser = server.xmlParser;
	const configService = require('../../services/mongo/');

	/*** Service consumption functions */
	async function getStatusXML(req, res, next) {
		try {
			res.set('Content-Type', 'text/xml');
			let status = await configService.getConfiguration(collection, {}, { '_id': 0, 'active': 0 });
			let xmlString = await xmlParser.xmlArrayBuilder('status', status, false);
			res.send(xmlString);
		} catch (error) {
			next(error);
		}
	}

	async function getStatus(req, res, next) {
		try {
			let status = await configService.getConfiguration(collection);
			res.json(status);
		} catch (error) {
			next(error);
		}
	}

	async function upsertStatus(req, res, next) {
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

	async function deleteStatus(req, res, next) {
		try {
			const id = req.params.id;
			let results = configService.deleteConfiguration(collection, id);
			res.json(results);
		} catch (error) {
			next(error);
		}
	}

	/*** Status Config Routes */
	/** GET routes */
	router.get('/status/config/xml', getStatusXML);
	router.get('/status/config', getStatus);

	/** PUT routes */
	router.put('/status/config/:id', upsertStatus);

	/** DELETE routes */
	router.delete('/status/config/:id', deleteStatus);


	/*** Status Config Routes */
	/** GET routes */
	router.get('/fault/config/xml', getStatusXML);
	router.get('/fault/config', getStatus);

	/** PUT routes */
	router.put('/fault/config/:id', upsertStatus);

	/** DELETE routes */
	router.delete('/fault/config/:id', deleteStatus);


	return router;
}