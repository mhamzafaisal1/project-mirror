/**
 * @author Robert T Ivaniszyn II
 */
//const MongoServerError = require('mongodb').MongoServerError;
const util = require('util');

module.exports = function(db, logger) {
    return new constructor(db, logger);
}

function constructor(db, logger) {
    //Declare self for class
    var self = this;

    const checkCollectionExists = async function(collectionName) {
        try {
            const awaitFindCollection = await db.listCollections({ 'name': collectionName }).toArray();
            if (awaitFindCollection.length >= 1) {
                return true;
            } else {
                return false;
            }
        } catch (exception) {
            logger.error('Exception in findCollection: ' + exception);
        }
    }

    const checkCollectionIsPopulated = async function (collectionName) {
        try {
            const awaitFindAll = await db.collection(collectionName).find().toArray();
            if (awaitFindAll.length >= 1) {
                return true;
            } else {
                return false;
            }
        } catch (exception) {
            logger.error('Exception in findCollection: ' + exception);
        }
    }


    self.createCollection = async function(collectionName, options) {
        try {
            const collectionPopulated = await checkCollectionIsPopulated(collectionName);
            if (collectionPopulated) {
                throw { codeName: 'NamespaceExists' };
            } else {
                const collectionExists = await checkCollectionExists(collectionName);
                if (collectionExists) {
                    return true; //Collection is empty but exists, just return so we can load the defaults
                } else {
                    const awaitCreateCollection = await db.createCollection(collectionName, (options ? options : {}));
                    return awaitCreateCollection; //Collection doesn't exist, create so we can load defaults
                }
            }
        } catch (exception) {
            if (exception.codeName == 'NamespaceExists') {
                throw exception;
            } else {
                logger.error('Exception in createCollection: ' + exception);
            }
        }
    }

    self.createTimeCappedCollection = async function(collectionName, capTimeframeInSeconds, options) {
        try {
            const collectionPopulated = await checkCollectionIsPopulated(collectionName);
            if (collectionPopulated) {
                throw { codeName: 'NamespaceExists' };
            } else {
                const collectionExists = await checkCollectionExists(collectionName);
                if (collectionExists) {
                    return true; //Collection is empty but exists, just return so we can load the defaults
                } else {
                    const awaitCreateCollection = await db.createCollection(collectionName, (options ? options : {}));
                    const indexPromise = self.addTTLIndexToCollection(collectionName, capTimeframeInSeconds);
                    return indexPromise; //Collection doesn't exist, create so we can load defaults
                }
            }
        } catch (exception) {
            if (exception.codeName == 'NamespaceExists') {
                throw exception;
            } else {
                logger.error('Exception in createTimeCappedCollection: ' + exception);
            }
        }
    }

    self.addTTLIndexToCollection = async function(collectionName, capTimeframeInSeconds) {
        try {
            var awaitCreateIndex = await db.createIndex(collectionName, { 'timestamp': 1 }, { 'expireAfterSeconds': capTimeframeInSeconds, 'name': 'TTL' });
            return awaitCreateIndex;
        } catch (exception) {
            logger.error('Exception in addTTLIndexToCollection: ' + exception);
        }
    }

    self.listCollections = async function() {
        try {
            const awaitListCollections = await db.listCollections().toArray();
            return awaitListCollections;
        } catch (exception) {
            if (exception.codeName == 'NamespaceExists') {
                throw exception;
            } else {
                logger.error('Exception in listCollections: ' + exception);
            }
        }
    }

    self.findCollection = async function(collectionName) {
        try {
            const awaitFindCollection = await db.listCollections({ 'name': collectionName }).toArray();
            return awaitFindCollection;
        } catch (exception) {
            if (exception.codeName == 'NamespaceExists') {
                throw exception;
            } else {
                logger.error('Exception in findCollection: ' + exception);
            }
        }
    }

    self.dropCollection = async function(collectionName) {
        try {
            const awaitDropCollection = await db.dropCollection(collectionName);
            return awaitDropCollection;
        } catch (exception) {
            throw exception;
        }
    }

}