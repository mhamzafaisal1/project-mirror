  // Utility imports
  const {
    parseAndValidateQueryParams,
    createPaddedTimeRange,
    formatDuration,
    getStateCollectionName,
  } = require("./time");


async function getActiveMachineSerials(db, start, end) {
    const stateCollection = getStateCollectionName(start);
    const serials = await db.collection(stateCollection).distinct("machine.serial", {
      timestamp: { $gte: new Date(start), $lte: new Date(end) }
    });
    return serials;
  }


  function extractAllCyclesFromStatesForDashboard(states, queryStart, queryEnd, mode) {
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
  
      // Running cycles
      if (!mode || mode === 'running') {
        if (code === 1 && !currentRunningStart) {
          currentRunningStart = timestamp;
        } else if (code !== 1 && currentRunningStart) {
          const clampedStart = currentRunningStart < startTime ? startTime : currentRunningStart;
          const clampedEnd = timestamp > endTime ? endTime : timestamp;
          if (clampedStart < clampedEnd) {
            cycles.running.push({
              start: clampedStart,
              end: clampedEnd,
              duration: clampedEnd - clampedStart
            });
          }
          currentRunningStart = null;
        }
      }
  
      // Paused cycles
      if (!mode || mode === 'paused') {
        if (code === 0 && !currentPauseStart) {
          currentPauseStart = timestamp;
        } else if (code !== 0 && currentPauseStart) {
          const clampedStart = currentPauseStart < startTime ? startTime : currentPauseStart;
          const clampedEnd = timestamp > endTime ? endTime : timestamp;
          if (clampedStart < clampedEnd) {
            cycles.paused.push({
              start: clampedStart,
              end: clampedEnd,
              duration: clampedEnd - clampedStart
            });
          }
          currentPauseStart = null;
        }
      }
  
      // Fault cycles
      if (!mode || mode === 'fault') {
        if (code > 1 && !currentFaultStart) {
          currentFaultStart = timestamp;
        } else if (code <= 1 && currentFaultStart) {
          const clampedStart = currentFaultStart < startTime ? startTime : currentFaultStart;
          const clampedEnd = timestamp > endTime ? endTime : timestamp;
          if (clampedStart < clampedEnd) {
            cycles.fault.push({
              start: clampedStart,
              end: clampedEnd,
              duration: clampedEnd - clampedStart
            });
          }
          currentFaultStart = null;
        }
      }
    }
  
    // Cleanup for open cycles (still active at end)
    if ((!mode || mode === 'running') && currentRunningStart && currentRunningStart < endTime) {
      const clampedStart = currentRunningStart < startTime ? startTime : currentRunningStart;
      cycles.running.push({
        start: clampedStart,
        end: endTime,
        duration: endTime - clampedStart
      });
    }
  
    if ((!mode || mode === 'paused') && currentPauseStart && currentPauseStart < endTime) {
      const clampedStart = currentPauseStart < startTime ? startTime : currentPauseStart;
      cycles.paused.push({
        start: clampedStart,
        end: endTime,
        duration: endTime - clampedStart
      });
    }
  
    if ((!mode || mode === 'fault') && currentFaultStart && currentFaultStart < endTime) {
      const clampedStart = currentFaultStart < startTime ? startTime : currentFaultStart;
      cycles.fault.push({
        start: clampedStart,
        end: endTime,
        duration: endTime - clampedStart
      });
    }
  
    return mode ? cycles[mode] : cycles;
  }
  
  function formatItemSummaryFromAggregation(items) {
    const result = {};
    for (const item of items) {
      result[item._id] = {
        name: item.name,
        standard: item.standard,
        countTotal: item.count,
        workedTimeFormatted: formatDuration(0), // placeholder
        pph: null,
        efficiency: null
      };
    }
    return result;
  }
  
  function formatItemHourlyStackFromAggregation(hourlyAgg) {
    const hourSet = new Set();
    const itemMap = {};
  
    for (const row of hourlyAgg) {
      hourSet.add(row.hour);
      const key = String(row.itemId);
      if (!itemMap[key]) itemMap[key] = {};
      itemMap[key][row.hour] = row.count;
    }
  
    const hours = Array.from(hourSet).sort((a, b) => a - b);
    const operators = {};
  
    for (const [itemId, hourCounts] of Object.entries(itemMap)) {
      operators[itemId] = hours.map(h => hourCounts[h] || 0);
    }
  
    return {
      title: "Item Stacked Count Chart",
      data: {
        hours,
        operators
      }
    };
  }
  

  module.exports = {
    getActiveMachineSerials,
    extractAllCyclesFromStatesForDashboard,
    formatItemSummaryFromAggregation,
    formatItemHourlyStackFromAggregation
  };
  

  