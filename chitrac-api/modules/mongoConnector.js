module.exports = function(config) {
	return constructor(config);
}

function constructor(config) {
	/** Load MongoDB */
	const { MongoClient } = require('mongodb');
	const dbClient = new MongoClient(config.mongo.url);
	const db = dbClient.db(config.mongo.db);

	return db;
}

