const { ObjectId } = require('mongodb');

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

async function upsertConfiguration(collection, updateObject, upsert) {
	try {
		let results, id;
		if (updateObject._id) {
			id = new ObjectId(updateObject._id);
			delete updateObject._id;
		}
		if (id) {
			results = await collection.updateOne({ '_id': id }, { '$set': updateObject });
		} else {
			const findConfig = await collection.find({ 'code': updateObject.code }).toArray();
			if (findConfig.length) {
				throw { message: 'Operator Already exists' };
			} else {
				results = await collection.insertOne(updateObject);
			}
		}
		return results;
	} catch (error) {
		error.message = JSON.stringify(error);
		error.status = 409;
		error.expressResponse = {
		}
		throw error;
	}
}

async function deleteConfiguration(collection, id) {
	try {
		let results = await collection.deleteOne({ '_id': new ObjectId(id) });
		return results;
	} catch (error) {
		throw error;
	}
}


exports.getConfiguration = getConfiguration;
exports.upsertConfiguration = upsertConfiguration;
exports.deleteConfiguration = deleteConfiguration;