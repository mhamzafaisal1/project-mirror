/*** Config Functions */
async function getConfiguration(collection, query, projection) {
	try {
		let cursor = collection.find(query).project(projection);
		let results = await cursor.toArray();
		return results;
	} catch (error) {
		throw error;
	}
}

async function upsertConfiguration(collection, id, updateObject, upsert) {
	try {
		let results = await collection.updateOne({ '_id': id }, { '$set': updateObject }, { 'upsert': upsert });
		return results;
	} catch (error) {
		throw error;
	}
}

async function deleteConfiguration(collection, id) {
	try {
		let results = await collection.deleteOne({ '_id': id });
		return results;
	} catch (error) {
		throw error;
	}
}


exports.getConfiguration = getConfiguration;
exports.upsertConfiguration = upsertConfiguration;
exports.deleteConfiguration = deleteConfiguration;