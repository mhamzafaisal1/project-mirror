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
            duration: state.timestamp - currentStart
          });
        }
        currentStart = null;
      }
    }
  
    // Handle case where machine is still running at the end
    if (currentStart) {
      const endTime = new Date(queryEnd);
      if (currentStart >= queryStart) {
        cycles.push({
          start: currentStart,
          end: endTime,
          duration: endTime - currentStart
        });
      }
    }
  
    return cycles;
  }
  
  function extractPausedCyclesFromStates(states, queryStart, queryEnd) {
    const cycles = [];
    let currentPauseStart = null;
  
    for (const state of states) {
      const code = state.status?.code;
      
      if (code === 0 && !currentPauseStart) {
        // Start of a pause
        currentPauseStart = state.timestamp;
      } else if (code !== 0 && currentPauseStart) {
        // End of a pause (can transition to running or fault)
        if (currentPauseStart >= queryStart && state.timestamp <= queryEnd) {
          cycles.push({
            pauseStart: currentPauseStart,
            pauseEnd: state.timestamp,
            duration: state.timestamp - currentPauseStart
          });
        }
        currentPauseStart = null;
      }
    }
  
    // Handle case where machine is still paused at the end
    if (currentPauseStart) {
      const endTime = new Date(queryEnd);
      if (currentPauseStart >= queryStart) {
        cycles.push({
          pauseStart: currentPauseStart,
          pauseEnd: endTime,
          duration: endTime - currentPauseStart
        });
      }
    }
  
    return cycles;
  }
  
  function extractFaultCyclesFromStates(states, queryStart, queryEnd) {
    const cycles = [];
    let currentFaultStart = null;
  
    for (const state of states) {
      const code = state.status?.code;
      
      if (code > 1 && !currentFaultStart) {
        // Start of a fault
        currentFaultStart = state.timestamp;
      } else if (code <= 1 && currentFaultStart) {
        // End of a fault (can transition to running or paused)
        if (currentFaultStart >= queryStart && state.timestamp <= queryEnd) {
          cycles.push({
            faultStart: currentFaultStart,
            faultEnd: state.timestamp,
            duration: state.timestamp - currentFaultStart
          });
        }
        currentFaultStart = null;
      }
    }
  
    // Handle case where machine is still faulted at the end
    if (currentFaultStart) {
      const endTime = new Date(queryEnd);
      if (currentFaultStart >= queryStart) {
        cycles.push({
          faultStart: currentFaultStart,
          faultEnd: endTime,
          duration: endTime - currentFaultStart
        });
      }
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
          const runningCycles = extractCyclesFromStates(states, start, end);
          const pausedCycles = extractPausedCyclesFromStates(states, start, end);
          const faultCycles = extractFaultCyclesFromStates(states, start, end);

          // Calculate total durations
          const runningTime = runningCycles.reduce((total, cycle) => total + cycle.duration, 0);
          const pausedTime = pausedCycles.reduce((total, cycle) => total + cycle.duration, 0);
          const faultedTime = faultCycles.reduce((total, cycle) => total + cycle.duration, 0);

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
                cycles: runningCycles
              },
              paused: {
                total: pausedTime,
                formatted: formatDurationWithSeconds(pausedTime),
                cycles: pausedCycles
              },
              faulted: {
                total: faultedTime,
                formatted: formatDurationWithSeconds(faultedTime),
                cycles: faultCycles
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
  
  
  
  module.exports = {
    fetchStatesForMachine,
    groupStatesByMachine,
    extractCyclesFromStates,
    extractPausedCyclesFromStates,
    extractFaultCyclesFromStates,
    getAllMachinesFromStates,
    processAllMachinesCycles,
    calculateHourlyStateDurations
  };
  