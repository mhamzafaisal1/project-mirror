



// async function getBookendedStatesAndTimeRange(db, serial, start, end) {
//     const serialNum = parseInt(serial);
//     const startDate = new Date(start);
//     const endDate = new Date(end);
  
//     const inRangeStatesQ = db.collection("state")
//       .find({
//         "machine.serial": serialNum,
//         timestamp: { $gte: startDate, $lte: endDate }
//       })
//       .sort({ timestamp: 1 });
  
//     const beforeStartQ = db.collection("state")
//       .find({
//         "machine.serial": serialNum,
//         timestamp: { $lt: startDate }
//       })
//       .sort({ timestamp: -1 })
//       .limit(1);
  
//     const afterEndQ = db.collection("state")
//       .find({
//         "machine.serial": serialNum,
//         timestamp: { $gt: endDate }
//       })
//       .sort({ timestamp: 1 })
//       .limit(1);
  
//     const [inRangeStates, [beforeStart], [afterEnd]] = await Promise.all([
//       inRangeStatesQ.toArray(),
//       beforeStartQ.toArray(),
//       afterEndQ.toArray()
//     ]);
  
//     const states = [
//       ...(beforeStart ? [beforeStart] : []),
//       ...inRangeStates,
//       ...(afterEnd ? [afterEnd] : [])
//     ];
  
//     if (!states.length) return null;
  
//     // Identify the true session start and end
//     let trueStart = null;
//     let trueEnd = null;
//     let inSession = false;
  
//     for (const state of states) {
//       if (state.status?.code === 1 && !inSession) {
//         trueStart = state.timestamp;
//         inSession = true;
//       } else if (inSession && state.status?.code !== 1) {
//         trueEnd = state.timestamp;
//         inSession = false;
//       }
//     }
  
//     // If session still running at end
//     if (inSession) {
//       trueEnd = afterEnd?.timestamp || states.at(-1).timestamp;
//     }
  
//     return {
//       states,
//       sessionStart: trueStart || states[0].timestamp,
//       sessionEnd: trueEnd || states.at(-1).timestamp
//     };
//   }

const { extractAllCyclesFromStates } = require('./state');

/**
 * Returns bookended state data and true session start/end times per machine
 * @param {Object} db - MongoDB instance
 * @param {Number} serial - Machine serial
 * @param {Date} start - Raw user-provided start time
 * @param {Date} end - Raw user-provided end time
 * @returns {Object|null} { sessionStart, sessionEnd, states } OR null if nothing found
 */
// async function getBookendedStatesAndTimeRange(db, serial, start, end) {
//   // Fetch all states for this machine in the given range
//   const states = await db.collection('state')
//     .find({
//       'machine.serial': serial,
//       timestamp: { $gte: new Date(start), $lte: new Date(end) }
//     })
//     .sort({ timestamp: 1 })
//     .toArray();

//   if (!states.length) return null;

//   // Extract all Run sessions
//   const { running: runSessions } = extractAllCyclesFromStates(states, start, end);
//   if (!runSessions.length) return null;

//   // True session bounds based on all run session timestamps
//   const sessionStart = runSessions[0].start;
//   const sessionEnd = runSessions[runSessions.length - 1].end;

//   // Filter the states to those within the session bounds
//   const filteredStates = states.filter(s =>
//     new Date(s.timestamp) >= sessionStart &&
//     new Date(s.timestamp) <= sessionEnd
//   );

//   return {
//     sessionStart,
//     sessionEnd,
//     states: filteredStates
//   };
// }

/**
 * Returns bookended state data and true session start/end times per machine
 * @param {Object} db - MongoDB instance
 * @param {Number} serial - Machine serial
 * @param {Date|string} start - Raw user-provided start time
 * @param {Date|string} end - Raw user-provided end time
 * @returns {Object|null} { sessionStart, sessionEnd, states } OR null if nothing found
 */
async function getBookendedStatesAndTimeRange(db, serial, start, end) {
  const serialNum = parseInt(serial);
  let startDate = new Date(start);
  let endDate = new Date(end);
  const now = new Date();

  // Clamp future end date to current time
  if (endDate > now) endDate = now;

  // Prepare queries
  const inRangeStatesQ = db.collection("state")
    .find({
      "machine.serial": serialNum,
      timestamp: { $gte: startDate, $lte: endDate }
    })
    .sort({ timestamp: 1 });

  const beforeStartQ = db.collection("state")
    .find({
      "machine.serial": serialNum,
      timestamp: { $lt: startDate }
    })
    .sort({ timestamp: -1 })
    .limit(1);

  const afterEndQ = db.collection("state")
    .find({
      "machine.serial": serialNum,
      timestamp: { $gt: endDate }
    })
    .sort({ timestamp: 1 })
    .limit(1);

  // Execute queries
  const [inRangeStates, [beforeStart], [afterEnd]] = await Promise.all([
    inRangeStatesQ.toArray(),
    beforeStartQ.toArray(),
    afterEndQ.toArray()
  ]);

  // Merge and sort states
  const fullStates = [
    ...(beforeStart ? [beforeStart] : []),
    ...inRangeStates,
    ...(afterEnd ? [afterEnd] : [])
  ].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

  if (!fullStates.length) return null;

  // Extract Run sessions
  const { running: runSessions } = extractAllCyclesFromStates(fullStates, startDate, endDate);
  if (!runSessions.length) return null;

  const sessionStart = runSessions[0].start;
  const sessionEnd = runSessions.at(-1).end;

  const filteredStates = fullStates.filter(s =>
    new Date(s.timestamp) >= sessionStart &&
    new Date(s.timestamp) <= sessionEnd
  );

  return {
    sessionStart,
    sessionEnd,
    states: filteredStates
  };
}

module.exports = { getBookendedStatesAndTimeRange };


// async function getBookendedOperatorStatesAndTimeRange(db, operatorId, start, end) {
//     const states = await db.collection('state')
//       .find({
//         "operators.id": operatorId,
//         timestamp: { $gte: new Date(start), $lte: new Date(end) }
//       })
//       .sort({ timestamp: 1 })
//       .toArray();
  
//     if (!states.length) return null;
  
//     const { running: runCycles } = require('./state').extractAllCyclesFromStates(states, start, end);
//     if (!runCycles.length) return null;
  
//     const sessionStart = runCycles[0].start;
//     const sessionEnd = runCycles[runCycles.length - 1].end;
  
//     const filteredStates = states.filter(s =>
//       new Date(s.timestamp) >= sessionStart &&
//       new Date(s.timestamp) <= sessionEnd
//     );
  
//     return { sessionStart, sessionEnd, states: filteredStates };
//   }


/**
 * Returns bookended state data and true session start/end times for an operator
 * @param {Object} db - MongoDB instance
 * @param {Number} operatorId - Operator ID to filter
 * @param {Date|string} start - Start datetime
 * @param {Date|string} end - End datetime
 * @returns {Object|null} { sessionStart, sessionEnd, states } or null if no valid run cycle
 */
async function getBookendedOperatorStatesAndTimeRange(db, operatorId, start, end) {
  const now = new Date();
  const startDate = new Date(start);
  let endDate = new Date(end);
  if (endDate > now) endDate = now;

  // Fetch in-range, pre-start, and post-end states
  const inRangeStatesQ = db.collection('state')
    .find({
      'operators.id': operatorId,
      timestamp: { $gte: startDate, $lte: endDate }
    })
    .sort({ timestamp: 1 });

  const beforeStartQ = db.collection('state')
    .find({
      'operators.id': operatorId,
      timestamp: { $lt: startDate }
    })
    .sort({ timestamp: -1 })
    .limit(1);

  const afterEndQ = db.collection('state')
    .find({
      'operators.id': operatorId,
      timestamp: { $gt: endDate }
    })
    .sort({ timestamp: 1 })
    .limit(1);

  const [inRangeStates, [beforeStart], [afterEnd]] = await Promise.all([
    inRangeStatesQ.toArray(),
    beforeStartQ.toArray(),
    afterEndQ.toArray()
  ]);

  const fullStates = [
    ...(beforeStart ? [beforeStart] : []),
    ...inRangeStates,
    ...(afterEnd ? [afterEnd] : [])
  ];

  if (!fullStates.length) return null;

  // Ensure states are sorted chronologically
  fullStates.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

  const { running: runCycles } = extractAllCyclesFromStates(fullStates, startDate, endDate);
  if (!runCycles.length) return null;

  const sessionStart = runCycles[0].start;
  const sessionEnd = runCycles[runCycles.length - 1].end;

  const filteredStates = fullStates.filter(s =>
    new Date(s.timestamp) >= sessionStart && new Date(s.timestamp) <= sessionEnd
  );

  return { sessionStart, sessionEnd, states: filteredStates };
}


  

module.exports = { getBookendedStatesAndTimeRange, getBookendedOperatorStatesAndTimeRange };

  

  