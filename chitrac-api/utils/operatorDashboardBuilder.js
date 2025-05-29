const {
    parseAndValidateQueryParams,
    createPaddedTimeRange,
    formatDuration,
    enforceMinimumTimeRange
  } = require("./time");

  const {
    calculateDowntime,
    calculateAvailability,
    calculateEfficiency,
    calculateOEE,
    calculateThroughput,
    calculateTotalCount,
    calculateOperatorTimes,
    calculatePiecesPerHour,
    calculateTotalTimeCredits,
    calculateTimeCreditsByItem,
  } = require('./analytics');


  const { fetchStatesForOperator, groupStatesByOperator, getCompletedCyclesForOperator, extractAllCyclesFromStates, extractFaultCycles, fetchAllStates, groupStatesByOperatorAndSerial} = require('./state');

  const { getCountsForOperator, getValidCountsForOperator, getOperatorNameFromCount, processCountStatistics, groupCountsByItem, extractItemNamesFromCounts, groupCountsByOperatorAndMachine, getCountsForOperatorMachinePairs, groupCountsByOperator } = require('./count');


async function getAllOperatorIds(db) {
    const uniqueIds = await db.collection("count").distinct("operator.id", {
      "operator.id": { $exists: true, $ne: -1 }
    });
  
    return uniqueIds.filter((id) => typeof id === "number" && !isNaN(id));
  }
  
  
//   function formatDuration(ms) {
//     const totalMinutes = Math.floor(ms / 60000);
//     return {
//       hours: Math.floor(totalMinutes / 60),
//       minutes: totalMinutes % 60
//     };
//   }
  
  // async function buildOperatorPerformance(states, counts, start, end) {
  //   const stats = processCountStatistics(counts);
  //   const { runtime, pausedTime, faultTime } = calculateOperatorTimes(states, start, end);
  //   const piecesPerHour = calculatePiecesPerHour(stats.total, runtime);
  //   const efficiency = calculateEfficiency(runtime, stats.total, counts);
  
  //   return {
  //     runtime: {
  //       total: runtime,
  //       formatted: formatDuration(runtime)
  //     },
  //     pausedTime: {
  //       total: pausedTime,
  //       formatted: formatDuration(pausedTime)
  //     },
  //     faultTime: {
  //       total: faultTime,
  //       formatted: formatDuration(faultTime)
  //     },
  //     output: {
  //       totalCount: stats.total,
  //       misfeedCount: stats.misfeeds,
  //       validCount: stats.valid
  //     },
  //     performance: {
  //       piecesPerHour: {
  //         value: piecesPerHour,
  //         formatted: Math.round(piecesPerHour).toString()
  //       },
  //       efficiency: {
  //         value: efficiency,
  //         percentage: (efficiency * 100).toFixed(2) + '%'
  //       }
  //     }
  //   };
  // }

  async function buildOperatorPerformance(states, validCounts, misfeedCounts, start, end) {
    // ✅ Combine valid and misfeed counts for totals
    const totalCounts = [...validCounts, ...misfeedCounts];
    const stats = processCountStatistics(totalCounts);
  
    // ✅ Time calculations
    const { runtime, pausedTime, faultTime } = calculateOperatorTimes(states, start, end);
  
    // ✅ Calculate PPH and efficiency from filtered validCounts
    const piecesPerHour = calculatePiecesPerHour(stats.total, runtime);
    const efficiency = calculateEfficiency(runtime, stats.total, validCounts);
  
    return {
      runtime: {
        total: runtime,
        formatted: formatDuration(runtime)
      },
      pausedTime: {
        total: pausedTime,
        formatted: formatDuration(pausedTime)
      },
      faultTime: {
        total: faultTime,
        formatted: formatDuration(faultTime)
      },
      output: {
        totalCount: stats.total,
        misfeedCount: stats.misfeeds,
        validCount: stats.valid
      },
      performance: {
        piecesPerHour: {
          value: piecesPerHour,
          formatted: Math.round(piecesPerHour).toString()
        },
        efficiency: {
          value: efficiency,
          percentage: (efficiency * 100).toFixed(2) + '%'
        }
      }
    };
  }
  
  
  // async function buildOperatorItemSummary(states, counts, start, end) {
  //   const validCounts = counts.filter(c => !c.misfeed);
  //   const misfeedCounts = counts.filter(c => c.misfeed);
  //   const itemMap = groupCountsByItem(validCounts);
  //   const runCycles = getCompletedCyclesForOperator(states);
  //   const totalRunMs = runCycles.reduce((acc, cycle) => acc + (cycle.duration || 0), 0);
  
  //   const results = [];
  
  //   for (const itemId in itemMap) {
  //     const group = itemMap[itemId];
  //     const item = group[0]?.item || {};
  //     const count = group.length;
  //     const misfeeds = misfeedCounts.filter(m => m.item?.id === parseInt(itemId)).length;
  //     const hours = totalRunMs / 3600000;
  //     const pph = hours > 0 ? count / hours : 0;
  //     const standard = item.standard > 0 ? item.standard : 666;
  //     const efficiency = standard > 0 ? pph / standard : 0;
  
  //     results.push({
  //       operatorName: group[0]?.operator?.name || 'Unknown',
  //       machineName: group[0]?.machine?.name || 'Unknown',
  //       itemName: item?.name || 'Unknown',
  //       workedTimeFormatted: formatDuration(totalRunMs),
  //       count,
  //       misfeed: misfeeds,
  //       pph: Math.round(pph * 100) / 100,
  //       standard,
  //       efficiency: Math.round(efficiency * 10000) / 100
  //     });
  //   }

  //   // Consolidate duplicate rows
  //   const consolidated = {};
  //   for (const row of results) {
  //     const key = `${row.operatorName}-${row.machineName}-${row.itemName}`;
  //     if (!consolidated[key]) {
  //       consolidated[key] = { ...row };
  //     } else {
  //       const existing = consolidated[key];
  //       existing.count += row.count;
  //       existing.misfeed += row.misfeed;

  //       const existingMs = (existing.workedTimeFormatted.hours * 60 + existing.workedTimeFormatted.minutes) * 60000;
  //       const newMs = (row.workedTimeFormatted.hours * 60 + row.workedTimeFormatted.minutes) * 60000;
  //       const totalMs = existingMs + newMs;

  //       const totalMinutes = Math.floor(totalMs / 60000);
  //       existing.workedTimeFormatted = {
  //         hours: Math.floor(totalMinutes / 60),
  //         minutes: totalMinutes % 60
  //       };

  //       const totalHours = totalMs / 3600000;
  //       existing.pph = Math.round((existing.count / totalHours) * 100) / 100;
  //       existing.efficiency = Math.round((existing.pph / existing.standard) * 10000) / 100;
  //     }
  //   }
  
  //   return Object.values(consolidated);
  // }
  async function buildOperatorItemSummary(states, counts, start, end, machineNameMap = {}) {
    const validCounts = counts.filter(c => !c.misfeed);
    const misfeedCounts = counts.filter(c => c.misfeed);
    const itemMap = groupCountsByItem(validCounts);
    const runCycles = getCompletedCyclesForOperator(states);
    const totalRunMs = runCycles.reduce((acc, cycle) => acc + (cycle.duration || 0), 0);
  
    const results = [];
  
    for (const itemId in itemMap) {
      const group = itemMap[itemId];
      const item = group[0]?.item || {};
      const operator = group[0]?.operator || {};
      const machineSerial = group[0]?.machine?.serial || 'Unknown';
      const machineName = machineNameMap[machineSerial] || 'Unknown';
      const count = group.length;
      const misfeeds = misfeedCounts.filter(m => m.item?.id === parseInt(itemId)).length;
      const hours = totalRunMs / 3600000;
      const pph = hours > 0 ? count / hours : 0;
      const standard = item.standard > 0 ? item.standard : 666;
      const efficiency = standard > 0 ? pph / standard : 0;
  
      results.push({
        operatorName: operator.name || 'Unknown',
        machineSerial,
        machineName,
        itemName: item.name || 'Unknown',
        workedTimeFormatted: formatDuration(totalRunMs),
        rawRunMs: totalRunMs,
        count,
        misfeed: misfeeds,
        pph: Math.round(pph * 100) / 100,
        standard,
        efficiency: Math.round(efficiency * 10000) / 100
      });
    }
  
    const consolidated = {};
    for (const row of results) {
      const key = `${row.operatorName}-${row.machineSerial}-${row.itemName}`;
      if (!consolidated[key]) {
        consolidated[key] = { ...row };
      } else {
        const existing = consolidated[key];
        existing.count += row.count;
        existing.misfeed += row.misfeed;
        existing.rawRunMs += row.rawRunMs;
  
        const totalHours = existing.rawRunMs / 3600000;
        existing.pph = Math.round((existing.count / totalHours) * 100) / 100;
        existing.efficiency = Math.round((existing.pph / existing.standard) * 10000) / 100;
        existing.workedTimeFormatted = formatDuration(existing.rawRunMs);
      }
    }
  
    return Object.values(consolidated);
  }
  
  
  
  // async function buildOperatorCountByItem(states, counts, start, end) {
  //   const completedCycles = getCompletedCyclesForOperator(states);
  //   const grouped = {};
  //   const itemsSet = new Set();
  
  //   for (const cycle of completedCycles) {
  //     const ts = new Date(cycle.start);
  //     const hour = ts.getHours();
  
  //     const cycleCounts = counts.filter(c => new Date(c.timestamp) >= new Date(cycle.start) && new Date(c.timestamp) <= new Date(cycle.end));
  //     const itemNames = extractItemNamesFromCounts(cycleCounts);
  //     const tasks = itemNames.split(',').map(t => t.trim());
  //     const perItemCount = Math.floor(cycleCounts.length / tasks.length);
  
  //     tasks.forEach(item => {
  //       itemsSet.add(item);
  //       if (!grouped[hour]) grouped[hour] = {};
  //       if (!grouped[hour][item]) grouped[hour][item] = 0;
  //       grouped[hour][item] += perItemCount;
  //     });
  //   }
  
  //   const fullHourRange = Array.from({ length: 24 }, (_, i) => i);
  //   const allItems = Array.from(itemsSet).sort();
  //   const operators = {};
  
  //   allItems.forEach(item => {
  //     operators[item] = fullHourRange.map(hour => grouped[hour]?.[item] || 0);
  //   });
  
  //   return {
  //     title: 'Operator Counts by item',
  //     data: {
  //       hours: fullHourRange,
  //       operators
  //     }
  //   };
  // }

  function buildOperatorCountByItem(groupedEntry, start, end) {
    const { states = [], counts = {} } = groupedEntry;
    const completedCycles = getCompletedCyclesForOperator(states);
    const grouped = {};
    const itemsSet = new Set();
  
    for (const cycle of completedCycles) {
      const ts = new Date(cycle.start);
      const hour = ts.getHours();
  
      const cycleCounts = counts.all.filter(c => {
        const ts = new Date(c.timestamp);
        return ts >= new Date(cycle.start) && ts <= new Date(cycle.end);
      });
  
      const itemNames = extractItemNamesFromCounts(cycleCounts);
      const tasks = itemNames.split(',').map(t => t.trim());
      const perItemCount = Math.floor(cycleCounts.length / tasks.length || 1);
  
      for (const item of tasks) {
        itemsSet.add(item);
        if (!grouped[hour]) grouped[hour] = {};
        if (!grouped[hour][item]) grouped[hour][item] = 0;
        grouped[hour][item] += perItemCount;
      }
    }
  
    const fullHourRange = Array.from({ length: 24 }, (_, i) => i);
    const allItems = Array.from(itemsSet).sort();
    const operators = {};
  
    for (const item of allItems) {
      operators[item] = fullHourRange.map(hour => grouped[hour]?.[item] || 0);
    }
  
    return {
      title: 'Operator Counts by item',
      data: {
        hours: fullHourRange,
        operators
      }
    };
  }
  
  
  // async function buildOperatorCyclePie(states, start, end) {
  //   const { running, paused, fault } = extractAllCyclesFromStates(states, start, end);
  //   const total = [...running, ...paused, ...fault].reduce((sum, c) => sum + c.duration, 0) || 1;
  
  //   return [
  //     { name: 'Running', value: Math.round((running.reduce((a, b) => a + b.duration, 0) / total) * 100) },
  //     { name: 'Paused', value: Math.round((paused.reduce((a, b) => a + b.duration, 0) / total) * 100) },
  //     { name: 'Faulted', value: Math.round((fault.reduce((a, b) => a + b.duration, 0) / total) * 100) }
  //   ];
  // }
  
  function buildOperatorCyclePie(groupedEntry, start, end) {
    const states = groupedEntry?.states || [];
    const { running, paused, fault } = extractAllCyclesFromStates(states, start, end);
  
    const total = [...running, ...paused, ...fault].reduce((sum, c) => sum + c.duration, 0) || 1;
  
    return [
      {
        name: 'Running',
        value: Math.round((running.reduce((a, b) => a + b.duration, 0) / total) * 100)
      },
      {
        name: 'Paused',
        value: Math.round((paused.reduce((a, b) => a + b.duration, 0) / total) * 100)
      },
      {
        name: 'Faulted',
        value: Math.round((fault.reduce((a, b) => a + b.duration, 0) / total) * 100)
      }
    ];
  }
  
  // async function buildOperatorFaultHistory(states, start, end) {
  //   // Group states by machine to process each machine's fault cycles separately
  //   const groupedStates = groupStatesByOperatorAndSerial(states);
  //   const allFaultCycles = [];
  //   const faultTypeMap = new Map(); // For aggregating fault summaries

  //   // Process each machine's states
  //   for (const [key, group] of Object.entries(groupedStates)) {
  //     const machineStates = group.states;
  //     const machineName = group.machine?.name || "Unknown";

  //     // Extract fault cycles for this machine
  //     const { faultCycles, faultSummaries } = extractFaultCycles(
  //       machineStates,
  //       new Date(start),
  //       new Date(end)
  //     );

  //     // Add machine info to each fault cycle
  //     const machineFaultCycles = faultCycles.map((cycle) => ({
  //       ...cycle,
  //       machineName,
  //       machineSerial: group.machine?.serial,
  //     }));

  //     allFaultCycles.push(...machineFaultCycles);

  //     // Aggregate fault summaries
  //     for (const summary of faultSummaries) {
  //       const key = summary.faultType;
  //       if (!faultTypeMap.has(key)) {
  //         faultTypeMap.set(key, {
  //           faultType: key,
  //           count: 0,
  //           totalDuration: 0,
  //         });
  //       }
  //       const existing = faultTypeMap.get(key);
  //       existing.count += summary.count;
  //       existing.totalDuration += summary.totalDuration;
  //     }
  //   }

  //   // Convert fault summaries to array and format durations
  //   const faultSummaries = Array.from(faultTypeMap.values()).map(
  //     (summary) => {
  //       const totalSeconds = Math.floor(summary.totalDuration / 1000);
  //       const hours = Math.floor(totalSeconds / 3600);
  //       const minutes = Math.floor((totalSeconds % 3600) / 60);
  //       const seconds = totalSeconds % 60;

  //       return {
  //         ...summary,
  //         formatted: {
  //           hours,
  //           minutes,
  //           seconds,
  //         },
  //       };
  //     }
  //   );

  //   // Sort fault cycles by start time
  //   allFaultCycles.sort((a, b) => new Date(a.start) - new Date(b.start));

  //   return {
  //     faultCycles: allFaultCycles,
  //     faultSummaries,
  //   };
  // }

  async function buildOperatorFaultHistory(grouped, start, end) {
    const allFaultCycles = [];
    const faultTypeMap = new Map();
  
    for (const [operatorId, group] of Object.entries(grouped)) {
      const states = group.states || [];
      const machineName = group.machine?.name || 'Unknown';
  
      const { faultCycles, faultSummaries } = extractFaultCycles(states, new Date(start), new Date(end));
  
      const machineFaultCycles = faultCycles.map(cycle => ({
        ...cycle,
        machineName,
        machineSerial: group.machine?.serial || 'Unknown',
        operatorName: group.operator?.name || 'Unknown',
        operatorId
      }));
  
      allFaultCycles.push(...machineFaultCycles);
  
      for (const summary of faultSummaries) {
        const key = summary.faultType;
        if (!faultTypeMap.has(key)) {
          faultTypeMap.set(key, { faultType: key, count: 0, totalDuration: 0 });
        }
        const existing = faultTypeMap.get(key);
        existing.count += summary.count;
        existing.totalDuration += summary.totalDuration;
      }
    }
  
    const faultSummaries = Array.from(faultTypeMap.values()).map(summary => {
      const totalSeconds = Math.floor(summary.totalDuration / 1000);
      return {
        ...summary,
        formatted: {
          hours: Math.floor(totalSeconds / 3600),
          minutes: Math.floor((totalSeconds % 3600) / 60),
          seconds: totalSeconds % 60
        }
      };
    });
  
    allFaultCycles.sort((a, b) => new Date(a.start) - new Date(b.start));
  
    return { faultCycles: allFaultCycles, faultSummaries };
  }
  
  
  // async function buildOperatorEfficiencyLine(validCounts, states, start, end) {
  //   const startDate = new Date(start);
  //   const endDate = new Date(end);
  //   const days = [];
  //   let cursor = new Date(startDate);
  
  //   while (cursor <= endDate) {
  //     const dayStart = new Date(cursor);
  //     const dayEnd = new Date(dayStart);
  //     dayEnd.setUTCHours(23, 59, 59, 999);
  //     days.push({ start: new Date(dayStart), end: new Date(dayEnd) });
  //     cursor.setUTCDate(cursor.getUTCDate() + 1);
  //   }
  
  //   const results = [];
  //   for (const day of days) {
  //     const dailyStates = states.filter(s => new Date(s.timestamp) >= day.start && new Date(s.timestamp) <= day.end);
  //     const dailyCounts = validCounts.filter(c => new Date(c.timestamp) >= day.start && new Date(c.timestamp) <= day.end);
  //     const runCycles = getCompletedCyclesForOperator(dailyStates);
  //     const runTime = runCycles.reduce((sum, cycle) => sum + cycle.duration, 0);
  
  //     let avgStandard = 666;
  //     const standards = dailyCounts.map(c => c.item?.standard).filter(s => typeof s === 'number' && s > 0);
  //     if (standards.length > 0) {
  //       avgStandard = standards.reduce((a, b) => a + b, 0) / standards.length;
  //     }
  
  //     const hours = runTime / 3600000;
  //     const pph = hours > 0 ? dailyCounts.length / hours : 0;
  //     const efficiency = avgStandard > 0 ? (pph / avgStandard) * 100 : 0;
  
  //     results.push({
  //       date: day.start.toISOString().split('T')[0],
  //       efficiency: Math.round(efficiency * 100) / 100
  //     });
  //   }

  //   // Get operator name from the first valid count
  //   const operatorName = validCounts[0]?.operator?.name || 'Unknown';
  //   const operatorId = validCounts[0]?.operator?.id;

  //   return {
  //     operator: {
  //       id: operatorId,
  //       name: operatorName
  //     },
  //     timeRange: {
  //       start,
  //       end,
  //       totalDays: results.length
  //     },
  //     data: results
  //   };
  // }

  async function buildOperatorEfficiencyLine(group, start, end) {

    
    const validCounts = group.counts?.valid || [];
    const states = group.states || [];
  
    const startDate = new Date(start);
    const endDate = new Date(end);
    const days = [];
  
    let cursor = new Date(startDate);
    while (cursor <= endDate) {
      const dayStart = new Date(cursor);
      const dayEnd = new Date(dayStart);
      dayEnd.setUTCHours(23, 59, 59, 999);
      days.push({ start: new Date(dayStart), end: new Date(dayEnd) });
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
  
    const results = [];
    for (const day of days) {
      const dailyStates = states.filter(s => new Date(s.timestamp) >= day.start && new Date(s.timestamp) <= day.end);
      const dailyCounts = validCounts.filter(c => new Date(c.timestamp) >= day.start && new Date(c.timestamp) <= day.end);
      const runCycles = getCompletedCyclesForOperator(dailyStates);
      const runTime = runCycles.reduce((sum, cycle) => sum + cycle.duration, 0);
  
      let avgStandard = 666;
      const standards = dailyCounts.map(c => c.item?.standard).filter(s => typeof s === 'number' && s > 0);
      if (standards.length > 0) {
        avgStandard = standards.reduce((a, b) => a + b, 0) / standards.length;
      }
  
      const hours = runTime / 3600000;
      const pph = hours > 0 ? dailyCounts.length / hours : 0;
      const efficiency = avgStandard > 0 ? (pph / avgStandard) * 100 : 0;
  
      results.push({
        date: day.start.toISOString().split('T')[0],
        efficiency: Math.round(efficiency * 100) / 100
      });
    }
  
    return {
      operator: {
        id: validCounts[0]?.operator?.id || group.operator?.id || 'Unknown',
        name: validCounts[0]?.operator?.name || group.operator?.name || 'Unknown'
      },
      timeRange: {
        start,
        end,
        totalDays: results.length
      },
      data: results
    };
  }
  
  
  module.exports = {
    getAllOperatorIds,
    buildOperatorPerformance,
    buildOperatorItemSummary,
    buildOperatorCountByItem,
    buildOperatorCyclePie,
    buildOperatorFaultHistory,
    buildOperatorEfficiencyLine
  };
  