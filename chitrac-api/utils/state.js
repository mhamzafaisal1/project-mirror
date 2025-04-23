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
  
  function extractAllCyclesFromStates(states, queryStart, queryEnd) {
    const cycles = {
      running: [],
      paused: [],
      fault: []
    };
    
    let currentRunningStart = null;
    let currentPauseStart = null;
    let currentFaultStart = null;
    
    // Convert query times to Date objects once
    const startTime = new Date(queryStart);
    const endTime = new Date(queryEnd);
    
    for (const state of states) {
      const code = state.status?.code;
      const timestamp = new Date(state.timestamp);
      
      // Handle running cycles
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
      
      // Handle paused cycles
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
      
      // Handle fault cycles
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
    
    // Handle any ongoing cycles at the end
    if (currentRunningStart && currentRunningStart >= startTime) {
      cycles.running.push({
        start: currentRunningStart,
        end: endTime,
        duration: endTime - currentRunningStart
      });
    }
    
    if (currentPauseStart && currentPauseStart >= startTime) {
      cycles.paused.push({
        start: currentPauseStart,
        end: endTime,
        duration: endTime - currentPauseStart
      });
    }
    
    if (currentFaultStart && currentFaultStart >= startTime) {
      cycles.fault.push({
        start: currentFaultStart,
        end: endTime,
        duration: endTime - currentFaultStart
      });
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
  
    // Define which keys to use based on mode
    const keyMap = {
      Running: { startKey: 'start', endKey: 'end' },
      Paused: { startKey: 'pauseStart', endKey: 'pauseEnd' },
      Faulted: { startKey: 'faultStart', endKey: 'faultEnd' }
    };
  
    const { startKey, endKey } = keyMap[mode];
  
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
  

  module.exports = {
    fetchStatesForMachine,
    groupStatesByMachine,
    extractAllCyclesFromStates,
    getAllMachinesFromStates,
    processAllMachinesCycles,
    calculateHourlyStateDurations,
    fetchStatesForOperator,
    groupStatesByOperator
  };
  