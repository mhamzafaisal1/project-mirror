/*** alpha API controller */
/*** Contributors: RTI II */

/** MODULE REQUIRES */
const express = require("express");
const router = express.Router();
const { DateTime, Duration, Interval } = require("luxon"); //For handling dates and times
const ObjectId = require("mongodb").ObjectId;
const startupDT = DateTime.now();
const bcrypt = require("bcryptjs");
const {
  parseAndValidateQueryParams,
  createPaddedTimeRange,
  createMongoDateQuery,
  formatDuration,
  getHourlyIntervals,
} = require("../../utils/time");
const {
  fetchStatesForMachine,
  fetchStatesForOperator,
  groupStatesByMachine,
  groupStatesByOperator,
  extractCyclesFromStates,
  extractPausedCyclesFromStates,
  extractFaultCyclesFromStates,
  processAllMachinesCycles,
  getAllMachinesFromStates,
  calculateHourlyStateDurations,
  groupStatesByOperatorAndSerial,
  extractAllCyclesFromStates,
  getCompletedCyclesForOperator,
  extractFaultCycles
} = require("../../utils/state");
const {
  getCountRecords,
  getOperatorItemMapFromCounts,
  getValidCounts,
  getMisfeedCounts,
  getValidCountsForOperator,
  getMisfeedCountsForOperator,
  getOperatorNameFromCount,
  extractItemNamesFromCounts,
  getCountsForOperator,
  getCountsForOperatorMachinePairs,
  groupCountsByOperatorAndMachine,
  processCountStatistics,
  getCountsForMachine,
  groupCountsByItem
} = require("../../utils/count");
const {
  calculateRuntime,
  calculateDowntime,
  calculateTotalCount,
  calculateMisfeeds,
  calculateAvailability,
  calculateThroughput,
  calculateEfficiency,
  calculateOEE,
  calculateOperatorRuntime,
  calculateOperatorPausedTime,
  calculateOperatorFaultTime,
  calculatePiecesPerHour,
  calculateOperatorTimes,
} = require("../../utils/analytics");

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

  router.post("/ac360/post", async (req, res, next) => {
    const currentDateTime = new Date();
    let bodyJSON = Object.assign({}, req.body);
    if (bodyJSON.timestamp) {
      bodyJSON.timestamp = new Date(DateTime.fromISO(bodyJSON.timestamp + "Z"));
      /** TEMPORARY FIX for future timestamps coming from AC360s on boot,  */
      if (bodyJSON.timestamp > currentDateTime) {
        bodyJSON.timestamp = currentDateTime;
      }
    }

    let storeJSON = Object.assign({}, bodyJSON);
    if (req.socket.remoteAddress) {
      const ipStrings = req.socket.remoteAddress.split(":");
      storeJSON.machineInfo["ipAddress"] = "" + ipStrings[ipStrings.length - 1];
    }
    const machine = Object.assign({}, storeJSON.machineInfo);
    const program = Object.assign({ mode: "ac360" }, storeJSON.programInfo);
    const operators = [
      { id: storeJSON.operatorInfo.code, name: storeJSON.operatorInfo.name },
    ];

    let collection = db.collection("ac360");
    if (storeJSON.status) {
      collection = db.collection("ac360-status");

      const status = Object.assign({}, storeJSON.status);

      const state = {
        timestamp: storeJSON.timestamp,
        machine: {
          serial: machine.serial,
          name: "SPF" + machine.name.slice(-1),
          ipAddress: machine.ipAddress,
        },
        program: program,
        operators: operators,
        status: status,
      };

      const stateTickerResult = await db
        .collection("stateTicker")
        .replaceOne({ "machine.serial": machine.serial }, state, {
          upsert: true,
        });
      const stateResult = await db.collection("state").insertOne(state);
    } else if (storeJSON.item) {
      collection = db.collection("ac360-count");

      const operator = Object.assign({}, storeJSON.operatorInfo);
      const item = Object.assign({}, storeJSON.item);

      const formattedCount = {
        timestamp: storeJSON.timestamp,
        machine: {
          serial: machine.serial,
          name: "SPF" + machine.name.slice(-1),
          ipAddress: machine.ipAddress,
        },
        program: program,
        operator: {
          id: operator.code,
          name: operator.name,
        },
        item: {
          id: item.id ? item.id : 0,
          //count: item.count,
          name: item.name,
          standard: program.pace,
        },
        station: 1,
        lane: item.sortNumber,
      };

      const insertFormattedCount = await db
        .collection("count")
        .insertOne(formattedCount);

      const state = {
        timestamp: storeJSON.timestamp,
        machine: {
          serial: machine.serial,
          name: "SPF" + machine.name.slice(-1),
          ipAddress: machine.ipAddress,
        },
        program: program,
        operators: operators,
        status: {
          code: 1,
          name: "System_Running",
        },
      };

      const result = await db
        .collection("stateTicker")
        .replaceOne({ "machine.serial": machine.serial }, state, {
          upsert: true,
        });
    } else if (storeJSON.stack) {
      collection = db.collection("ac360-stack");
    }
    const result = await collection.insertOne(storeJSON);

    if (req.is("application/json")) {
      res.json({ receivedBody: storeJSON });
    } else if (req.body) {
      res.send(storeJSON);
    } else {
      res.json("No body received");
    }
  });

  router.get("/levelone/all", async (req, res, next) => {
    const stateCollection = db.collection("state");
    const stateTickerCollection = db.collection("stateTicker");
    const countCollection = db.collection("count");

    //const currentDateTime = DateTime.now().toISO();
    let queryDateTime = DateTime.now().toISO();
    //const nowDateTime = DateTime.now().toISO();
    const startDate = new Date(queryDateTime);

    const activeMachineStates = await stateTickerCollection
      .find({ timestamp: { $lt: new Date(queryDateTime) } })
      .sort({ "machine.name": 1 })
      .toArray();

    async function machineSession(serial) {
      let machineStatesMostRecentFind = await stateCollection
        .find({
          "machine.serial": parseInt(serial),
          "status.code": { $ne: null },
        })
        .sort({ timestamp: -1 })
        .limit(1)
        .toArray();
      let machineStatesMostRecent;
      let machineStatesMostRecentTimestamp;
      if (machineStatesMostRecentFind.length) {
        machineStatesMostRecent = machineStatesMostRecentFind[0];
        machineStatesMostRecentTimestamp = new Date(
          machineStatesMostRecent.timestamp
        );
      }

      let diff;
      if (
        machineStatesMostRecent.status &&
        machineStatesMostRecent.status.code == 1
      ) {
        let machineStatesNextMostRecent;
        do {
          machineStatesMostRecentFind = await stateCollection
            .find({
              "machine.serial": parseInt(serial),
              "status.code": { $ne: null },
              timestamp: { $lt: new Date(machineStatesMostRecentTimestamp) },
            })
            .sort({ timestamp: -1 })
            .limit(1)
            .toArray();
          if (machineStatesMostRecentFind.length) {
            machineStatesNextMostRecent = machineStatesMostRecentFind[0];
            if (machineStatesNextMostRecent.status.code == 1) {
              machineStatesMostRecent = Object.assign(
                {},
                machineStatesNextMostRecent
              );
              machineStatesMostRecentTimestamp = new Date(
                machineStatesNextMostRecent.timestamp
              );
            } else {
              break;
            }
          } else {
            break;
          }
        } while (machineStatesNextMostRecent.status.code == 1);
        diff = Interval.fromDateTimes(
          DateTime.fromISO(machineStatesMostRecentTimestamp.toISOString()),
          DateTime.now()
        );
        const sessionDuration = Duration.fromMillis(diff.length());
        const sessionObject = {
          start: DateTime.fromISO(
            machineStatesMostRecentTimestamp.toISOString()
          ),
          end: DateTime.now(),
          duration: sessionDuration.as("seconds"),
          state: machineStatesMostRecent,
        };
        return sessionObject;
      } else if (machineStatesMostRecent.status) {
        diff = Interval.fromDateTimes(
          DateTime.fromISO(machineStatesMostRecentTimestamp.toISOString()),
          DateTime.now()
        );
        const sessionDuration = Duration.fromMillis(diff.length());
        const sessionObject = {
          start: machineStatesMostRecent.timestamp,
          end: DateTime.now(),
          duration: sessionDuration.as("seconds"),
          state: machineStatesMostRecent,
        };
        return sessionObject;
      } else {
        const sessionObject = {
          start: DateTime.now(),
          end: DateTime.now(),
          duration: 0,
          state: machineStatesMostRecent,
        };
        return sessionObject;
      }
    }

    const machineRunTimesArray = await Promise.all(
      activeMachineStates.map(async (machineState) => {
        if (machineState.status.code == 1) {
          const serial = machineState.machine.serial;
          const session = await machineSession(serial);
          //const machineDuration = arr.reduce((duration, session) => duration + session.duration, 0);
          const machineDuration = session.duration;

          const operators = await Promise.all(
            machineState.operators.map(async (operator) => {
              if (operator.id == 0) {
                operator.id = serial + 900000;
                //result.push({ id: serial + 900000, station: operator.station ? operator.station : 1 })
              }

              const pipeline = [
                {
                  $match: {
                    "machine.serial": serial,
                    "operator.id": operator.id,
                    station: operator.station ? operator.station : 1,
                    timestamp: { $gte: new Date(session.start) },
                  },
                },
                {
                  $group: {
                    _id: "$item.name",
                    count: {
                      $count: {},
                    },
                    standard: {
                      $first: "$item.standard",
                    },
                    operator: { $first: "$operator" },
                    station: { $first: "$station" },
                  },
                },
                {
                  $addFields: {
                    timeCreditDenom: {
                      $divide: ["$standard", 3600],
                    },
                  },
                },
                {
                  $addFields: {
                    timeCredit: {
                      $divide: ["$count", "$timeCreditDenom"],
                    },
                  },
                },
              ];

              const operatorItemTotals = await countCollection
                .aggregate(pipeline)
                .toArray();

              if (operatorItemTotals.length) {
                const runTime = parseInt(machineDuration);
                const operator = operatorItemTotals[0].operator;
                const station = operatorItemTotals[0].station;
                const operatorTotal = operatorItemTotals.reduce(
                  (total, item) => total + item.count,
                  0
                );
                const operatorTotalTimeCredit = operatorItemTotals.reduce(
                  (total, item) => {
                    if (item.standard < 60) {
                      return total + item.timeCredit / 60;
                    } else {
                      return total + item.timeCredit;
                    }
                  },
                  0
                );
                const operatorEfficiency = parseInt(
                  (operatorTotalTimeCredit / runTime) * 100
                );
                const operatorPace = (operatorTotal / (runTime / 60)) * 60;
                const tasks = operatorItemTotals.map((item) => {
                  let standard;
                  if (item.standard < 60) {
                    standard = item.standard * 60;
                  } else {
                    standard = item.standard;
                  }
                  return {
                    name: item["_id"],
                    standard: standard,
                  };
                });
                return {
                  id: operator.id || 0,
                  name: operator.name ? operator.name : operator.id,
                  pace: parseInt(operatorPace),
                  timeOnTask: parseInt(runTime),
                  count: parseInt(operatorTotal) || 0,
                  efficiency: operatorEfficiency,
                  station: station ? station : 1,
                  tasks: tasks,
                };
              }

              return;
            })
          );
          delete machineState.machine.ipAddress;
          if (machineState.status.softrolColor) {
            machineState.status.color = "" + machineState.status.softrolColor;
            delete machineState.status.softrolColor;
          }
          let fault = null;
          if (machineState.status.code >= 2) {
            if (machineState.status.color == null) {
              machineState.status.color = "Red";
            }
            fault = machineState.status;
          } else if (machineState.status.code == 1) {
            if (machineState.status.color == null) {
              machineState.status.color = "Green";
            }
          } else {
            if (machineState.status.color == null) {
              machineState.status.color = "Gray";
            }
          }
          const machineTotalCountFind = await countCollection
            .find({
              "machine.serial": parseInt(serial),
              timestamp: { $gte: new Date(queryDateTime) },
            })
            .toArray();
          let items = [];
          const totalCount = machineTotalCountFind.length;
          const itemTemplate = {
            id: 1,
            count: 0,
          };
          items.push(itemTemplate);
          items.push(itemTemplate);
          items.push(itemTemplate);
          items.push(itemTemplate);
          return {
            status: machineState.status,
            machineInfo: machineState.machine,
            fault: fault,
            timeOnTask: parseInt(machineDuration),
            onTime: parseInt(machineDuration),
            totalCount: parseInt(totalCount),
            items: items,
            operators: operators.filter((element) => element != null),
          };
        } else {
          delete machineState.machine.ipAddress;
          if (machineState.status.softrolColor) {
            machineState.status.color = "" + machineState.status.softrolColor;
            delete machineState.status.softrolColor;
          }
          let fault = null;
          if (machineState.status.code >= 2) {
            if (machineState.status.color == null) {
              machineState.status.color = "Red";
            }
            fault = machineState.status;
          } else if (machineState.status.code == 1) {
            if (machineState.status.color == null) {
              machineState.status.color = "Green";
            }
          } else {
            if (machineState.status.color == null) {
              machineState.status.color = "Gray";
            }
          }
          return {
            status: machineState.status,
            machineInfo: machineState.machine,
            fault: fault,
            timeOnTask: 0,
            onTime: 0,
            totalCount: 0,
            items: [],
            operators: [],
          };
        }
      })
    );
    res.json(machineRunTimesArray);
  });

  router.get("/production/statistics/machines/all", async (req, res, next) => {
    const stateCollection = db.collection("state");
    const stateTickerCollection = db.collection("stateTicker");
    const countCollection = db.collection("count");

    const currentDateTime = DateTime.now().startOf("day").toISO();
    const nowDateTime = DateTime.now().toISO();
    const startDate = new Date(currentDateTime);

    const activeMachineStates = await stateTickerCollection
      .find({ timestamp: { $gte: new Date(currentDateTime) } })
      .sort({ "machine.name": 1 })
      .toArray();

    async function machineSessions(serial) {
      let sessionArray = [];

      const machineStatesHistorySinceStart = await stateCollection
        .find({
          "machine.serial": parseInt(serial),
          status: { $ne: null },
          timestamp: { $gte: new Date(currentDateTime) },
        })
        .sort({ timestamp: -1 })
        .toArray();
      const machineStatesHistoryPreviousOne = await stateCollection
        .find({
          "machine.serial": parseInt(serial),
          status: { $ne: null },
          timestamp: { $lte: new Date(currentDateTime) },
        })
        .sort({ timestamp: -1 })
        .limit(1)
        .toArray();
      const machineStatesHistory = machineStatesHistorySinceStart.concat(
        machineStatesHistoryPreviousOne
      );
      while (machineStatesHistory.length) {
        let lastSessionStart, lastSessionEnd;
        let lastSessionStartTS, lastSessionEndTS;
        let diff;

        do {
          lastSessionStart = machineStatesHistory.pop();

          if (lastSessionStart.status.code == 1) {
            const lastSessionStartTSCheck = new Date(
              lastSessionStart.timestamp
            );
            if (startDate > lastSessionStartTSCheck) {
              lastSessionStartTS = startDate;
            } else {
              lastSessionStartTS = new Date(lastSessionStart.timestamp);
            }
          }
        } while (
          machineStatesHistory.length &&
          lastSessionStart.status.code != 1
        ); //HERE, NEED TO CONTINUE UNITL END FOUND

        if (machineStatesHistory.length) {
          do {
            lastSessionEnd = machineStatesHistory.pop();
          } while (
            machineStatesHistory.length &&
            lastSessionEnd.status.code == 1
          );
          if (!lastSessionEnd || lastSessionEnd.status.code == 1) {
            lastSessionEndTS = new Date();
          } else {
            lastSessionEndTS = new Date(lastSessionEnd.timestamp);
          }
        } else {
          lastSessionEndTS = new Date();
        }

        if (lastSessionStartTS && lastSessionEndTS) {
          diff = Interval.fromDateTimes(
            DateTime.fromISO(lastSessionStartTS.toISOString()),
            DateTime.fromISO(lastSessionEndTS.toISOString())
          );
        } else if (lastSessionStartTS) {
          lastSessionEndTS = new Date();
          diff = Interval.fromDateTimes(
            DateTime.fromISO(lastSessionStartTS.toISOString()),
            DateTime.fromISO(lastSessionEndTS.toISOString())
          );
        }

        if (diff && diff.isValid) {
          const sessionDuration = Duration.fromMillis(diff.length());
          const sessionDurationString =
            sessionDuration.as("seconds") > 60
              ? sessionDuration.as("minutes") + " minutes"
              : sessionDuration.as("seconds") + " seconds";
          let sessionObject = {
            start: DateTime.fromISO(lastSessionStartTS.toISOString()),
            duration: sessionDuration.as("seconds"),
          };
          sessionObject["end"] = DateTime.fromISO(
            lastSessionEndTS.toISOString()
          );
          sessionArray.push(sessionObject);
        }
      }
      return sessionArray;
    }

    const machineRunTimesArray = await Promise.all(
      activeMachineStates.map(async (machineState) => {
        const serial = machineState.machine.serial;
        const arr = await machineSessions(serial);
        const machineDuration = arr.reduce(
          (duration, session) => duration + session.duration,
          0
        );

        const operators = await Promise.all(
          machineState.operators.map(async (operator) => {
            if (operator.id == 0) {
              operator.id = serial + 900000;
              //result.push({ id: serial + 900000, station: operator.station ? operator.station : 1 })
            }

            const pipeline = [
              {
                $match: {
                  "machine.serial": serial,
                  "operator.id": operator.id,
                  station: operator.station ? operator.station : 1,
                  timestamp: { $gte: new Date(currentDateTime) },
                },
              },
              {
                $group: {
                  _id: "$item.name",
                  count: {
                    $count: {},
                  },
                  standard: {
                    $first: "$item.standard",
                  },
                  operator: { $first: "$operator" },
                  station: { $first: "$station" },
                },
              },
              {
                $addFields: {
                  timeCreditDenom: {
                    $divide: ["$standard", 3600],
                  },
                },
              },
              {
                $addFields: {
                  timeCredit: {
                    $divide: ["$count", "$timeCreditDenom"],
                  },
                },
              },
            ];

            const operatorItemTotals = await countCollection
              .aggregate(pipeline)
              .toArray();

            if (operatorItemTotals.length) {
              const runTime = parseInt(machineDuration);
              const operator = operatorItemTotals[0].operator;
              const station = operatorItemTotals[0].station;
              const operatorTotal = operatorItemTotals.reduce(
                (total, item) => total + item.count,
                0
              );
              const operatorTotalTimeCredit = operatorItemTotals.reduce(
                (total, item) => {
                  if (item.standard < 60) {
                    return total + item.timeCredit / 60;
                  } else {
                    return total + item.timeCredit;
                  }
                },
                0
              );
              const operatorEfficiency = parseInt(
                (operatorTotalTimeCredit / runTime) * 100
              );
              const operatorPace = (operatorTotal / (runTime / 60)) * 60;
              const tasks = operatorItemTotals.map((item) => {
                let standard;
                if (item.standard < 60) {
                  standard = item.standard * 60;
                } else {
                  standard = item.standard;
                }
                return {
                  name: item["_id"],
                  standard: standard,
                };
              });
              return {
                id: operator.id || 0,
                name: operator.name ? operator.name : operator.id,
                pace: parseInt(operatorPace),
                timeOnTask: parseInt(runTime),
                count: parseInt(operatorTotal) || 0,
                efficiency: operatorEfficiency,
                station: station ? station : 1,
                tasks: tasks,
              };
            }

            return;
          })
        );
        delete machineState.machine.ipAddress;
        if (machineState.status.softrolColor) {
          machineState.status.color = "" + machineState.status.softrolColor;
          delete machineState.status.softrolColor;
        }
        let fault = null;
        if (machineState.status.code >= 2) {
          if (machineState.status.color == null) {
            machineState.status.color = "Red";
          }
          fault = machineState.status;
        } else if (machineState.status.code == 1) {
          if (machineState.status.color == null) {
            machineState.status.color = "Green";
          }
        } else {
          if (machineState.status.color == null) {
            machineState.status.color = "Gray";
          }
        }
        const machineTotalCountFind = await countCollection
          .find({
            "machine.serial": parseInt(serial),
            timestamp: { $gte: new Date(currentDateTime) },
          })
          .toArray();
        let items = [];
        const totalCount = machineTotalCountFind.length;
        const itemTemplate = {
          id: 1,
          count: 0,
        };
        items.push(itemTemplate);
        items.push(itemTemplate);
        items.push(itemTemplate);
        items.push(itemTemplate);
        return {
          status: machineState.status,
          machineInfo: machineState.machine,
          fault: fault,
          timeOnTask: parseInt(machineDuration),
          onTime: parseInt(machineDuration),
          totalCount: parseInt(totalCount),
          items: items,
          operators: operators.filter((element) => element != null),
        };
      })
    );
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
  //Machine specific count data for cycles within a timestamp range, needs timestamp range and serial number (WORKS !!)
  //Is it still required ?
  router.get("/run-session/state/cycles", async (req, res) => {
    try {
      // Step 1: Parse and validate query parameters
      const { start, end, serial } = parseAndValidateQueryParams(req);

      // Step 2: Create padded time range
      const { paddedStart, paddedEnd } = createPaddedTimeRange(start, end);

      // Step 3: Get all state records using state.js utility
      const states = await fetchStatesForMachine(
        db,
        serial,
        paddedStart,
        paddedEnd
      );

      // Step 4: Extract cycles using state.js utility
      const cycles = extractAllCyclesFromStates(states, start, end);
      const runningCycles = cycles.running;

      // Step 5: For each cycle, get count records using count.js utility
      for (const cycle of runningCycles) {
        const countData = await getCountRecords(
          db,
          serial,
          cycle.start,
          cycle.end
        );
        cycle.counts = countData;
      }

      res.json(runningCycles);
    } catch (error) {
      logger.error("Error calculating session cycles with counts:", error);
      res.status(500).json({ error: "Failed to fetch session cycles" });
    }
  });

  /*** Run Session End */

  /***  Operator Cycle Start */
  //Machine Specific Operator Cycles (WORKS !!)
  //Is it still required ?
  router.get("/run-session/state/operator-cycles", async (req, res) => {
    try {
      // Step 1: Parse and validate query parameters
      const { start, end, serial } = parseAndValidateQueryParams(req);

      // Step 2: Create padded time range
      const { paddedStart, paddedEnd } = createPaddedTimeRange(start, end);

      // Step 3: Get all state records using state.js utility
      const states = await fetchStatesForMachine(
        db,
        serial,
        paddedStart,
        paddedEnd
      );
      // Step 4: Group states by machine using state.js utility
      const groupedByMachine = groupStatesByMachine(states);

      const allResults = [];

      for (const machineKey of Object.keys(groupedByMachine)) {
        const group = groupedByMachine[machineKey];
        const { serial: machineSerial, mode: machineMode } = group.machine;
        const isAc360 = machineMode === "ac360";

        // Step 5: Extract cycles using state.js utility
        const cycles = extractAllCyclesFromStates(group.states, start, end);
        const runningCycles = cycles.running;

        // Step 6: For each cycle, get count records and process operators
        for (const cycle of runningCycles) {
          const countRecords = await getCountRecords(
            db,
            machineSerial,
            cycle.start,
            cycle.end
          );

          // Step 7: Get operator-item mapping using count.js utility
          const operatorMap = getOperatorItemMapFromCounts(countRecords);

          // Step 8: Format operators data
          cycle.operators = Object.entries(operatorMap).map(([opId, data]) => {
            const items = Object.entries(data.items).map(
              ([itemId, itemArray]) => ({
                id: itemArray[0].id,
                name: itemArray[0].name,
                standard: itemArray[0].standard,
                count: itemArray.length,
              })
            );

            return {
              id: parseInt(opId),
              name: data.name,
              items,
            };
          });
        }

        allResults.push({
          machine: group.machine,
          cycles: runningCycles,
        });
      }

      res.json(allResults);
    } catch (error) {
      logger.error(
        "Error calculating operator cycles with item totals:",
        error
      );
      res
        .status(500)
        .json({ error: "Failed to fetch operator-based session cycles" });
    }
  });

  /***  Operator Cycle End */

  /***  Analytics Routes Start */

  // Analytics Route sorted by Machine - for the Machine Analytics dashboard (WORKS !!)
  router.get("/analytics/machine-performance", async (req, res) => {
    try {
      // Step 1: Parse and validate query parameters
      const { start, end, serial } = parseAndValidateQueryParams(req);
      // Step 2: Create padded time range
      const { paddedStart, paddedEnd } = createPaddedTimeRange(start, end);

      let states;
      let groupedStates;

      if (serial) {
        // If serial provided, get states for just that machine
        const machineStates = await fetchStatesForMachine(
          db,
          serial,
          paddedStart,
          paddedEnd
        );
        // Create a single group for this machine
        groupedStates = {
          [serial]: {
            machine: {
              serial: serial,
              name: machineStates[0]?.machine?.name || null,
              mode: machineStates[0]?.program?.mode || null,
            },
            states: machineStates,
          },
        };
      } else {
        // If no serial, get all states and group them
        const allStates = await fetchStatesForMachine(
          db,
          null,
          paddedStart,
          paddedEnd
        );
        groupedStates = groupStatesByMachine(allStates);
      }

      const results = [];

      // Process each machine's states
      for (const [machineSerial, group] of Object.entries(groupedStates)) {
        const states = group.states;

        // Skip if no states found for this machine
        if (!states.length) continue;

        // Extract all types of cycles
        const cycles = extractAllCyclesFromStates(states, start, end);
        const runningCycles = cycles.running;

        // Get counts for this machine
        const validCounts = await getValidCounts(
          db,
          parseInt(machineSerial),
          start,
          end
        );
        // Get misfeed counts for this machine
        const misfeedCounts = await getMisfeedCounts(
          db,
          parseInt(machineSerial),
          start,
          end
        );

        // Calculate metrics for this machine
        const totalQueryMs = new Date(end) - new Date(start);
        const runtimeMs = runningCycles.reduce(
          (total, cycle) => total + cycle.duration,
          0
        );
        const downtimeMs = calculateDowntime(totalQueryMs, runtimeMs);
        const totalCount = calculateTotalCount(validCounts, misfeedCounts);
        const misfeedCount = calculateMisfeeds(misfeedCounts);
        const availability = calculateAvailability(
          runtimeMs,
          downtimeMs,
          totalQueryMs
        );
        const throughput = calculateThroughput(totalCount, misfeedCount);
        const efficiency = calculateEfficiency(
          runtimeMs,
          totalCount,
          validCounts
        );
        const oee = calculateOEE(availability, efficiency, throughput);

        // Get current status for this machine
        const currentState = states[states.length - 1] || {};

        // Format response for this machine
        const machineResponse = {
          machine: {
            name: currentState.machine?.name || "Unknown",
            serial: currentState.machine?.serial || parseInt(machineSerial),
          },
          currentStatus: {
            code: currentState.status?.code || 0,
            name: currentState.status?.name || "Unknown",
          },
          metrics: {
            runtime: {
              total: runtimeMs,
              formatted: formatDuration(runtimeMs),
            },
            downtime: {
              total: downtimeMs,
              formatted: formatDuration(downtimeMs),
            },
            output: {
              totalCount,
              misfeedCount,
            },
            performance: {
              availability: {
                value: availability,
                percentage: (availability * 100).toFixed(2) + "%",
              },
              throughput: {
                value: throughput,
                percentage: (throughput * 100).toFixed(2) + "%",
              },
              efficiency: {
                value: efficiency,
                percentage: (efficiency * 100).toFixed(2) + "%",
              },
              oee: {
                value: oee,
                percentage: (oee * 100).toFixed(2) + "%",
              },
            },
          },
          timeRange: {
            start: start,
            end: end,
            total: formatDuration(totalQueryMs),
          },
        };

        results.push(machineResponse);
      }

      res.json(results);
    } catch (error) {
      logger.error("Error calculating machine performance metrics:", error);
      res
        .status(500)
        .json({ error: "Failed to fetch machine performance metrics" });
    }
  });

  // Analytics Route sorted by Machine - For the multiple bar chart in  non array format(WORKS !!)
  //Is it still required ?
  router.get("/analytics/machine-state-totals", async (req, res) => {
    try {
      // Step 1: Parse and validate query parameters
      const { start, end, serial } = parseAndValidateQueryParams(req);
      // Step 2: Create padded time range
      const { paddedStart, paddedEnd } = createPaddedTimeRange(start, end);

      let results;

      if (serial) {
        // If serial provided, process single machine
        const states = await fetchStatesForMachine(
          db,
          serial,
          paddedStart,
          paddedEnd
        );

        if (!states.length) {
          return res.json([]);
        }

        // Extract all types of cycles
        const cycles = extractAllCyclesFromStates(states, start, end);
        const runningCycles = cycles.running;
        const pausedCycles = cycles.paused;
        const faultCycles = cycles.fault;

        // Calculate total durations
        const runningTime = runningCycles.reduce(
          (total, cycle) => total + cycle.duration,
          0
        );
        const pausedTime = pausedCycles.reduce(
          (total, cycle) => total + cycle.duration,
          0
        );
        const faultedTime = faultCycles.reduce(
          (total, cycle) => total + cycle.duration,
          0
        );

        // Helper function to format duration with hours, minutes, and seconds
        const formatDurationWithSeconds = (ms) => {
          const totalSeconds = Math.floor(ms / 1000);
          const hours = Math.floor(totalSeconds / 3600);
          const minutes = Math.floor((totalSeconds % 3600) / 60);
          const seconds = totalSeconds % 60;

          return {
            hours,
            minutes,
            seconds,
          };
        };

        // Format response for this machine
        results = [
          {
            machine: {
              name: states[0].machine?.name || "Unknown",
              serial: parseInt(serial),
            },
            timeTotals: {
              running: {
                total: runningTime,
                formatted: formatDurationWithSeconds(runningTime),
                cycles: runningCycles,
              },
              paused: {
                total: pausedTime,
                formatted: formatDurationWithSeconds(pausedTime),
                cycles: pausedCycles,
              },
              faulted: {
                total: faultedTime,
                formatted: formatDurationWithSeconds(faultedTime),
                cycles: faultCycles,
              },
            },
            timeRange: {
              start: start,
              end: end,
              total: formatDurationWithSeconds(new Date(end) - new Date(start)),
            },
          },
        ];
      } else {
        // If no serial provided, process all machines
        results = await processAllMachinesCycles(db, paddedStart, paddedEnd);
      }

      res.json(results);
    } catch (error) {
      logger.error("Error calculating machine state time totals:", error);
      res
        .status(500)
        .json({ error: "Failed to fetch machine state time totals" });
    }
  });

  // Analytics Route sorted by Machine - For the multiple bar chart (WORKS !!)

  router.get("/analytics/machine-hourly-states", async (req, res) => {
    try {
      const { start, end, serial } = parseAndValidateQueryParams(req);
      const { paddedStart, paddedEnd } = createPaddedTimeRange(start, end);

      let machines;
      if (serial) {
        machines = [{ serial: parseInt(serial) }];
      } else {
        machines = await getAllMachinesFromStates(db, paddedStart, paddedEnd);
      }

      const startDate = new Date(end);
      const titleDate = startDate.toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
      });

      const results = [];

      for (const machine of machines) {
        const states = await fetchStatesForMachine(
          db,
          machine.serial,
          paddedStart,
          paddedEnd
        );
        if (!states.length) continue;

        const cycles = extractAllCyclesFromStates(states, start, end);
        const runningCycles = cycles.running;
        const pausedCycles = cycles.paused;
        const faultCycles = cycles.fault;

        const runningHours = calculateHourlyStateDurations(
          runningCycles,
          start,
          end,
          "Running"
        );
        const pausedHours = calculateHourlyStateDurations(
          pausedCycles,
          start,
          end,
          "Paused"
        );
        const faultedHours = calculateHourlyStateDurations(
          faultCycles,
          start,
          end,
          "Faulted"
        );

        results.push({
          title: `Machine Activity - ${titleDate}`,
          data: {
            hours: Array.from({ length: 24 }, (_, i) => i),
            series: {
              Running: runningHours,
              Paused: pausedHours,
              Faulted: faultedHours,
            },
          },
          machine: {
            name: states[0].machine?.name || "Unknown",
            serial: machine.serial,
          },
        });
      }

      res.json(results);
    } catch (error) {
      logger.error("Error calculating machine state time totals:", error);
      res
        .status(500)
        .json({ error: "Failed to fetch machine state time totals" });
    }
  });

  // Analytics Route sorted by Operator (WORKS !!)
  router.get("/analytics/operator-performance", async (req, res) => {
    try {
      // Step 1: Parse and validate query parameters
      const { start, end, operatorId } = parseAndValidateQueryParams(req);

      // Step 2: Create padded time range
      const { paddedStart, paddedEnd } = createPaddedTimeRange(start, end);

      let states;
      let groupedStates;

      if (operatorId) {
        // If operatorId provided, get states for just that operator
        states = await fetchStatesForOperator(
          db,
          operatorId,
          paddedStart,
          paddedEnd
        );
        // Create a single group for this operator
        groupedStates = {
          [operatorId]: {
            operator: {
              id: operatorId,
              name: await getOperatorNameFromCount(db, operatorId),
            },
            states: states,
          },
        };
      } else {
        // If no operatorId, get all states and group them by operator
        const allStates = await fetchStatesForOperator(
          db,
          null,
          paddedStart,
          paddedEnd
        );
        groupedStates = groupStatesByOperator(allStates);

        // Update operator names for all groups
        for (const [opId, group] of Object.entries(groupedStates)) {
          group.operator.name = await getOperatorNameFromCount(db, opId);
        }
      }

      // Step 3: Get all operator IDs for count query
      const operatorIds = Object.keys(groupedStates).map((id) => parseInt(id));

      // Get counts for all operators in a single query
      const allCounts = await db
        .collection("count")
        .find({
          "operator.id": { $in: operatorIds },
          timestamp: { $gte: new Date(start), $lte: new Date(end) },
        })
        .sort({ timestamp: 1 })
        .toArray();

      // Group counts by operator
      const operatorCounts = {};
      for (const count of allCounts) {
        const opId = count.operator?.id;
        if (!opId) continue;

        if (!operatorCounts[opId]) {
          operatorCounts[opId] = {
            counts: [],
            validCounts: [],
            misfeedCounts: [],
          };
        }

        operatorCounts[opId].counts.push(count);
        if (count.misfeed) {
          operatorCounts[opId].misfeedCounts.push(count);
        } else {
          operatorCounts[opId].validCounts.push(count);
        }
      }

      const results = [];

      // Step 4: Process each operator's data in parallel
      const operatorResults = await Promise.all(
        Object.entries(groupedStates).map(async ([operatorId, group]) => {
          const states = group.states;

          // Skip if no states found for this operator
          if (!states.length) return null;

          // Get counts for this operator
          const counts = operatorCounts[parseInt(operatorId)];
          if (!counts) return null;

          // Process count statistics using the new utility function
          const stats = processCountStatistics(counts.counts);

          // Calculate metrics for this operator
          const totalQueryMs = new Date(end) - new Date(start);
          const {
            runtime: runtimeMs,
            pausedTime: pausedTimeMs,
            faultTime: faultTimeMs,
          } = calculateOperatorTimes(states, start, end);

          const piecesPerHour = calculatePiecesPerHour(stats.total, runtimeMs);
          const efficiency = calculateEfficiency(
            runtimeMs,
            stats.total,
            counts.validCounts
          );

          // Get current status for this operator
          const currentState = states[states.length - 1] || {};

          // Format response for this operator
          return {
            operator: {
              id: parseInt(operatorId),
              name: group.operator.name || "Unknown",
            },
            currentStatus: {
              code: currentState.status?.code || 0,
              name: currentState.status?.name || "Unknown",
            },
            metrics: {
              runtime: {
                total: runtimeMs,
                formatted: formatDuration(runtimeMs),
              },
              pausedTime: {
                total: pausedTimeMs,
                formatted: formatDuration(pausedTimeMs),
              },
              faultTime: {
                total: faultTimeMs,
                formatted: formatDuration(faultTimeMs),
              },
              output: {
                totalCount: stats.total,
                misfeedCount: stats.misfeeds,
                validCount: stats.valid,
              },
              performance: {
                piecesPerHour: {
                  value: piecesPerHour,
                  formatted: Math.round(piecesPerHour).toString(),
                },
                efficiency: {
                  value: efficiency,
                  percentage: (efficiency * 100).toFixed(2) + "%",
                },
              },
            },
            timeRange: {
              start: start,
              end: end,
              total: formatDuration(totalQueryMs),
            },
          };
        })
      );

      // Filter out null results and send response
      res.json(operatorResults.filter((result) => result !== null));
    } catch (error) {
      logger.error("Error calculating operator performance metrics:", error);
      res
        .status(500)
        .json({ error: "Failed to fetch operator performance metrics" });
    }
  });

  /***  Analytics Route End */

  // Softrol Route start (WORKS !!)

  router.get("/softrol/get-softrol-data", async (req, res) => {
    try {
      // Step 1: Validate start parameter
      const start = req.query.start;
      if (!start) {
        return res
          .status(400)
          .json({ error: "Start time parameter is required" });
      }

      // Validate start is a valid ISO date string
      const startDate = new Date(start);
      if (isNaN(startDate.getTime())) {
        return res
          .status(400)
          .json({
            error: "Invalid start time format. Please use ISO date string",
          });
      }

      // Step 2: Handle end parameter
      let endDate;
      if (req.query.end) {
        // If end parameter is provided, validate it
        endDate = new Date(req.query.end);
        if (isNaN(endDate.getTime())) {
          return res
            .status(400)
            .json({
              error: "Invalid end time format. Please use ISO date string",
            });
        }
      }

      // Step 3: Get latest state and create time range in parallel
      const [latestState] = await Promise.all([
        db
          .collection("state")
          .find()
          .sort({ timestamp: -1 })
          .limit(1)
          .toArray(),
        // Add any other independent operations here
      ]);

      // Use provided end date or default to latest state/current time
      const end = endDate
        ? endDate.toISOString()
        : latestState?.timestamp || new Date().toISOString();
      const { paddedStart, paddedEnd } = createPaddedTimeRange(
        startDate,
        new Date(end)
      );

      // Step 4: Fetch states and process cycles in parallel
      const [allStates] = await Promise.all([
        fetchStatesForOperator(db, null, paddedStart, paddedEnd),
        // Add any other independent operations here
      ]);

      const groupedStates = groupStatesByOperatorAndSerial(allStates);

      // Process completed cycles for each operator-machine group
      const completedCyclesByGroup = {};
      for (const [key, group] of Object.entries(groupedStates)) {
        const completedCycles = getCompletedCyclesForOperator(group.states);
        if (completedCycles.length > 0) {
          completedCyclesByGroup[key] = {
            ...group,
            completedCycles,
          };
        }
      }

      // Get all operator IDs and machine serials
      const operatorMachinePairs = Object.keys(completedCyclesByGroup).map(
        (key) => {
          const [operatorId, machineSerial] = key.split("-");
          return {
            operatorId: parseInt(operatorId),
            machineSerial: parseInt(machineSerial),
          };
        }
      );

      // Step 5: Get counts and process results in parallel
      const [allCounts] = await Promise.all([
        getCountsForOperatorMachinePairs(db, operatorMachinePairs, start, end),
        // Add any other independent operations here
      ]);

      // Group the counts by operator and machine for easier processing
      const groupedCounts = groupCountsByOperatorAndMachine(allCounts);

      // Step 6: Process each group and its completed cycles individually
      const results = [];

      for (const [key, group] of Object.entries(completedCyclesByGroup)) {
        const [operatorId, machineSerial] = key.split("-");
        const countGroup = groupedCounts[`${operatorId}-${machineSerial}`];
        if (!countGroup) continue;

        // Pre-sort counts by timestamp ASCENDING (important)
        const sortedCounts = countGroup.counts.sort(
          (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
        );

        let countIndex = 0; // pointer for counts

        for (const cycle of group.completedCycles) {
          const cycleStart = new Date(cycle.start);
          const cycleEnd = new Date(cycle.end);

          const cycleCounts = [];

          // Move countIndex forward while counts are within cycle window
          while (countIndex < sortedCounts.length) {
            const currentCount = sortedCounts[countIndex];
            const countTimestamp = new Date(currentCount.timestamp);

            if (countTimestamp < cycleStart) {
              countIndex++;
              continue;
            }
            if (countTimestamp > cycleEnd) {
              break; // current count is after this cycle
            }

            // count is inside this cycle
            cycleCounts.push(currentCount);
            countIndex++;
          }

          if (!cycleCounts.length) continue; // no counts in this cycle, skip

          // Process stats for this cycle
          const stats = processCountStatistics(cycleCounts);
          const { runtime: runtimeMs } = calculateOperatorTimes(
            cycle.states,
            cycleStart,
            cycleEnd
          );
          const piecesPerHour = calculatePiecesPerHour(stats.total, runtimeMs);
          const efficiency = calculateEfficiency(
            runtimeMs,
            stats.total,
            countGroup.validCounts
          );
          const itemNames = extractItemNamesFromCounts(cycleCounts);

          results.push({
            operatorId: parseInt(operatorId),
            machineSerial: parseInt(machineSerial),
            startTimestamp: cycleStart.toISOString(),
            endTimestamp: cycleEnd.toISOString(),
            totalCount: stats.total,
            task: itemNames,
            standard: Math.round(piecesPerHour * efficiency),
          });
        }
      }

      res.json(results);
    } catch (error) {
      logger.error("Error in softrol data processing:", error);
      res.status(500).json({ error: "Failed to process softrol data" });
    }
  });
  // Softrol Route end

  // API Route for line chart data for OEE% and individual operator efficiency% by hour start

  router.get("/analytics/machine/operator-efficiency", async (req, res) => {
    try {
      // Step 1: Parse and validate query parameters
      const { start, end, serial } = parseAndValidateQueryParams(req);

      // Step 2: Create padded time range
      const { paddedStart, paddedEnd } = createPaddedTimeRange(start, end);

      if (!serial) {
        return res.status(400).json({ error: "Machine serial is required" });
      }

      // Step 3: Get hourly intervals
      const hourlyIntervals = getHourlyIntervals(paddedStart, paddedEnd);

      // Step 4: Get states and counts for the entire period
      const states = await fetchStatesForMachine(
        db,
        serial,
        paddedStart,
        paddedEnd
      );
      const counts = await getCountsForMachine(
        db,
        serial,
        paddedStart,
        paddedEnd
      );

      if (!states.length) {
        return res.json([]);
      }

      // Step 5: Process each hour
      const hourlyData = await Promise.all(
        hourlyIntervals.map(async (interval) => {
          // Filter states and counts for this hour
          const hourStates = states.filter((state) => {
            const stateTime = new Date(state.timestamp);
            return stateTime >= interval.start && stateTime <= interval.end;
          });

          const hourCounts = counts.filter((count) => {
            const countTime = new Date(count.timestamp);
            return countTime >= interval.start && countTime <= interval.end;
          });

          // Group counts by operator and machine
          const groupedCounts = groupCountsByOperatorAndMachine(hourCounts);

          // Calculate metrics for each operator
          const operatorMetrics = {};

          // Get unique operator IDs from counts
          const operatorIds = new Set();
          hourCounts.forEach((count) => {
            if (count.operator && count.operator.id) {
              operatorIds.add(count.operator.id);
            }
          });

          // Calculate total runtime for the hour from states
          const { runtime: totalRuntime } = calculateOperatorTimes(
            hourStates,
            interval.start,
            interval.end
          );

          // Process each operator
          for (const operatorId of operatorIds) {
            const countGroup = groupedCounts[`${operatorId}-${serial}`];
            if (!countGroup) continue;

            // Get operator name from first count
            const operatorName =
              countGroup.counts[0]?.operator?.name || "Unknown";

            // Process count statistics
            const stats = processCountStatistics(countGroup.counts);

            // Calculate efficiency
            const efficiency = calculateEfficiency(
              totalRuntime,
              stats.total,
              countGroup.validCounts
            );

            operatorMetrics[operatorId] = {
              name: operatorName,
              runTime: totalRuntime,
              validCounts: stats.valid,
              totalCounts: stats.total,
              efficiency: efficiency * 100, // Convert to percentage
            };
          }

          // Calculate OEE for this hour
          const hourDuration = interval.end - interval.start;
          const availability = (totalRuntime / hourDuration) * 100;

          const avgEfficiency =
            Object.values(operatorMetrics).length > 0
              ? Object.values(operatorMetrics).reduce(
                  (sum, op) => sum + op.efficiency,
                  0
                ) / Object.keys(operatorMetrics).length
              : 0;

          const totalValidCounts = Object.values(operatorMetrics).reduce(
            (sum, op) => sum + op.validCounts,
            0
          );
          const totalCounts = Object.values(operatorMetrics).reduce(
            (sum, op) => sum + op.totalCounts,
            0
          );
          const throughput =
            totalCounts > 0 ? (totalValidCounts / totalCounts) * 100 : 0;

          const oee =
            calculateOEE(
              availability / 100,
              avgEfficiency / 100,
              throughput / 100
            ) * 100;

          return {
            hour: interval.start.toISOString(),
            oee: Math.round(oee * 100) / 100,
            operators: Object.entries(operatorMetrics).map(([id, metrics]) => ({
              id: parseInt(id),
              name: metrics.name,
              efficiency: Math.round(metrics.efficiency * 100) / 100,
            })),
          };
        })
      );

      // Step 6: Format response
      const response = {
        machine: {
          serial: parseInt(serial),
          name: states[0]?.machine?.name || "Unknown",
        },
        timeRange: {
          start: start,
          end: end,
          total: formatDuration(new Date(end) - new Date(start)),
        },
        hourlyData,
      };

      res.json(response);
    } catch (error) {
      logger.error("Error calculating operator efficiency:", error);
      res
        .status(500)
        .json({ error: "Failed to calculate operator efficiency" });
    }
  });

  // API Route for line chart data for OEE% and individual operator efficiency% by hour end

  //API Route for operator count by item start
  router.get("/analytics/operator-countbyitem", async (req, res) => {
    try {
      const { start, end, operatorId } = req.query;

      // Validate start
      if (!start)
        return res
          .status(400)
          .json({ error: "Start time parameter is required" });
      const startDate = new Date(start);
      if (isNaN(startDate.getTime())) {
        return res
          .status(400)
          .json({ error: "Invalid start time format. Use ISO string" });
      }

      // Validate operatorId
      if (!operatorId || isNaN(parseInt(operatorId))) {
        return res.status(400).json({ error: "Valid operatorId is required" });
      }

      // Validate end
      let endDate;
      if (end) {
        endDate = new Date(end);
        if (isNaN(endDate.getTime())) {
          return res
            .status(400)
            .json({ error: "Invalid end time format. Use ISO string" });
        }
      }

      const [latestState] = await Promise.all([
        db
          .collection("state")
          .find()
          .sort({ timestamp: -1 })
          .limit(1)
          .toArray(),
      ]);

      const finalEnd = endDate
        ? endDate.toISOString()
        : latestState?.timestamp || new Date().toISOString();
      const { paddedStart, paddedEnd } = createPaddedTimeRange(
        startDate,
        new Date(finalEnd)
      );

      // Fetch states for specific operator
      const allStates = await fetchStatesForOperator(
        db,
        parseInt(operatorId),
        paddedStart,
        paddedEnd
      );
      const groupedStates = groupStatesByOperatorAndSerial(allStates);

      const completedCyclesByGroup = {};
      for (const [key, group] of Object.entries(groupedStates)) {
        const completedCycles = getCompletedCyclesForOperator(group.states);
        if (completedCycles.length > 0) {
          completedCyclesByGroup[key] = {
            ...group,
            completedCycles,
          };
        }
      }

      const operatorMachinePairs = Object.keys(completedCyclesByGroup).map(
        (key) => {
          const [operatorId, machineSerial] = key.split("-");
          return {
            operatorId: parseInt(operatorId),
            machineSerial: parseInt(machineSerial),
          };
        }
      );

      const allCounts = await getCountsForOperatorMachinePairs(
        db,
        operatorMachinePairs,
        start,
        finalEnd
      );
      const groupedCounts = groupCountsByOperatorAndMachine(allCounts);

      const results = [];

      for (const [key, group] of Object.entries(completedCyclesByGroup)) {
        const [opId, machineSerial] = key.split("-");
        const countGroup = groupedCounts[`${opId}-${machineSerial}`];
        if (!countGroup) continue;

        const sortedCounts = countGroup.counts.sort(
          (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
        );
        let countIndex = 0;

        for (const cycle of group.completedCycles) {
          const cycleStart = new Date(cycle.start);
          const cycleEnd = new Date(cycle.end);
          const cycleCounts = [];

          while (countIndex < sortedCounts.length) {
            const currentCount = sortedCounts[countIndex];
            const countTimestamp = new Date(currentCount.timestamp);

            if (countTimestamp < cycleStart) {
              countIndex++;
              continue;
            }
            if (countTimestamp > cycleEnd) break;

            cycleCounts.push(currentCount);
            countIndex++;
          }

          if (!cycleCounts.length) continue;

          const stats = processCountStatistics(cycleCounts);
          const { runtime: runtimeMs } = calculateOperatorTimes(
            cycle.states,
            cycleStart,
            cycleEnd
          );
          const piecesPerHour = calculatePiecesPerHour(stats.total, runtimeMs);
          const efficiency = calculateEfficiency(
            runtimeMs,
            stats.total,
            countGroup.validCounts
          );
          const itemNames = extractItemNamesFromCounts(cycleCounts);

          results.push({
            operatorId: parseInt(opId),
            machineSerial: parseInt(machineSerial),
            startTimestamp: cycleStart.toISOString(),
            endTimestamp: cycleEnd.toISOString(),
            totalCount: stats.valid,
            task: itemNames,
            standard: Math.round(piecesPerHour * efficiency),
          });
        }
      }

      // === Post-process results into hourly stacked bar chart format ===
      const hourItemMap = {};
      const itemsSet = new Set();

      // Distribute counts evenly per task per hour
      for (const entry of results) {
        const ts = new Date(entry.startTimestamp);
        const hour = ts.getHours();

        const tasks =
          typeof entry.task === "string"
            ? entry.task.split(",").map((t) => t.trim())
            : [];
        const perItemCount = Math.floor(entry.totalCount / tasks.length);

        tasks.forEach((item) => {
          itemsSet.add(item);
          if (!hourItemMap[hour]) hourItemMap[hour] = {};
          if (!hourItemMap[hour][item]) hourItemMap[hour][item] = 0;
          hourItemMap[hour][item] += perItemCount;
        });
      }

      // Build full list of hour integers between start and end
      const fullHourRange = [];
      const temp = new Date(startDate);
      temp.setMinutes(0, 0, 0);
      const endHourDate = new Date(endDate);
      endHourDate.setMinutes(0, 0, 0);

      while (temp <= endHourDate) {
        fullHourRange.push(temp.getHours());
        temp.setHours(temp.getHours() + 1);
      }

      // Format hours to '1am', '12pm', etc.
      function formatHour(hour) {
        if (hour === 0) return "12am";
        if (hour === 12) return "12pm";
        if (hour < 12) return `${hour}am`;
        return `${hour - 12}pm`;
      }

      const formattedHours = fullHourRange.map(formatHour);

      // Ensure operator/item counts match the full hour list
      const allItems = Array.from(itemsSet).sort();
      const operators = {};
      for (const item of allItems) {
        operators[item] = fullHourRange.map(
          (hour) => hourItemMap[hour]?.[item] || 0
        );
      }

      // Final response
      const response = {
        title: "Operator Counts by item",
        data: {
          hours: fullHourRange,
          operators,
        },
      };

      res.json(response);
    } catch (error) {
      logger.error("Error in operator-countbyitem route:", error);
      res.status(500).json({ error: "Failed to process data for operator" });
    }
  });
  //API Route for operator count by item end

  // API route for fault history start
  router.get("/analytics/fault-history", async (req, res) => {
    try {
      const { start, end, serial } = parseAndValidateQueryParams(req);
      const { paddedStart, paddedEnd } = createPaddedTimeRange(start, end);
  
      if (!serial) {
        return res.status(400).json({ error: "Machine serial is required" });
      }
  
      // Fetch states for the specified machine
      const states = await fetchStatesForMachine(db, serial, paddedStart, paddedEnd);
  
      if (!states.length) {
        return res.json({ faultCycles: [], faultSummary: [] });
      }
  
      // Extract fault cycles
      const { faultCycles, faultSummaries } = extractFaultCycles(states, start, end);

  
      res.json({
        faultCycles,
        faultSummaries,
      });
    } catch (err) {
      logger.error("Error in /analytics/fault-history:", err);
      res.status(500).json({ error: "Failed to fetch fault history" });
    }
  });
  
  // API route for fault history end

  //API route for machine item summary start
//Orignal route for machine item summary with all the items (not aggregated)
  // router.get("/analytics/machine-item-summary", async (req, res) => {
  //   try {
  //     const { start, end, serial } = parseAndValidateQueryParams(req);
  //     const { paddedStart, paddedEnd } = createPaddedTimeRange(start, end);
  
  //     const allStates = await fetchStatesForMachine(db, serial || null, paddedStart, paddedEnd);
  //     if (!allStates.length) return res.json([]);
  
  //     const groupedStates = groupStatesByMachine(allStates);
  //     const results = [];
  
  //     for (const [machineSerial, group] of Object.entries(groupedStates)) {
  //       const machineName = group.machine?.name || "Unknown";
  //       const machineStates = group.states;
  //       const cycles = extractAllCyclesFromStates(machineStates, start, end).running;
  
  //       const allCounts = await getValidCounts(db, parseInt(machineSerial), start, end);
  
  //       const machineSummary = {
  //         totalCount: 0,
  //         totalWorkedMs: 0,
  //         itemSummaries: {},
  //       };
  
  //       const sessions = [];
  
  //       for (const cycle of cycles) {
  //         const cycleStart = new Date(cycle.start);
  //         const cycleEnd = new Date(cycle.end);
  //         const cycleMs = cycleEnd - cycleStart;
  
  //         const cycleCounts = allCounts.filter((c) => {
  //           const ts = new Date(c.timestamp);
  //           return ts >= cycleStart && ts <= cycleEnd;
  //         });
  
  //         if (!cycleCounts.length) continue;
  
  //         const operators = new Set(cycleCounts.map((c) => c.operator?.id).filter(Boolean));
  //         const workedTimeMs = cycleMs * Math.max(1, operators.size);
  
  //         const grouped = groupCountsByItem(cycleCounts);
  
  //         const items = Object.entries(grouped).map(([itemId, group]) => {
  //           const countTotal = group.length;
  //           const standard = group[0].item?.standard > 0 ? group[0].item.standard : 666;
  //           const name = group[0].item?.name || "Unknown";
  
  //           const pph = countTotal / (workedTimeMs / 3600000);
  //           const efficiency = pph / standard;
  
  //           // Add to machine summary
  //           if (!machineSummary.itemSummaries[itemId]) {
  //             machineSummary.itemSummaries[itemId] = {
  //               count: 0,
  //               standard,
  //             };
  //           }
  //           machineSummary.itemSummaries[itemId].count += countTotal;
  //           machineSummary.totalCount += countTotal;
  //           machineSummary.totalWorkedMs += workedTimeMs;
  
  //           return {
  //             itemId: parseInt(itemId),
  //             name,
  //             countTotal,
  //             standard,
  //             pph: Math.round(pph * 100) / 100,
  //             efficiency: Math.round(efficiency * 10000) / 100,
  //           };
  //         });
  
  //         sessions.push({
  //           start: cycleStart.toISOString(),
  //           end: cycleEnd.toISOString(),
  //           workedTimeMs,
  //           workedTimeFormatted: formatDuration(workedTimeMs),
  //           items,
  //         });
  //       }
  
  //       const totalHours = machineSummary.totalWorkedMs / 3600000;
  //       const machinePph = totalHours > 0 ? machineSummary.totalCount / totalHours : 0;
  
  //       const proratedStandard = Object.values(machineSummary.itemSummaries).reduce((acc, item) => {
  //         const weight = machineSummary.totalCount > 0 ? item.count / machineSummary.totalCount : 0;
  //         return acc + weight * item.standard;
  //       }, 0);
  
  //       const machineEff = proratedStandard > 0 ? machinePph / proratedStandard : 0;
  
  //       results.push({
  //         machine: {
  //           name: machineName,
  //           serial: parseInt(machineSerial),
  //         },
  //         sessions,
  //         machineSummary: {
  //           totalCount: machineSummary.totalCount,
  //           workedTimeMs: machineSummary.totalWorkedMs,
  //           workedTimeFormatted: formatDuration(machineSummary.totalWorkedMs),
  //           pph: Math.round(machinePph * 100) / 100,
  //           proratedStandard: Math.round(proratedStandard * 100) / 100,
  //           efficiency: Math.round(machineEff * 10000) / 100,
  //         },
  //       });
  //     }
  
  //     res.json(results);
  //   } catch (error) {
  //     logger.error("Error in /analytics/machine-item-summary:", error);
  //     res.status(500).json({ error: "Failed to generate machine item summary" });
  //   }
  // });

  router.get("/analytics/machine-item-summary", async (req, res) => {
    try {
      const { start, end, serial } = parseAndValidateQueryParams(req);
      const { paddedStart, paddedEnd } = createPaddedTimeRange(start, end);
  
      const allStates = await fetchStatesForMachine(db, serial || null, paddedStart, paddedEnd);
      if (!allStates.length) return res.json([]);
  
      const groupedStates = groupStatesByMachine(allStates);
      const results = [];
  
      for (const [machineSerial, group] of Object.entries(groupedStates)) {
        const machineName = group.machine?.name || "Unknown";
        const machineStates = group.states;
        const cycles = extractAllCyclesFromStates(machineStates, start, end).running;
  
        const allCounts = await getValidCounts(db, parseInt(machineSerial), start, end);
  
        const machineSummary = {
          totalCount: 0,
          totalWorkedMs: 0,
          itemSummaries: {},
        };
  
        const sessions = [];
  
        for (const cycle of cycles) {
          const cycleStart = new Date(cycle.start);
          const cycleEnd = new Date(cycle.end);
          const cycleMs = cycleEnd - cycleStart;
  
          const cycleCounts = allCounts.filter((c) => {
            const ts = new Date(c.timestamp);
            return ts >= cycleStart && ts <= cycleEnd;
          });
  
          if (!cycleCounts.length) continue;
  
          const operators = new Set(cycleCounts.map((c) => c.operator?.id).filter(Boolean));
          const workedTimeMs = cycleMs * Math.max(1, operators.size);
  
          const grouped = groupCountsByItem(cycleCounts);
  
          for (const [itemId, group] of Object.entries(grouped)) {
            const countTotal = group.length;
            const standard = group[0].item?.standard > 0 ? group[0].item.standard : 666;
            const name = group[0].item?.name || "Unknown";
  
            if (!machineSummary.itemSummaries[itemId]) {
              machineSummary.itemSummaries[itemId] = {
                count: 0,
                standard,
                workedTimeMs: 0,
                name,
              };
            }
  
            machineSummary.itemSummaries[itemId].count += countTotal;
            machineSummary.itemSummaries[itemId].workedTimeMs += workedTimeMs;
            machineSummary.totalCount += countTotal;
            machineSummary.totalWorkedMs += workedTimeMs;
          }
  
          sessions.push({
            start: cycleStart.toISOString(),
            end: cycleEnd.toISOString(),
            workedTimeMs,
            workedTimeFormatted: formatDuration(workedTimeMs),
          });
        }
  
        // Add per-item formatted metrics
        Object.entries(machineSummary.itemSummaries).forEach(([itemId, summary]) => {
          const workedTimeFormatted = formatDuration(summary.workedTimeMs);
          const totalHours = summary.workedTimeMs / 3600000;
          const pph = totalHours > 0 ? summary.count / totalHours : 0;
          const efficiency = summary.standard > 0 ? pph / summary.standard : 0;
  
          machineSummary.itemSummaries[itemId] = {
            name: summary.name,
            standard: summary.standard,
            countTotal: summary.count,
            workedTimeFormatted,
            pph: Math.round(pph * 100) / 100,
            efficiency: Math.round(efficiency * 10000) / 100,
          };
        });
  
        const totalHours = machineSummary.totalWorkedMs / 3600000;
        const machinePph = totalHours > 0 ? machineSummary.totalCount / totalHours : 0;
  
        const proratedStandard = Object.values(machineSummary.itemSummaries).reduce((acc, item) => {
          const weight = machineSummary.totalCount > 0 ? item.countTotal / machineSummary.totalCount : 0;
          return acc + weight * item.standard;
        }, 0);
  
        const machineEff = proratedStandard > 0 ? machinePph / proratedStandard : 0;
  
        results.push({
          machine: {
            name: machineName,
            serial: parseInt(machineSerial),
          },
          sessions,
          machineSummary: {
            totalCount: machineSummary.totalCount,
            workedTimeMs: machineSummary.totalWorkedMs,
            workedTimeFormatted: formatDuration(machineSummary.totalWorkedMs),
            pph: Math.round(machinePph * 100) / 100,
            proratedStandard: Math.round(proratedStandard * 100) / 100,
            efficiency: Math.round(machineEff * 10000) / 100,
            itemSummaries: machineSummary.itemSummaries,
          },
        });
      }
  
      res.json(results);
    } catch (error) {
      logger.error("Error in /analytics/machine-item-summary:", error);
      res.status(500).json({ error: "Failed to generate machine item summary" });
    }
  });
  //API route for machine item summary end

  //API route for operator item summary start

router.get("/analytics/operator-item-summary", async (req, res) => {
  try {
    const { start, end } = parseAndValidateQueryParams(req);
    const { paddedStart, paddedEnd } = createPaddedTimeRange(start, end);

    const allStates = await fetchStatesForOperator(db, null, paddedStart, paddedEnd);
    const groupedStates = groupStatesByOperatorAndSerial(allStates);

    const allOperatorMachinePairs = Object.keys(groupedStates).map(key => {
      const [operatorId, machineSerial] = key.split('-').map(Number);
      return { operatorId, machineSerial };
    });

    const allCounts = await getCountsForOperatorMachinePairs(db, allOperatorMachinePairs, paddedStart, paddedEnd);

    const groupedCounts = groupCountsByOperatorAndMachine(allCounts);

    const results = [];

    for (const key in groupedCounts) {
      const { operator, machine, counts, validCounts, misfeedCounts } = groupedCounts[key];
      const itemMap = groupCountsByItem(validCounts);

      const states = groupedStates[key]?.states || [];
      const runCycles = getCompletedCyclesForOperator(states);

      const totalRunMs = runCycles.reduce((acc, cycle) => acc + (cycle.duration || 0), 0);

      for (const itemId in itemMap) {
        const group = itemMap[itemId];
        const item = group[0]?.item || {};
        const count = group.length;
        const misfeeds = misfeedCounts.filter(m => m.item?.id === parseInt(itemId)).length;

        const hours = totalRunMs / 3600000;
        const pph = hours > 0 ? count / hours : 0;
        const standard = item.standard > 0 ? item.standard : 666;
        const efficiency = standard > 0 ? pph / standard : 0;

        results.push({
          operatorName: operator?.name || 'Unknown',
          machineName: machine?.name || 'Unknown',
          itemName: item?.name || 'Unknown',
          workedTimeFormatted: formatDuration(totalRunMs),
          count,
          misfeed: misfeeds,
          pph: Math.round(pph * 100) / 100,
          standard,
          efficiency: Math.round(efficiency * 10000) / 100
        });
      }
    }

    // Consolidate duplicates: same operator, machine, and item
const consolidated = {};

for (const row of results) {
  const key = `${row.operatorName}-${row.machineName}-${row.itemName}`;
  
  if (!consolidated[key]) {
    consolidated[key] = { ...row };
  } else {
    const existing = consolidated[key];

    // Accumulate counts
    existing.count += row.count;
    existing.misfeed += row.misfeed;

    // Sum worked time
    const existingMs = (existing.workedTimeFormatted.hours * 60 + existing.workedTimeFormatted.minutes) * 60 * 1000;
    const newMs = (row.workedTimeFormatted.hours * 60 + row.workedTimeFormatted.minutes) * 60 * 1000;
    const totalMs = existingMs + newMs;

    // Recalculate time
    const totalMinutes = Math.floor(totalMs / 60000);
    existing.workedTimeFormatted = {
      hours: Math.floor(totalMinutes / 60),
      minutes: totalMinutes % 60
    };

    const totalHours = totalMs / 3600000;
    existing.pph = Math.round((existing.count / totalHours) * 100) / 100;
    existing.efficiency = Math.round((existing.pph / existing.standard) * 10000) / 100;
  }
}

res.json(Object.values(consolidated));
  } catch (err) {
    logger.error("Error in /analytics/operator-item-summary:", err);
    res.status(500).json({ error: "Failed to generate operator item summary report" });
  }
});
  //API route for operator item summary end 
  
  //API route for item summary start
  router.get("/analytics/item-summary", async (req, res) => {
    try {
      const { start, end } = parseAndValidateQueryParams(req);
      const { paddedStart, paddedEnd } = createPaddedTimeRange(start, end);
  
      const allStates = await fetchStatesForMachine(db, null, paddedStart, paddedEnd);
      const groupedStates = groupStatesByMachine(allStates);
  
      const resultsMap = new Map();
  
      for (const [machineSerial, group] of Object.entries(groupedStates)) {
        const machineStates = group.states;
        const machineName = group.machine?.name || "Unknown";
        const cycles = extractAllCyclesFromStates(machineStates, start, end).running;
  
        const counts = await getValidCounts(db, parseInt(machineSerial), start, end);
        if (!counts.length || !cycles.length) continue;
  
        for (const cycle of cycles) {
          const cycleStart = new Date(cycle.start);
          const cycleEnd = new Date(cycle.end);
          const cycleMs = cycleEnd - cycleStart;
  
          const cycleCounts = counts.filter(c => {
            const ts = new Date(c.timestamp);
            return ts >= cycleStart && ts <= cycleEnd;
          });
  
          if (!cycleCounts.length) continue;
  
          const operators = new Set(cycleCounts.map(c => c.operator?.id).filter(Boolean));
          const workedTimeMs = cycleMs * Math.max(1, operators.size);
  
          const grouped = groupCountsByItem(cycleCounts);
  
          for (const [itemId, group] of Object.entries(grouped)) {
            const name = group[0].item?.name || "Unknown";
            const standard = group[0].item?.standard > 0 ? group[0].item.standard : 666;
            const countTotal = group.length;
  
            if (!resultsMap.has(itemId)) {
              resultsMap.set(itemId, {
                itemId: parseInt(itemId),
                name,
                standard,
                count: 0,
                workedTimeMs: 0,
              });
            }
  
            const entry = resultsMap.get(itemId);
            entry.count += countTotal;
            entry.workedTimeMs += workedTimeMs;
          }
        }
      }
  
      const results = Array.from(resultsMap.values()).map(entry => {
        const totalHours = entry.workedTimeMs / 3600000;
        const pph = totalHours > 0 ? entry.count / totalHours : 0;
        const efficiency = entry.standard > 0 ? pph / entry.standard : 0;
  
        return {
          itemName: entry.name,
          workedTimeFormatted: formatDuration(entry.workedTimeMs),
          count: entry.count,
          pph: Math.round(pph * 100) / 100,
          standard: entry.standard,
          efficiency: Math.round(efficiency * 10000) / 100
        };
      });
  
      res.json(results);
    } catch (err) {
      logger.error("Error in /analytics/item-summary:", err);
      res.status(500).json({ error: "Failed to generate item summary report" });
    }
  });
  
  //API route for item summary end

  return router;
}
