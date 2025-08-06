const {
  calculateDowntime,
  calculateAvailability,
  calculateEfficiency,
  calculateOEE,
  calculateThroughput,
  calculateTotalCount,
  calculateOperatorTimes,
} = require('./analytics');


const {
  parseAndValidateQueryParams,
  createPaddedTimeRange,
  formatDuration,
  getHourlyIntervals
} = require("./time");

const { extractAllCyclesFromStates, fetchStatesForMachine, getAllMachinesFromStates, groupStatesByOperator, fetchAllStates, groupStatesByMachine } = require('./state');
const {
    getValidCounts,
    groupCountsByOperator,
    processCountStatistics
  } = require('./count');

  const { getBookendedStatesAndTimeRange } = require('./bookendingBuilder'); 


async function buildMachineOEE(db, start, end) {
  try {
    const { paddedStart, paddedEnd } = createPaddedTimeRange(start, end);
    const totalWindowMs = new Date(paddedEnd) - new Date(paddedStart);

    const machines = await getAllMachinesFromStates(db, paddedStart, paddedEnd);
    const results = [];

    for (const machine of machines) {
      const states = await fetchStatesForMachine(db, machine.serial, paddedStart, paddedEnd);
      if (!states.length) continue;

      const cycles = extractAllCyclesFromStates(states, start, end);
      const workedTimeMs = cycles.running.reduce((sum, c) => sum + c.duration, 0);
      const totalRuntime = cycles.running.reduce((sum, c) => sum + c.duration, 0) +
                         cycles.paused.reduce((sum, c) => sum + c.duration, 0) +
                         cycles.fault.reduce((sum, c) => sum + c.duration, 0);
      const oee = (workedTimeMs / totalRuntime) * 100;

      results.push({
        serial: machine.serial,
        name: states[0].machine?.name || 'Unknown',
        oee: +oee.toFixed(2)
      });
    }

    // Sort descending
    results.sort((a, b) => b.oee - a.oee);

    return results;
  } catch (error) {
    console.error('Error in buildMachineOEE:', error);
    throw error;
  }
}

async function buildDailyItemHourlyStack(db, start, end) {
  try {
    const startDate = new Date(start);
    const endDate = new Date(end);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      throw new Error('Invalid date range provided');
    }

    const pipeline = [
      {
        $match: {
          timestamp: { $gte: startDate, $lte: endDate },
          misfeed: { $ne: true },
          'operator.id': { $exists: true, $ne: -1 }
        }
      },
      {
        $project: {
          itemName: { $ifNull: ["$item.name", "Unknown"] },
          hour: {
            $hour: {
              date: "$timestamp",
              timezone: "America/Chicago"
            }
          }
          
        }
      },
      {
        $group: {
          _id: { hour: "$hour", itemName: "$itemName" },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { "_id.itemName": 1, "_id.hour": 1 } // Ensure stable order by item
      },
      {
        $group: {
          _id: "$_id.itemName",
          hourlyCounts: {
            $push: {
              hour: "$_id.hour",
              count: "$count"
            }
          }
        }
      },
      {
        $sort: { "_id": 1 } // Final sort by item name
      }
    ];

    const results = await db.collection('count').aggregate(pipeline).toArray();

    const hourSet = new Set();
    const operators = {};

    for (const result of results) {
      const itemName = result._id;
      operators[itemName] = {};

      for (const entry of result.hourlyCounts) {
        hourSet.add(entry.hour);
        operators[itemName][entry.hour] = entry.count;
      }
    }

    const hours = Array.from(hourSet).sort((a, b) => a - b);

    

    const finalizedOperators = {};
    const sortedItemNames = Object.keys(operators).sort(); // JS-side sorting for extra safety
    for (const itemName of sortedItemNames) {
      const hourCounts = operators[itemName];
      finalizedOperators[itemName] = hours.map(h => hourCounts[h] || 0);
    }

    if (hours.length === 0) {
      return {
        title: "No data",
        data: { hours: [], operators: {} }
      };
    }

    return {
      title: "Item Counts by Hour (All Machines)",
      data: {
        hours,
        operators: finalizedOperators
      }
    };

  } catch (error) {
    console.error('Error in buildDailyItemHourlyStack:', error);
    throw error;
  }
}


  async function buildTopOperatorEfficiency(db, start, end) {
    const { paddedStart, paddedEnd } = createPaddedTimeRange(start, end);
  
    const [counts, states] = await Promise.all([
      db.collection('count').aggregate([
        {
          $match: {
            timestamp: { $gte: paddedStart, $lte: paddedEnd },
            'operator.id': { $exists: true, $ne: -1 },
            misfeed: { $ne: true }
          }
        },
        {
          $group: {
            _id: '$operator.id',
            name: { $first: '$operator.name' },
            items: {
              $push: {
                item: '$item',
                timestamp: '$timestamp'
              }
            },
            totalCount: { $sum: 1 }
          }
        }
      ]).toArray(),
      fetchAllStates(db, paddedStart, paddedEnd)
    ]);
  
    if (!counts.length || !states.length) {
      return [];
    }
  
    const groupedStates = groupStatesByOperator(states);
    const operatorData = [];
  
    for (const count of counts) {
      const operatorId = parseInt(count._id);
      const name = count.name || 'Unknown';
      const stateGroup = groupedStates[operatorId]?.states || [];
  
      const validCounts = count.items.map(entry => ({
        item: entry.item,
        timestamp: entry.timestamp,
        misfeed: false
      }));
  
      const totalCount = validCounts.length;
      const runtime = calculateOperatorTimes(stateGroup, paddedStart, paddedEnd).runtime;
      const efficiency = calculateEfficiency(runtime, totalCount, validCounts);
  
      operatorData.push({
        id: operatorId,
        name,
        efficiency: +(efficiency * 100).toFixed(2),
        metrics: {
          runtime: {
            total: runtime,
            formatted: formatDuration(runtime)
          },
          output: {
            totalCount,
            validCount: totalCount,
            misfeedCount: 0
          }
        }
      });
    }
  
    return operatorData
      .sort((a, b) => b.efficiency - a.efficiency)
      .slice(0, 10);
  }


//   async function buildPlantwideMetricsByHour(db, start, end) {
//     const hourlyIntervals = getHourlyIntervals(start, end);
//     const allStates = await fetchStatesForMachine(db, null, start, end);
//     const groupedStates = groupStatesByMachine(allStates);
  
//     const results = [];
  
//     for (const { start: hourStart, end: hourEnd } of hourlyIntervals) {
//       let totalRuntime = 0;
//       let weightedAvailability = 0;
//       let weightedEfficiency = 0;
//       let weightedThroughput = 0;
//       let weightedOEE = 0;
  
//       for (const [machineSerial, group] of Object.entries(groupedStates)) {
//         const machineStates = group.states;
//         const cycles = extractAllCyclesFromStates(machineStates, hourStart, hourEnd);
//         const runningCycles = cycles.running;
  
//         // Calculate runtime within this hour
//         const runtimeMs = runningCycles.reduce((total, cycle) => {
//           const startTs = new Date(cycle.start);
//           const endTs = new Date(cycle.end);
//           const effectiveStart = startTs < hourStart ? hourStart : startTs;
//           const effectiveEnd = endTs > hourEnd ? hourEnd : endTs;
//           return total + (effectiveEnd - effectiveStart);
//         }, 0);
  
//         if (runtimeMs === 0) continue;
  
//         const machineSerialInt = parseInt(machineSerial);
//         const counts = await getValidCounts(db, machineSerialInt, hourStart, hourEnd);
//         const validCounts = counts.filter(c => !c.misfeed);
//         const misfeedCounts = counts.filter(c => c.misfeed);
  
//         const availability = runtimeMs / 3600000;
//         const throughput = validCounts.length > 0
//           ? validCounts.length / (validCounts.length + misfeedCounts.length)
//           : 0;
//         const efficiency = calculateEfficiency(runtimeMs, validCounts.length, validCounts);
//         const oee = calculateOEE(availability, efficiency, throughput);
  
//         totalRuntime += runtimeMs;
//         weightedAvailability += availability * runtimeMs;
//         weightedEfficiency += efficiency * runtimeMs;
//         weightedThroughput += throughput * runtimeMs;
//         weightedOEE += oee * runtimeMs;
//       }
  
//       results.push({
//         hour: hourStart.getHours(),
//         label: hourStart.toISOString(),
//         availability: totalRuntime ? (weightedAvailability / totalRuntime) * 100 : 0,
//         efficiency: totalRuntime ? (weightedEfficiency / totalRuntime) * 100 : 0,
//         throughput: totalRuntime ? (weightedThroughput / totalRuntime) * 100 : 0,
//         oee: totalRuntime ? (weightedOEE / totalRuntime) * 100 : 0,
//       });
//     }
  
//     return results;
//   }


async function buildPlantwideMetricsByHour(db, start, end) {
  const intervals = getHourlyIntervals(start, end);
  const allStates = await fetchStatesForMachine(db, null, start, end);
  const groupedStates = groupStatesByMachine(allStates);

  const hourlyMetrics = [];

  for (const interval of intervals) {
    let totalRuntime = 0;
    let weightedAvailability = 0;
    let weightedEfficiency = 0;
    let weightedThroughput = 0;
    let weightedOEE = 0;

    for (const [machineSerial, group] of Object.entries(groupedStates)) {
      const machineStates = group.states.filter(s => {
        const ts = new Date(s.timestamp);
        return ts >= interval.start && ts < interval.end;
      });

      if (!machineStates.length) continue;

      const cycles = extractAllCyclesFromStates(machineStates, interval.start, interval.end);
      const runtime = cycles.running.reduce((sum, c) => sum + c.duration, 0);
      if (!runtime) continue;

      const counts = await getValidCounts(db, parseInt(machineSerial), interval.start, interval.end);
      const validCounts = counts.filter(c => !c.misfeed);
      const misfeedCounts = counts.filter(c => c.misfeed);

      const availability = runtime / (interval.end - interval.start);
      const throughput = validCounts.length > 0
        ? validCounts.length / (validCounts.length + misfeedCounts.length)
        : 0;
      const efficiency = calculateEfficiency(runtime, validCounts.length, validCounts);
      const oee = calculateOEE(availability, efficiency, throughput);

      totalRuntime += runtime;
      weightedAvailability += availability * runtime;
      weightedEfficiency += efficiency * runtime;
      weightedThroughput += throughput * runtime;
      weightedOEE += oee * runtime;
    }

    if (totalRuntime > 0) {
      const availability = (weightedAvailability / totalRuntime) * 100;
      const efficiency = (weightedEfficiency / totalRuntime) * 100;
      const throughput = (weightedThroughput / totalRuntime) * 100;
      const oee = (weightedOEE / totalRuntime) * 100;

      // ⛔ Filter out if all metrics are 0
      if (availability === 0 && efficiency === 0 && throughput === 0 && oee === 0) {
        continue;
      }

      hourlyMetrics.push({
        hour: interval.start.getHours(),
        availability,
        efficiency,
        throughput,
        oee
      });
    }
  }

  return hourlyMetrics;
}



  async function buildDailyMachineStatus(db, start, end) {
    const { paddedStart, paddedEnd } = createPaddedTimeRange(start, end);
    const machines = await getAllMachinesFromStates(db, paddedStart, paddedEnd);
    const results = [];
  
    for (const machine of machines) {
      const states = await fetchStatesForMachine(db, machine.serial, paddedStart, paddedEnd);
      if (!states.length) continue;
  
      const cycles = extractAllCyclesFromStates(states, start, end);
      results.push({
        serial: machine.serial,
        name: states[0].machine?.name || "Unknown",
        runningMs: cycles.running.reduce((sum, c) => sum + c.duration, 0),
        pausedMs: cycles.paused.reduce((sum, c) => sum + c.duration, 0),
        faultedMs: cycles.fault.reduce((sum, c) => sum + c.duration, 0)
      });
    }
  
    return results;
  }
  

  
  async function buildDailyCountTotals(db, _start, end) {
    try {
      const endDate = new Date(end);
      const startDate = new Date(endDate);
      startDate.setDate(endDate.getDate() - 27); // include 28 total days including endDate
      startDate.setHours(0, 0, 0, 0); // set to 12:00 AM
  
      const pipeline = [
        {
          $match: {
            timestamp: { $gte: startDate, $lte: endDate },
            misfeed: { $ne: true },
            'operator.id': { $exists: true, $ne: -1 }
          }
        },
        {
          $group: {
            _id: {
              year: { $year: "$timestamp" },
              month: { $month: "$timestamp" },
              day: { $dayOfMonth: "$timestamp" }
            },
            count: { $sum: 1 },
            date: { $first: "$timestamp" }
          }
        },
        {
          $project: {
            _id: 0,
            date: {
              $dateFromParts: {
                year: "$_id.year",
                month: "$_id.month",
                day: "$_id.day"
              }
            },
            count: 1
          }
        },
        {
          $sort: { date: 1 }
        }
      ];
  
      const results = await db.collection('count').aggregate(pipeline).toArray();
  
      return results.map(entry => ({
        date: entry.date.toISOString().split('T')[0],
        count: entry.count
      }));
  
    } catch (error) {
      console.error('Error in buildDailyCountTotals:', error);
      throw error;
    }
  }
  

module.exports = {
  buildMachineOEE,
  buildDailyItemHourlyStack,
  buildTopOperatorEfficiency,
  buildPlantwideMetricsByHour,
  buildDailyMachineStatus,
  buildDailyCountTotals
};