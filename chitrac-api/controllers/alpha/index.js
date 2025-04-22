/*** alpha API controller */
/*** Contributors: RTI II */

/** MODULE REQUIRES */
const express = require("express");
const router = express.Router();
const { DateTime, Duration, Interval } = require("luxon"); //For handling dates and times
const ObjectId = require("mongodb").ObjectId;
const startupDT = DateTime.now();
const bcrypt = require("bcryptjs");
const { parseAndValidateQueryParams, createPaddedTimeRange, createMongoDateQuery, formatDuration } = require('../../utils/time');
const { fetchStatesForMachine, groupStatesByMachine, extractCyclesFromStates } = require('../../utils/state');
const { getCountRecords, getOperatorItemMapFromCounts } = require('../../utils/count');
const { calculateRuntime, calculateDowntime, calculateTotalCount, calculateMisfeeds, calculateAvailability, calculateThroughput, calculateEfficiency, calculateOEE } = require('../../utils/analytics');

module.exports = function (server) {
  return constructor(server);
};

function constructor(server) {
  const db = server.db;
  const logger = server.logger;
  const passport = server.passport;


  router.get("/timestamp", (req, res, next) => {
    res.json(startupDT);
  });

  router.get("/currentTime/get", async (req, res, next) => {
    const currentDT = DateTime.now();
    const formatString = "yyyy-LL-dd-TT.SSS";
    //res.json(DateTime.now().toISO());
    const responseJSON = {
      currentTime: currentDT.toUTC().toFormat(formatString),
      currentLocalTime: currentDT.toFormat(formatString),
      timezone: currentDT.toFormat("z"),
      timezoneOffset: currentDT.toFormat("ZZZ"),
    };
    res.json(responseJSON);
  });

  router.get("/ac360/get", async (req, res, next) => {
    res.json("Hello AC360!");
  });

  router.get("/ac360/lastSession/get", async (req, res, next) => {
    let lastSessionStart, lastSessionEnd;
    let lastSessionStartTS, lastSessionEndTS;
    let diff;
    const statusCollection = db.collection("ac360-status");
    const countCollection = db.collection("ac360-count");
    const stackCollection = db.collection("ac360-stack");

    const lastStatusFind = await statusCollection
      .find({ "machineInfo.serial": 67421 })
      .sort({ timestamp: -1 })
      .limit(1)
      .toArray();
    const lastStatus = Object.assign({}, lastStatusFind[0]);
    if (lastStatus.status.code == 0) {
      //System_Paused
      //Machine is currently paused, find the start of the session, then find the counts in the session
      let lastRunningStatusFind = await statusCollection
        .find({
          "machineInfo.serial": 67421,
          timestamp: { $lt: new Date(lastStatus.timestamp) },
        })
        .sort({ timestamp: -1 })
        .limit(1)
        .toArray();
      lastSessionStart = lastRunningStatusFind[0];
      lastSessionStartTS = new Date(lastSessionStart.timestamp);
      lastSessionEnd = lastStatus;
      lastSessionEndTS = new Date(lastSessionEnd.timestamp);
    } else if (lastStatus.status.code == 1) {
      lastSessionStart = lastStatus;
      lastSessionStartTS = new Date(lastSessionStart.timestamp);
    }
    
    let queryObject = {
      "machineInfo.serial": 67421,
    };

    if (lastSessionEndTS) {
      queryObject["timestamp"] = {
        $gte: lastSessionStartTS,
        $lte: lastSessionEndTS,
      };
      diff = Interval.fromDateTimes(
        DateTime.fromISO(lastSessionStartTS.toISOString()),
        DateTime.fromISO(lastSessionEndTS.toISOString())
      );
    } else {
      queryObject["timestamp"] = {
        $gte: lastSessionStartTS,
      };
      diff = Interval.fromDateTimes(
        DateTime.fromISO(lastSessionStartTS.toISOString()),
        DateTime.now()
      );
    }
    
    const countsFind = await countCollection
      .find(queryObject)
      .sort({ timestamp: 1 })
      .toArray();
    const stacksFind = await stackCollection
      .find(queryObject)
      .sort({ timestamp: 1 })
      .toArray();

    const sessionDuration = Duration.fromMillis(diff.length());
    const sessionDurationString =
      sessionDuration.as("seconds") > 60
        ? sessionDuration.as("minutes") + " minutes"
        : sessionDuration.as("seconds") + " seconds";

    res.json({
      duration: sessionDurationString,
      countTotal: countsFind.length,
      stackTotal: stacksFind.length,
      counts: countsFind,
      stacks: stacksFind,
    });
  });

  router.post('/ac360/post', async (req, res, next) => {
    const currentDateTime = new Date();
    let bodyJSON = Object.assign({}, req.body);
    if (bodyJSON.timestamp) {
        bodyJSON.timestamp = new Date(DateTime.fromISO(bodyJSON.timestamp + 'Z'));
        /** TEMPORARY FIX for future timestamps coming from AC360s on boot,  */
        if (bodyJSON.timestamp > currentDateTime) {
            bodyJSON.timestamp = currentDateTime;
        }
    }

    let storeJSON = Object.assign({}, bodyJSON);
    if (req.socket.remoteAddress) {
        const ipStrings = req.socket.remoteAddress.split(':');
        storeJSON.machineInfo['ipAddress'] = '' + ipStrings[ipStrings.length - 1];
    }
    const machine = Object.assign({}, storeJSON.machineInfo);
    const program = Object.assign({ mode: 'ac360' }, storeJSON.programInfo);
    const operators = [{ id: storeJSON.operatorInfo.code, name: storeJSON.operatorInfo.name }];

    let collection = db.collection('ac360');
    if (storeJSON.status) {
        collection = db.collection('ac360-status');

        const status = Object.assign({}, storeJSON.status);

        const state = {
            timestamp: storeJSON.timestamp,
            machine: {
                serial: machine.serial,
                name: 'SPF' + machine.name.slice(-1),
                ipAddress: machine.ipAddress,
            },
            program: program,
            operators: operators,
            status: status
        }

        const stateTickerResult = await db.collection('stateTicker').replaceOne({ 'machine.serial': machine.serial }, state, { upsert: true });
        const stateResult = await db.collection('state').insertOne(state);
    } else if (storeJSON.item) {
        collection = db.collection('ac360-count');

        const operator = Object.assign({}, storeJSON.operatorInfo);
        const item = Object.assign({}, storeJSON.item);

        const formattedCount = {
            timestamp: storeJSON.timestamp,
            machine: {
                serial: machine.serial,
                name: 'SPF' + machine.name.slice(-1),
                ipAddress: machine.ipAddress
            },
            program: program,
            operator: {
                id: operator.code,
                name: operator.name
            },
            item: {
                id: item.id ? item.id : 0,
                //count: item.count,
                name: item.name,
                standard: program.pace
            },
            station: 1,
            lane: item.sortNumber
        }

        const insertFormattedCount = await db.collection('count').insertOne(formattedCount);

        const state = {
            timestamp: storeJSON.timestamp,
            machine: {
                serial: machine.serial,
                name: 'SPF' + machine.name.slice(-1),
                ipAddress: machine.ipAddress,
            },
            program: program,
            operators: operators,
            status: {
                code: 1,
                name: "System_Running"
            }
        }

        const result = await db.collection('stateTicker').replaceOne({ 'machine.serial': machine.serial }, state, { upsert: true });
    } else if (storeJSON.stack) {
        collection = db.collection('ac360-stack');
    }
    const result = await collection.insertOne(storeJSON);


    if (req.is('application/json')) {
        res.json({ receivedBody: storeJSON });
    } else if (req.body) {
        res.send(storeJSON);
    } else {
        res.json('No body received');
    }
});

router.get('/levelone/all', async (req, res, next) => {
  const stateCollection = db.collection('state');
  const stateTickerCollection = db.collection('stateTicker');
  const countCollection = db.collection('count');

  //const currentDateTime = DateTime.now().toISO();
  let queryDateTime = DateTime.now().toISO();
  //const nowDateTime = DateTime.now().toISO();
  const startDate = new Date(queryDateTime);

  const activeMachineStates = await stateTickerCollection.find({'timestamp': {'$lt': new Date(queryDateTime)}}).sort({ "machine.name": 1 }).toArray();

  async function machineSession(serial) {
      let machineStatesMostRecentFind = await stateCollection.find({ 'machine.serial': parseInt(serial), 'status.code': { $ne: null }}).sort({ timestamp: -1 }).limit(1).toArray();
      let machineStatesMostRecent;
      let machineStatesMostRecentTimestamp;
      if (machineStatesMostRecentFind.length) {
          machineStatesMostRecent = machineStatesMostRecentFind[0];
          machineStatesMostRecentTimestamp = new Date(machineStatesMostRecent.timestamp);
      }
       
      let diff;
      if (machineStatesMostRecent.status && machineStatesMostRecent.status.code == 1) {
          let machineStatesNextMostRecent;
          do {
              machineStatesMostRecentFind = await stateCollection.find({ 'machine.serial': parseInt(serial), 'status.code': { $ne: null }, 'timestamp': { '$lt': new Date(machineStatesMostRecentTimestamp) } }).sort({ timestamp: -1 }).limit(1).toArray();
              if (machineStatesMostRecentFind.length) {
                  machineStatesNextMostRecent = machineStatesMostRecentFind[0];
                  if (machineStatesNextMostRecent.status.code == 1) {
                      machineStatesMostRecent = Object.assign({}, machineStatesNextMostRecent);
                      machineStatesMostRecentTimestamp = new Date(machineStatesNextMostRecent.timestamp);
                      
                  } else {
                      break;
                  }
              } else {
                  break;
              }
          } while (machineStatesNextMostRecent.status.code == 1)
          diff = Interval.fromDateTimes(DateTime.fromISO(machineStatesMostRecentTimestamp.toISOString()), DateTime.now());
          const sessionDuration = Duration.fromMillis(diff.length());
          const sessionObject = { start: DateTime.fromISO(machineStatesMostRecentTimestamp.toISOString()), end: DateTime.now(), duration: sessionDuration.as('seconds'), state: machineStatesMostRecent }
          return sessionObject;
      } else if (machineStatesMostRecent.status) {
          diff = Interval.fromDateTimes(DateTime.fromISO(machineStatesMostRecentTimestamp.toISOString()), DateTime.now());
          const sessionDuration = Duration.fromMillis(diff.length());
          const sessionObject = { start: machineStatesMostRecent.timestamp, end: DateTime.now(), duration: sessionDuration.as('seconds'), state: machineStatesMostRecent }
          return sessionObject;
      } else {
          const sessionObject = { start: DateTime.now(), end: DateTime.now(), duration: 0, state: machineStatesMostRecent };
          return sessionObject;
      }
  }

  const machineRunTimesArray = await Promise.all(activeMachineStates.map(async (machineState) => {
      if (machineState.status.code == 1) {
          const serial = machineState.machine.serial;
          const session = await machineSession(serial);
          //const machineDuration = arr.reduce((duration, session) => duration + session.duration, 0);
          const machineDuration = session.duration;

          const operators = await Promise.all(machineState.operators.map(async (operator) => {
              if (operator.id == 0) {
                  operator.id = serial + 900000;
                  //result.push({ id: serial + 900000, station: operator.station ? operator.station : 1 })
              }

              const pipeline = [{
                  '$match': {
                      'machine.serial': serial,
                      'operator.id': operator.id,
                      'station': operator.station ? operator.station : 1,
                      'timestamp': { '$gte': new Date(session.start) }
                  }
              }, {
                  '$group': {
                      '_id': '$item.name',
                      'count': {
                          '$count': {}
                      },
                      'standard': {
                          '$first': '$item.standard'
                      },
                      'operator': { '$first': '$operator' },
                      'station': { '$first': '$station' }
                  }
              }, {
                  '$addFields': {
                      'timeCreditDenom': {
                          '$divide': [
                              '$standard', 3600
                          ]
                      }
                  }
              }, {
                  '$addFields': {
                      'timeCredit': {
                          '$divide': [
                              '$count', '$timeCreditDenom'
                          ]
                      }
                  }
              }]

              const operatorItemTotals = await countCollection.aggregate(pipeline).toArray();

              if (operatorItemTotals.length) {
                  const runTime = parseInt(machineDuration);
                  const operator = operatorItemTotals[0].operator;
                  const station = operatorItemTotals[0].station;
                  const operatorTotal = operatorItemTotals.reduce((total, item) => total + item.count, 0);
                  const operatorTotalTimeCredit = operatorItemTotals.reduce((total, item) => {
                      if (item.standard < 60) {
                          return total + (item.timeCredit / 60);
                      } else {
                          return total + item.timeCredit;
                      }

                  }, 0);
                  const operatorEfficiency = parseInt((operatorTotalTimeCredit / runTime) * 100);
                  const operatorPace = (operatorTotal / (runTime / 60)) * 60;
                  const tasks = operatorItemTotals.map((item) => {
                      let standard;
                      if (item.standard < 60) {
                          standard = item.standard * 60;
                      } else {
                          standard = item.standard;
                      }
                      return {
                          name: item['_id'],
                          standard: standard
                      }
                  })
                  return {
                      id: operator.id || 0,
                      name: operator.name ? operator.name : operator.id,
                      pace: parseInt(operatorPace),
                      timeOnTask: parseInt(runTime),
                      count: parseInt(operatorTotal) || 0,
                      efficiency: operatorEfficiency,
                      station: station ? station : 1,
                      tasks: tasks
                  };
              }

              return;
          }));
          delete machineState.machine.ipAddress;
          if (machineState.status.softrolColor) {
              machineState.status.color = '' + machineState.status.softrolColor;
              delete machineState.status.softrolColor;
          }
          let fault = null;
          if (machineState.status.code >= 2) {
              if (machineState.status.color == null) {
                  machineState.status.color = 'Red';
              }
              fault = machineState.status;
          } else if (machineState.status.code == 1) {
              if (machineState.status.color == null) {
                  machineState.status.color = 'Green';
              }
          } else {
              if (machineState.status.color == null) {
                  machineState.status.color = 'Gray';
              }
          }
          const machineTotalCountFind = await countCollection.find({ 'machine.serial': parseInt(serial), 'timestamp': { '$gte': new Date(queryDateTime) } }).toArray();
          let items = [];
          const totalCount = machineTotalCountFind.length;
          const itemTemplate = {
              id: 1,
              count: 0
          }
          items.push(itemTemplate);
          items.push(itemTemplate);
          items.push(itemTemplate);
          items.push(itemTemplate);
          return { status: machineState.status, machineInfo: machineState.machine, fault: fault, timeOnTask: parseInt(machineDuration), onTime: parseInt(machineDuration), totalCount: parseInt(totalCount), items: items, operators: operators.filter(element => element != null) };
      } else {
          delete machineState.machine.ipAddress;
          if (machineState.status.softrolColor) {
              machineState.status.color = '' + machineState.status.softrolColor;
              delete machineState.status.softrolColor;
          }
          let fault = null;
          if (machineState.status.code >= 2) {
              if (machineState.status.color == null) {
                  machineState.status.color = 'Red';
              }
              fault = machineState.status;
          } else if (machineState.status.code == 1) {
              if (machineState.status.color == null) {
                  machineState.status.color = 'Green';
              }
          } else {
              if (machineState.status.color == null) {
                  machineState.status.color = 'Gray';
              }
          }
          return { status: machineState.status, machineInfo: machineState.machine, fault: fault, timeOnTask: 0, onTime: 0, totalCount: 0, items: [], operators: [] };
      }
  }));
  res.json(machineRunTimesArray);
});

router.get('/production/statistics/machines/all', async (req, res, next) => {
  const stateCollection = db.collection('state');
  const stateTickerCollection = db.collection('stateTicker');
  const countCollection = db.collection('count');

  const currentDateTime = DateTime.now().startOf('day').toISO();
  const nowDateTime = DateTime.now().toISO();
  const startDate = new Date(currentDateTime);

  const activeMachineStates = await stateTickerCollection.find({timestamp: {'$gte': new Date(currentDateTime)}}).sort({ "machine.name": 1 }).toArray();

  async function machineSessions(serial) {

      let sessionArray = [];

      const machineStatesHistorySinceStart = await stateCollection.find({ 'machine.serial': parseInt(serial), status: { $ne: null }, 'timestamp': { '$gte': new Date(currentDateTime) } }).sort({ timestamp: -1 }).toArray();
      const machineStatesHistoryPreviousOne = await stateCollection.find({ 'machine.serial': parseInt(serial), status: { $ne: null }, 'timestamp': { '$lte': new Date(currentDateTime) } }).sort({ timestamp: -1 }).limit(1).toArray();
      const machineStatesHistory = machineStatesHistorySinceStart.concat(machineStatesHistoryPreviousOne);
      while (machineStatesHistory.length) {
          let lastSessionStart, lastSessionEnd;
          let lastSessionStartTS, lastSessionEndTS;
          let diff;

          do {
              lastSessionStart = machineStatesHistory.pop();

              if (lastSessionStart.status.code == 1) {
                  const lastSessionStartTSCheck = new Date(lastSessionStart.timestamp);
                  if (startDate > lastSessionStartTSCheck) {
                      lastSessionStartTS = startDate;
                  } else {
                      lastSessionStartTS = new Date(lastSessionStart.timestamp);
                  }
              }
          } while (machineStatesHistory.length && lastSessionStart.status.code != 1) //HERE, NEED TO CONTINUE UNITL END FOUND

          if (machineStatesHistory.length) {
              do {
                  lastSessionEnd = machineStatesHistory.pop();
              } while (machineStatesHistory.length && lastSessionEnd.status.code == 1)
              if (!lastSessionEnd || lastSessionEnd.status.code == 1) {
                  lastSessionEndTS = new Date();
              } else {
                  lastSessionEndTS = new Date(lastSessionEnd.timestamp);
              }
          } else {
              lastSessionEndTS = new Date();
          }

          if (lastSessionStartTS && lastSessionEndTS) {
              diff = Interval.fromDateTimes(DateTime.fromISO(lastSessionStartTS.toISOString()), DateTime.fromISO(lastSessionEndTS.toISOString()));
          } else if (lastSessionStartTS) {
              lastSessionEndTS = new Date();
              diff = Interval.fromDateTimes(DateTime.fromISO(lastSessionStartTS.toISOString()), DateTime.fromISO(lastSessionEndTS.toISOString()));
          }

          if (diff && diff.isValid) {
              const sessionDuration = Duration.fromMillis(diff.length());
              const sessionDurationString = sessionDuration.as('seconds') > 60 ? sessionDuration.as('minutes') + ' minutes' : sessionDuration.as('seconds') + ' seconds';
              let sessionObject = { start: DateTime.fromISO(lastSessionStartTS.toISOString()), duration: sessionDuration.as('seconds') }
              sessionObject['end'] = DateTime.fromISO(lastSessionEndTS.toISOString());
              sessionArray.push(sessionObject);
          }

      }
      return sessionArray;
  }

  const machineRunTimesArray = await Promise.all(activeMachineStates.map(async (machineState) => {
      const serial = machineState.machine.serial;
      const arr = await machineSessions(serial);
      const machineDuration = arr.reduce((duration, session) => duration + session.duration, 0);

      const operators = await Promise.all(machineState.operators.map(async (operator) => {
          if (operator.id == 0) {
              operator.id = serial + 900000;
              //result.push({ id: serial + 900000, station: operator.station ? operator.station : 1 })
          }

          const pipeline = [{
              '$match': {
                  'machine.serial': serial,
                  'operator.id': operator.id,
                  'station': operator.station ? operator.station : 1,
                  'timestamp': { '$gte': new Date(currentDateTime) }
              }
          }, {
              '$group': {
                  '_id': '$item.name',
                  'count': {
                      '$count': {}
                  },
                  'standard': {
                      '$first': '$item.standard'
                  },
                  'operator': { '$first': '$operator' },
                  'station': { '$first': '$station' }
              }
          }, {
              '$addFields': {
                  'timeCreditDenom': {
                      '$divide': [
                          '$standard', 3600
                      ]
                  }
              }
          }, {
              '$addFields': {
                  'timeCredit': {
                      '$divide': [
                          '$count', '$timeCreditDenom'
                      ]
                  }
              }
          }]

          const operatorItemTotals = await countCollection.aggregate(pipeline).toArray();

          if (operatorItemTotals.length) {
              const runTime = parseInt(machineDuration);
              const operator = operatorItemTotals[0].operator;
              const station = operatorItemTotals[0].station;
              const operatorTotal = operatorItemTotals.reduce((total, item) => total + item.count, 0);
              const operatorTotalTimeCredit = operatorItemTotals.reduce((total, item) => {
                  if (item.standard < 60) {
                      return total + (item.timeCredit / 60);
                  } else {
                      return total + item.timeCredit;
                  }
                  
              }, 0 );
              const operatorEfficiency = parseInt((operatorTotalTimeCredit / runTime) * 100);
              const operatorPace = (operatorTotal / (runTime / 60)) * 60;
              const tasks = operatorItemTotals.map((item) => {
                  let standard;
                  if (item.standard < 60) {
                      standard = item.standard * 60;
                  } else {
                      standard = item.standard;
                  }
                  return {
                      name: item['_id'],
                      standard: standard
                  }
              })
              return {
                  id: operator.id || 0,
                  name: operator.name ? operator.name : operator.id,
                  pace: parseInt(operatorPace),
                  timeOnTask: parseInt(runTime),
                  count: parseInt(operatorTotal) || 0,
                  efficiency: operatorEfficiency,
                  station: station ? station : 1,
                  tasks: tasks
              };
          }

          return;
      }));
      delete machineState.machine.ipAddress;
      if (machineState.status.softrolColor) {
          machineState.status.color = '' + machineState.status.softrolColor;
          delete machineState.status.softrolColor;
      }
      let fault = null;
      if (machineState.status.code >= 2) {
          if (machineState.status.color == null) {
              machineState.status.color = 'Red';
          }
          fault = machineState.status;
      } else if (machineState.status.code == 1) {
          if (machineState.status.color == null) {
              machineState.status.color = 'Green';
          }
      } else {
          if (machineState.status.color == null) {
              machineState.status.color = 'Gray';
          }
      }
      const machineTotalCountFind = await countCollection.find({ 'machine.serial': parseInt(serial), 'timestamp': { '$gte': new Date(currentDateTime) } }).toArray();
      let items = [];
      const totalCount = machineTotalCountFind.length;
              const itemTemplate = {
          id: 1,
          count: 0
      }
      items.push(itemTemplate);
      items.push(itemTemplate);
      items.push(itemTemplate);
      items.push(itemTemplate);
      return { status: machineState.status, machineInfo: machineState.machine, fault: fault, timeOnTask: parseInt(machineDuration), onTime: parseInt(machineDuration), totalCount: parseInt(totalCount), items: items, operators: operators.filter(element => element != null) };
  }));
  res.json(machineRunTimesArray);
});

  router.get("/ticker/all", async (req, res, next) => {
    const tickerArray = await getTicker();
    res.json(tickerArray);
  });

  router.get("/ticker/machines/all", async (req, res, next) => {
    const machineListFromTicker = await getMachineListFromTicker();
    res.json(machineListFromTicker);
  });

  router.get("/counts/all", async (req, res, next) => {
    const counts = await getAllOperatorCounts();
    res.json(counts);
  });

  router.get("/machine/operator/lists", async (req, res, next) => {
    const lists = await getMachineOperatorLists();
    res.json(lists);
  });

  router.get("/machine/operator/counts", async (req, res, next) => {
    const machineList = await getMachineOperatorLists();
    let resultArray = [];
    for await (const machine of machineList) {
      const machineOperatorCounts = await getMachineOperatorCounts(machine);
      resultArray.push(machineOperatorCounts);
    }
    res.json(resultArray);
  });

  /*** Run Session Start */

router.get('/run-session/state/cycles', async (req, res) => {
  try {
    // Step 1: Parse and validate query parameters
    const { start, end, serial } = parseAndValidateQueryParams(req);
    
    // Step 2: Create padded time range
    const { paddedStart, paddedEnd } = createPaddedTimeRange(start, end);
    
    // Step 3: Get all state records using state.js utility
    const states = await fetchStatesForMachine(db, serial, paddedStart, paddedEnd);

    // Step 4: Extract cycles using state.js utility
    const cycles = extractCyclesFromStates(states, start, end);

    // Step 5: For each cycle, get count records using count.js utility
    for (const cycle of cycles) {
      const countData = await getCountRecords(db, serial, cycle.start, cycle.end);
      cycle.counts = countData;
    }

    res.json(cycles);

  } catch (error) {
    logger.error('Error calculating session cycles with counts:', error);
    res.status(500).json({ error: 'Failed to fetch session cycles' });
  }
});

  /*** Run Session End */

  /***  Operator Cycle Start */
router.get('/run-session/state/operator-cycles', async (req, res) => {
  try {
    // Step 1: Parse and validate query parameters
    const { start, end, serial } = parseAndValidateQueryParams(req);
    
    // Step 2: Create padded time range
    const { paddedStart, paddedEnd } = createPaddedTimeRange(start, end);
    
    // Step 3: Get all state records using state.js utility
    const states = await fetchStatesForMachine(db, serial, paddedStart, paddedEnd);
    // Step 4: Group states by machine using state.js utility
    const groupedByMachine = groupStatesByMachine(states);

    const allResults = [];

    for (const machineKey of Object.keys(groupedByMachine)) {
      const group = groupedByMachine[machineKey];
      const { serial: machineSerial, mode: machineMode } = group.machine;
      const isAc360 = machineMode === 'ac360';

      // Step 5: Extract cycles using state.js utility
      const cycles = extractCyclesFromStates(group.states, start, end);

      // Step 6: For each cycle, get count records and process operators
      for (const cycle of cycles) {
        const countRecords = await getCountRecords(db, machineSerial, cycle.start, cycle.end);
        
        // Step 7: Get operator-item mapping using count.js utility
        const operatorMap = getOperatorItemMapFromCounts(countRecords);

        // Step 8: Format operators data
        cycle.operators = Object.entries(operatorMap).map(([opId, data]) => {
          const items = Object.entries(data.items).map(([itemId, itemArray]) => ({
            id: itemArray[0].id,
            name: itemArray[0].name,
            standard: itemArray[0].standard,
            count: itemArray.length
          }));

          return {
            id: parseInt(opId),
            name: data.name,
            items
          };
        });
      }

      allResults.push({
        machine: group.machine,
        cycles
      });
    }

    res.json(allResults);
  } catch (error) {
    logger.error('Error calculating operator cycles with item totals:', error);
    res.status(500).json({ error: 'Failed to fetch operator-based session cycles' });
  }
});
  /***  Operator Cycle End */
  router.get("/machine/operator/counts", async (req, res, next) => {
    const machineList = await getMachineOperatorLists();
    let resultArray = [];
    for await (const machine of machineList) {
      const machineOperatorCounts = await getMachineOperatorCounts(machine);
      resultArray.push(machineOperatorCounts);
    }
    res.json(resultArray);
  });

    /***  Analytics Routes Start */
  router.get('/analytics/machine-performance', async (req, res) => {
    try {
     // Step 1: Parse and validate query parameters
     const { start, end, serial } = parseAndValidateQueryParams(req);
     // Step 2: Create padded time range
     const { paddedStart, paddedEnd } = createPaddedTimeRange(start, end);   
     // Step 3: Get all state records using state.js utility
     const states = await fetchStatesForMachine(db, serial, paddedStart, paddedEnd);
      // Step 4: Get count records using count.js utility
      const counts = await getCountRecords(db, serial, start, end);
      // Step 5: Calculate metrics using analytics.js functions
      const totalQueryMs = new Date(end) - new Date(start);
      const runtimeMs = await calculateRuntime(states, start, end);
      const downtimeMs = calculateDowntime(totalQueryMs, runtimeMs);
      const totalCount = calculateTotalCount(counts);
      const misfeedCount = calculateMisfeeds(counts);
      const availability = calculateAvailability(runtimeMs, downtimeMs, totalQueryMs);
      const throughput = calculateThroughput(totalCount, misfeedCount);
      const efficiency = calculateEfficiency(runtimeMs, totalCount, counts);
      const oee = calculateOEE(availability, efficiency, throughput);

      // Step 6: Get current machine status
      const currentState = states[states.length - 1] || {};

      // Step 7: Format response
      const response = {
        machine: {
          name: currentState.machine?.name || 'Unknown',
          serial: currentState.machine?.serial || serial
        },
        currentStatus: {
          code: currentState.status?.code || 0,
          name: currentState.status?.name || 'Unknown'
        },
        metrics: {
          runtime: {
            total: runtimeMs,
            formatted: formatDuration(runtimeMs)
          },
          downtime: {
            total: downtimeMs,
            formatted: formatDuration(downtimeMs)
          },
          output: {
            totalCount,
            misfeedCount
          },
          performance: {
            availability: {
              value: availability,
              percentage: (availability * 100).toFixed(2) + '%'
            },
            throughput: {
              value: throughput,
              percentage: (throughput * 100).toFixed(2) + '%'
            },
            efficiency: {
              value: efficiency,
              percentage: (efficiency * 100).toFixed(2) + '%'
            },
            oee: {
              value: oee,
              percentage: (oee * 100).toFixed(2) + '%'
            }
          }
        },
        timeRange: {
          start: start,
          end: end,
          total: formatDuration(totalQueryMs)
        }
      };

      res.json(response);
    } catch (error) {
      logger.error('Error calculating machine performance metrics:', error);
      res.status(500).json({ error: 'Failed to fetch machine performance metrics' });
    }
  });

    /***  Analytics Route End */

  return router;
}

