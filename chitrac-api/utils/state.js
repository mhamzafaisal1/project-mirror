async function fetchStatesForMachine(db, serial, paddedStart, paddedEnd) {
    const query = {
      timestamp: { $gte: paddedStart, $lte: paddedEnd }
    };
  
    if (serial) query['machine.serial'] = serial;
  
    return db.collection('state')
      .find(query)
      .sort({ timestamp: 1 })
      .project({
        timestamp: 1,
        'machine.serial': 1,
        'machine.name': 1,
        'program.mode': 1,
        'status.code': 1,
        'status.name': 1
      })
      .toArray();
  }
  
  function groupStatesByMachine(states) {
    const grouped = {};
    for (const state of states) {
      const serial = state.machine?.serial;
      if (!grouped[serial]) {
        grouped[serial] = {
          machine: {
            serial,
            name: state.machine?.name || null,
            mode: state.program?.mode || null
          },
          states: []
        };
      }
      grouped[serial].states.push(state);
    }
    return grouped;
  }
  
  function extractCyclesFromStates(states, queryStart, queryEnd) {
    const cycles = [];
    let currentStart = null;
  
    for (const state of states) {
      const code = state.status?.code;
      if (code === 1 && !currentStart) {
        currentStart = state.timestamp;
      } else if (code !== 1 && currentStart) {
        if (currentStart >= queryStart && state.timestamp <= queryEnd) {
          cycles.push({
            start: currentStart,
            end: state.timestamp,
            endStatus: state.status?.name
          });
        }
        currentStart = null;
      }
    }
    return cycles;
  }
  
  module.exports = { fetchStatesForMachine, groupStatesByMachine, extractCyclesFromStates };
  