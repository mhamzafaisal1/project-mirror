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
    if (!Array.isArray(states)) {
      throw new Error("Expected array of states but got: " + typeof states);
    }
  
    const grouped = {};
    for (const state of states) {
      const serial = state.machine?.serial;
      if (!serial) {
        console.warn("Skipping state with missing machine.serial:", state);
        continue;
      }
  
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
  


  function extractAllCyclesFromStates(states, queryStart, queryEnd, mode) {
    const startTime = new Date(queryStart);
    const endTime = new Date(queryEnd);
  
    const cycles = {
      running: [],
      paused: [],
      fault: []
    };
  
    let currentRunningStart = null;
    let currentPauseStart = null;
    let currentFaultStart = null;
  
    for (const state of states) {
      const code = state.status?.code;
      const timestamp = new Date(state.timestamp);
  
      // Running cycles only
      if (!mode || mode === 'running') {
        if (code === 1 && !currentRunningStart) {
          currentRunningStart = timestamp;
        } else if (code !== 1 && currentRunningStart) {
          if (currentRunningStart >= startTime && timestamp <= endTime) {
            cycles.running.push({
              start: currentRunningStart,
              end: timestamp,
              duration: timestamp - currentRunningStart
            });
          }
          currentRunningStart = null;
        }
      }
  
      // Paused cycles only
      if (!mode || mode === 'paused') {
        if (code === 0 && !currentPauseStart) {
          currentPauseStart = timestamp;
        } else if (code !== 0 && currentPauseStart) {
          if (currentPauseStart >= startTime && timestamp <= endTime) {
            cycles.paused.push({
              start: currentPauseStart,
              end: timestamp,
              duration: timestamp - currentPauseStart
            });
          }
          currentPauseStart = null;
        }
      }
  
      // Faulted cycles only
      if (!mode || mode === 'fault') {
        if (code > 1 && !currentFaultStart) {
          currentFaultStart = timestamp;
        } else if (code <= 1 && currentFaultStart) {
          if (currentFaultStart >= startTime && timestamp <= endTime) {
            cycles.fault.push({
              start: currentFaultStart,
              end: timestamp,
              duration: timestamp - currentFaultStart
            });
          }
          currentFaultStart = null;
        }
      }
    }
  
    // Cleanup for open cycles
    if ((!mode || mode === 'running') && currentRunningStart && currentRunningStart >= startTime) {
      cycles.running.push({
        start: currentRunningStart,
        end: endTime,
        duration: endTime - currentRunningStart
      });
    }
  
    if ((!mode || mode === 'paused') && currentPauseStart && currentPauseStart >= startTime) {
      cycles.paused.push({
        start: currentPauseStart,
        end: endTime,
        duration: endTime - currentPauseStart
      });
    }
  
    if ((!mode || mode === 'fault') && currentFaultStart && currentFaultStart >= startTime) {
      cycles.fault.push({
        start: currentFaultStart,
        end: endTime,
        duration: endTime - currentFaultStart
      });
    }
  
    if (mode) {
      return cycles[mode];
    }
  
    return cycles;
  }
  
  
  async function getAllMachinesFromStates(db, start, end) {
    const query = {
      timestamp: { $gte: start, $lte: end }
    };
    // Get unique machines from state collection
    const machines = await db.collection('state')
      .find(query)
      .project({
        'machine.serial': 1,
        'machine.name': 1
      })
      .toArray();
    
    // Create unique machine list
    const uniqueMachines = {};
    machines.forEach(state => {
      const serial = state.machine?.serial;
      if (serial && !uniqueMachines[serial]) {
        uniqueMachines[serial] = {  
          serial: serial,
          name: state.machine?.name || null
        };
      }
    });

    return Object.values(uniqueMachines);
  }

  async function processAllMachinesCycles(db, start, end) {
    try {
      // Get all unique machines
      const machines = await getAllMachinesFromStates(db, start, end);
      const results = [];

      // Process each machine
      for (const machine of machines) {
        // Get states for this machine
        const states = await fetchStatesForMachine(db, machine.serial, start, end);
        
        if (states.length > 0) {
          // Extract all types of cycles
          const cycles = extractAllCyclesFromStates(states, start, end);

          // Calculate total durations
          const runningTime = cycles.running.reduce((total, cycle) => total + cycle.duration, 0);
          const pausedTime = cycles.paused.reduce((total, cycle) => total + cycle.duration, 0);
          const faultedTime = cycles.fault.reduce((total, cycle) => total + cycle.duration, 0);

          // Format durations
          const formatDurationWithSeconds = (ms) => {
            const totalSeconds = Math.floor(ms / 1000);
            const hours = Math.floor(totalSeconds / 3600);
            const minutes = Math.floor((totalSeconds % 3600) / 60);
            const seconds = totalSeconds % 60;
            
            return {
              hours,
              minutes,
              seconds
            };
          };

          // Add machine result to array
          results.push({
            machine: {
              name: machine.name || 'Unknown',
              serial: machine.serial
            },
            timeTotals: {
              running: {
                total: runningTime,
                formatted: formatDurationWithSeconds(runningTime),
                cycles: cycles.running
              },
              paused: {
                total: pausedTime,
                formatted: formatDurationWithSeconds(pausedTime),
                cycles: cycles.paused
              },
              faulted: {
                total: faultedTime,
                formatted: formatDurationWithSeconds(faultedTime),
                cycles: cycles.fault
              }
            },
            timeRange: {
              start: start,
              end: end,
              total: formatDurationWithSeconds(new Date(end) - new Date(start))
            }
          });
        }
      }

      return results;
    } catch (error) {
      console.error('Error processing all machines cycles:', error);
      throw error;
    }
  }


  function calculateHourlyStateDurations(cycles, start, end, mode) {
    const hourlyDurations = Array(24).fill(0);
    const rangeStart = new Date(start);
    const rangeEnd = new Date(end);
  
    // All cycle types use the same property names
    const startKey = 'start';
    const endKey = 'end';
  
    for (const cycle of cycles) {
      const originalStart = new Date(cycle[startKey]);
      const originalEnd = new Date(cycle[endKey]);
  
      if (isNaN(originalStart) || isNaN(originalEnd)) continue;
  
      const clampedStart = originalStart < rangeStart ? rangeStart : originalStart;
      const clampedEnd = originalEnd > rangeEnd ? rangeEnd : originalEnd;
  
      let current = new Date(clampedStart);
  
      while (current < clampedEnd) {
        const hour = current.getHours();
  
        const nextHour = new Date(current);
        nextHour.setHours(hour + 1, 0, 0, 0);
  
        const segmentEnd = nextHour < clampedEnd ? nextHour : clampedEnd;
        const duration = segmentEnd - current;
  
        hourlyDurations[hour] += duration;
        current = segmentEnd;
      }
    }
  
    return hourlyDurations;
  }
  
  // State functions for Operator

  async function fetchStatesForOperator(db, operatorId, paddedStart, paddedEnd) {
    const query = {
      timestamp: { $gte: paddedStart, $lte: paddedEnd },
      'operators': { $exists: true, $ne: [] } // Ensure we only get states that have operators
    };

    if (operatorId) {
      query['operators.id'] = operatorId;
    }

    return db.collection('state')
      .find(query)
      .sort({ timestamp: 1 })
      .project({
        timestamp: 1,
        'machine.serial': 1,
        'machine.name': 1,
        'program.mode': 1,
        'status.code': 1,
        'status.name': 1,
        'operators': 1
      })
      .toArray();
  }
  
  // function groupStatesByOperator(states) {
  //   const grouped = {};
    
  //   for (const state of states) {
  //     // Each state can have multiple operators, so we need to process each one
  //     if (state.operators && Array.isArray(state.operators)) {
  //       for (const operator of state.operators) {
  //         // Skip if operator is null or doesn't have an id
  //         if (!operator || !operator.id) {
  //           continue;
  //         }
          
  //         const operatorId = operator.id;
          
  //         if (operatorId !== -1) { // Skip the -1 operator ID
  //           if (!grouped[operatorId]) {
  //             grouped[operatorId] = {
  //               operator: {
  //                 id: operatorId,
  //                 name: operator.name || null,
  //                 station: operator.station || null
  //               },
  //               states: []
  //             };
  //           }
            
  //           // Add the state to this operator's group
  //           grouped[operatorId].states.push(state);
  //         }
  //       }
  //     }
  //   }
    
  //   return grouped;
  // }
  
  function groupStatesByOperator(states) {
    const grouped = new Map();
    const operatorCache = new Map(); // Cache for operator info
  
    for (const state of states) {
      const operators = state.operators;
      if (!Array.isArray(operators)) continue;
  
      // Extract essential state data once per state
      const essentialState = {
        timestamp: state.timestamp,
        status: state.status,
        machine: state.machine,
        program: state.program
      };
  
      for (const operator of operators) {
        if (!operator || typeof operator.id !== 'number' || operator.id === -1) continue;
  
        let operatorGroup = grouped.get(operator.id);
        
        if (!operatorGroup) {
          // Cache operator info to avoid recreating it
          const operatorInfo = operatorCache.get(operator.id) || {
            id: operator.id,
            name: operator.name || null,
            station: operator.station || null
          };
          operatorCache.set(operator.id, operatorInfo);
  
          operatorGroup = {
            operator: operatorInfo,
            states: []
          };
          grouped.set(operator.id, operatorGroup);
        }
  
        // Push reference to essential state data
        operatorGroup.states.push(essentialState);
      }
    }
  
    return Object.fromEntries(grouped);
  }

  //Used for Softrol Route

  function groupStatesByOperatorAndSerial(states) {
    const grouped = new Map();
    const operatorCache = new Map(); // Cache for operator info
  
    for (const state of states) {
      const operators = state.operators;
      const machineSerial = state.machine?.serial;
  
      if (!Array.isArray(operators) || !machineSerial) continue;
  
      // Extract essential state data once per state
      const essentialState = {
        timestamp: state.timestamp,
        status: state.status,
        machine: state.machine,
        program: state.program,
      };
  
      for (const operator of operators) {
        if (!operator || typeof operator.id !== 'number' || operator.id === -1) continue;
  
        const key = `${operator.id}-${machineSerial}`; // operator-machine combo
  
        let operatorGroup = grouped.get(key);
  
        if (!operatorGroup) {
          const operatorInfo = operatorCache.get(operator.id) || {
            id: operator.id,
            name: operator.name || null,
            station: operator.station || null,
          };
          operatorCache.set(operator.id, operatorInfo);
  
          operatorGroup = {
            operator: operatorInfo,
            machineSerial,
            states: []
          };
          grouped.set(key, operatorGroup);
        }
  
        operatorGroup.states.push(essentialState);
      }
    }
  
    return Object.fromEntries(grouped);
  }

  const getCompletedCyclesForOperator = (states) => {
    if (!Array.isArray(states) || states.length === 0) {
        return [];
    }

    const completedCycles = [];
    let currentCycle = null;
    const MAX_CYCLE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

    const sortedStates = states.sort((a, b) =>
        new Date(a.timestamp) - new Date(b.timestamp)
    );

    for (let i = 0; i < sortedStates.length; i++) {
        const state = sortedStates[i];
        // Skip invalid states
        if (!state.status || typeof state.status.code !== 'number') {
            continue;
        }

        const statusCode = state.status.code;
        const timestamp = new Date(state.timestamp);
        
        if (statusCode === 1) {
            // Start a new cycle when code is 1
            if (!currentCycle) {
                currentCycle = {
                    start: timestamp,
                    startState: state,
                    states: [state]
                };
            } else {
                currentCycle.states.push(state);
            }
        } else if (statusCode === 0 || statusCode > 1) {
            // Close the current cycle if we're in one
            if (currentCycle) {
                currentCycle.end = timestamp;
                currentCycle.endState = state;
                currentCycle.duration = currentCycle.end - currentCycle.start;
                currentCycle.finalStatus = statusCode;

                // Only push if duration is valid and <= 24 hours
                if (
                    currentCycle.duration > 0 &&
                    currentCycle.duration <= MAX_CYCLE_DURATION
                ) {
                    completedCycles.push(currentCycle);
                }
                currentCycle = null;
            }
        }
    }

    // Final check: if machine never paused/faulted after last Run
    if (currentCycle) {
        const lastState = sortedStates[sortedStates.length - 1];
        currentCycle.end = new Date(lastState.timestamp);
        currentCycle.endState = lastState;
        currentCycle.duration = currentCycle.end - currentCycle.start;

        if (
            currentCycle.duration > 0 &&
            currentCycle.duration <= MAX_CYCLE_DURATION
        ) {
            completedCycles.push(currentCycle);
        }
    }

    return completedCycles;
};
  

// Fault history start
/**
 * Extracts fault cycles from machine states.
 * Groups each cycle by fault type (status.name) and returns detailed cycle data.
 * 
 * @param {Array} states - Array of state documents from the DB.
 * @param {string|Date} queryStart - The original start timestamp.
 * @param {string|Date} queryEnd - The original end timestamp.
 * @returns {Object} { faultCycles: Array, faultSummaries: Map }
 */
function extractFaultCycles(states, queryStart, queryEnd) {
  const faultCycles = [];
  const faultSummaryMap = new Map();

  const startTime = new Date(queryStart);
  const endTime = new Date(queryEnd);

  let currentCycle = null;

  const sortedStates = states
    .filter(s => s.status?.code !== undefined && s.timestamp)
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

  for (const state of sortedStates) {
    const code = state.status.code;
    const faultName = state.status.name || 'Unknown';
    const timestamp = new Date(state.timestamp);

    if (code > 1) {
      if (!currentCycle) {
        currentCycle = {
          faultType: faultName,
          start: timestamp,
          states: [state],
        };
      } else {
        currentCycle.states.push(state);
      }
    } else if (code <= 1 && currentCycle) {
      currentCycle.end = timestamp;
      currentCycle.duration = timestamp - currentCycle.start;

      if (currentCycle.start >= startTime && currentCycle.end <= endTime) {
        faultCycles.push(currentCycle);

        // Update summary
        const summary = faultSummaryMap.get(currentCycle.faultType) || { totalDuration: 0, count: 0 };
        summary.totalDuration += currentCycle.duration;
        summary.count += 1;
        faultSummaryMap.set(currentCycle.faultType, summary);
      }

      currentCycle = null;
    }
  }

  // If still faulting at end of range
  if (currentCycle && currentCycle.start >= startTime) {
    currentCycle.end = endTime;
    currentCycle.duration = endTime - currentCycle.start;
    faultCycles.push(currentCycle);

    const summary = faultSummaryMap.get(currentCycle.faultType) || { totalDuration: 0, count: 0 };
    summary.totalDuration += currentCycle.duration;
    summary.count += 1;
    faultSummaryMap.set(currentCycle.faultType, summary);
  }

  const faultSummaries = Array.from(faultSummaryMap.entries()).map(([faultType, { totalDuration, count }]) => ({
    faultType,
    totalDuration,
    count,
  }));

  return { faultCycles, faultSummaries };
}


/**
 * Returns an array of unique machine serial numbers found in the 'state' collection
 * within the given time range.
 * 
 * @param {Db} db - MongoDB database instance
 * @returns {Promise<number[]>} Array of machine serials
 */
async function getAllMachineSerials(db) {
  const serials = await db.collection('state').distinct('machine.serial');
  return serials.filter(s => typeof s === 'number' && !isNaN(s));
}



  
  

  module.exports = {
    fetchStatesForMachine,
    groupStatesByMachine,
    extractAllCyclesFromStates,
    getAllMachinesFromStates,
    processAllMachinesCycles,
    calculateHourlyStateDurations,
    fetchStatesForOperator,
    groupStatesByOperator,
    groupStatesByOperatorAndSerial,
    getCompletedCyclesForOperator,
    extractFaultCycles,
    getAllMachineSerials
  };
  