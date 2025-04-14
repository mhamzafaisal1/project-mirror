/*** items API controller */
/*** Contributors: RTI II */

/** MODULE REQUIRES */
const express = require('express');
const router = express.Router();


module.exports = function(server) {
	return constructor(server);
}

function constructor(server) {
	const db = server.db;
	const collection = db.collection('item');
	const logger = server.logger;
	const xmlParser = server.xmlParser;
	const configService = reqlib('/services/mongo/');

	/*** Service consumption functions */
	async function getItemXML(req, res, next) {
		try {
			res.set('Content-Type', 'text/xml');
			let items = await configService.getConfiguration(collection, {}, { '_id': 0, 'active': 0 });
			let xmlString = await xmlParser.xmlArrayBuilder('item', items, false);
			res.send(xmlString);
		} catch (error) {
			next(error);
		}
	}

	async function getItem(req, res, next) {
		try {
			let items = await configService.getConfiguration(collection);
			res.json(items);
		} catch (error) {
			next(error);
		}
	}

	async function upsertItem(req, res, next) {
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

	async function deleteItem(req, res, next) {
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
	router.get('/items/config/xml', getItemXML);
	router.get('/items/config', getItem);
	router.get('/item/config/xml', getItemXML);
	router.get('/item/config', getItem);

	/** PUT routes */
	router.put('/items/config/:id', upsertItem);
	router.put('/item/config/:id', upsertItem);

	/** DELETE routes */
	router.delete('/items/config/:id', deleteItem);
	router.delete('/item/config/:id', deleteItem);

	return router;
}