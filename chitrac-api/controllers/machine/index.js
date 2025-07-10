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
	const machineValidator = require('../../middleware/machineValidator')(server);

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

	// async function createMachine(req, res, next) {
	// 	try {
	// 	  const machine = req.body;
	  
	// 	  // ✅ Remove _id if present (fixes schema validation failure)
	// 	  if (machine._id) {
	// 		delete machine._id;
	// 	  }
	  
	// 	  // Validate required fields
	// 	  if (!machine.name || !machine.serial) {
	// 		return res.status(400).json({ error: 'Name and number are required fields' });
	// 	  }
	  
	// 	  // ✅ Sort & dedupe stations
	// 	  if (Array.isArray(machine.stations)) {
	// 		machine.stations = [...new Set(machine.stations)].sort((a, b) => a - b);
	// 	  }
	  
	// 	  let results = await configService.upsertConfiguration(collection, machine, true, 'serial');
	// 	  res.status(201).json(results);
	// 	} catch (error) {
	// 	  next(error);
	// 	}
	//   }
	  

	async function createMachine(req, res, next) {
  try {
    const machine = { ...req.body }; // clone for safety

    // 🪵 Log the raw incoming payload
    logger.debug('[createMachine] Incoming payload:', {
      body: machine,
      timestamp: new Date().toISOString()
    });

    // ✅ Remove _id if present to prevent schema rejection
    if (machine._id) {
      logger.debug('[createMachine] Removing _id from payload to satisfy schema');
      delete machine._id;
    }

    // ✅ Sort and deduplicate stations if present
    if (Array.isArray(machine.stations)) {
      const original = [...machine.stations];
      machine.stations = [...new Set(machine.stations)].sort((a, b) => a - b);
      logger.debug(`[createMachine] Normalized stations from [${original}] to [${machine.stations}]`);
    }

    // 🪵 Log the final payload before insert
    logger.debug('[createMachine] Final payload to insert:', {
      body: machine,
      timestamp: new Date().toISOString()
    });

    const results = await configService.upsertConfiguration(collection, machine, true, 'serial');

    logger.info('[createMachine] Machine created successfully:', {
      serial: machine.serial,
      name: machine.name,
      timestamp: new Date().toISOString()
    });

    res.status(201).json(results);
  } catch (error) {
    logger.error('[createMachine] Error:', {
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
    next(error);
  }
}

	

	async function upsertMachine(req, res, next) {
		try {
			const id = req.params.id;
			let updates = req.body;
	
			logger.debug('[upsertMachine] Processing update:', {
				id: id,
				body: updates,
				timestamp: new Date().toISOString()
			});

			if (updates._id) {
				delete updates._id;
			}
	
			// ✅ Sort & dedupe stations
			if (Array.isArray(updates.stations)) {
				const original = [...updates.stations];
				updates.stations = [...new Set(updates.stations)].sort((a, b) => a - b);
				logger.debug(`[upsertMachine] Normalized stations from [${original}] to [${updates.stations}]`);
			}
	
			let results = await configService.upsertConfiguration(
				collection,
				id ? { _id: id, ...updates } : updates,
				true,
				'serial'
			);

			logger.info('[upsertMachine] Machine updated successfully:', {
				id: id,
				serial: updates.serial,
				name: updates.name,
				timestamp: new Date().toISOString()
			});
	
			res.json(results);
		} catch (error) {
			logger.error('[upsertMachine] Error:', {
				error: error.message,
				stack: error.stack,
				timestamp: new Date().toISOString()
			});
			next(error);
		}
	}
	

	async function deleteMachine(req, res, next) {
		try {
			const id = req.params.id;
			
			logger.debug('[deleteMachine] Processing delete:', {
				id: id,
				timestamp: new Date().toISOString()
			});

			let results = await configService.deleteConfiguration(collection, id);
			
			logger.info('[deleteMachine] Machine deleted successfully:', {
				id: id,
				timestamp: new Date().toISOString()
			});

			res.json(results);
		} catch (error) {
			logger.error('[deleteMachine] Error:', {
				error: error.message,
				stack: error.stack,
				timestamp: new Date().toISOString()
			});
			next(error);
		}
	}

	/*** Machine Config Routes */
	/** GET routes */
	router.get('/machines/config/xml', getMachineXML);
	router.get('/machines/config', getMachine);

	/** POST routes */
	router.post('/machines/config', machineValidator, createMachine);

	/** PUT routes */
	router.put('/machines/config/:id', machineValidator, upsertMachine);

	/** DELETE routes */
	router.delete('/machines/config/:id', deleteMachine);

	return router;
}