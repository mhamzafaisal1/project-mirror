/*** Config Functions */
async function getConfiguration(collection, query, projection) {
	try {
		let collection = db.collection(collection);
		let cursor = collection.find(query).project(projection);
		let response = await cursor.toArray();
		return response;
	} catch (error) {
		return error;
	}
}

async function upsertConfiguration(collection, id, updateObject, upsert) {
	try {
		let collection = db.collection(collection);
		let response = await collection.updateOne({ '_id': id }, { '$set': updateObject }, { 'upsert': true });
		return response;
	} catch (error) {
		return error;
	}
}

async function deleteConfiguration(collection, id) {
	try {
		let collection = db.collection(collection);
		let response = await collection.deleteOne({ '_id': id });
		return response;
	} catch (error) {
		return error;
	}
}


exports.getConfiguration = getConfiguration;
exports.upsertConfiguration = upsertConfiguration;
exports.deleteConfiguration = deleteConfiguration;