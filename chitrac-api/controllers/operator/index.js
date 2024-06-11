/*** operators API controller */
/*** Contributors: RTI II */

/** MODULE REQUIRES */
const express = require('express');
const router = express.Router();

module.exports = function(server) {
	return constructor(server);
}

function constructor(server) {
	const db = server.db;
	const collection = db.collection('operator');
	const logger = server.logger;
	const xmlParser = server.xmlParser;
	const configService = reqlib('/services/mongo/');

	/*** Service consumption functions */
	async function getOperatorXML(req, res, next) {
		try {
			res.set('Content-Type', 'text/xml');
			let operators = await configService.getConfiguration(collection, {}, { 'code': '$code', 'name': '$name.full', '_id': 0 });
			let xmlString = await xmlParser.xmlArrayBuilder('operator', operators, false);
			res.send(xmlString);
		} catch (error) {
			next(error);
		}
	}

	async function getOperator(req, res, next) {
		try {
			let operators = await configService.getConfiguration(collection);
			res.json(operators);
		} catch (error) {
			next(error);
		}
	}

	async function upsertOperator(req, res, next) {
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

	async function deleteOperator(req, res, next) {
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
	router.get('/operators/config/xml', getOperatorXML);
	router.get('/operators/config', getOperator);

	/** PUT routes */
	router.put('/operators/config/:id', upsertOperator);

	/** DELETE routes */
	router.delete('/operators/config/:id', deleteOperator);

	return router;
}