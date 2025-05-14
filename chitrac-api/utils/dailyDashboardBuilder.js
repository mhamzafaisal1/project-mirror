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
} = require("./time");

const { extractAllCyclesFromStates, fetchStatesForMachine, getAllMachinesFromStates, groupStatesByOperator, fetchAllStates } = require('./state');
const {
    getValidCounts,
    groupCountsByOperator,
    processCountStatistics
  } = require('./count');

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
            'operator.id': { $exists: true, $ne: -1 } // optional: only valid operators
          }
        },
        {
          $project: {
            itemName: { $ifNull: ["$item.name", "Unknown"] },
            hourIndex: {
              $toInt: {
                $divide: [
                  { $subtract: ["$timestamp", startDate] },
                  1000 * 60 * 60
                ]
              }
            }
          }
        },
        {
          $group: {
            _id: { hourIndex: "$hourIndex", itemName: "$itemName" },
            count: { $sum: 1 }
          }
        },
        {
          $group: {
            _id: "$_id.itemName",
            hourlyCounts: {
              $push: {
                hourIndex: "$_id.hourIndex",
                count: "$count"
              }
            }
          }
        }
      ];
  
      const results = await db.collection('count').aggregate(pipeline).toArray();
  
      // Dynamically collect all hour indexes present in the data
      const hourSet = new Set();
      const operators = {};
  
      for (const result of results) {
        const itemName = result._id;
        operators[itemName] = {};
  
        for (const entry of result.hourlyCounts) {
          hourSet.add(entry.hourIndex);
          operators[itemName][entry.hourIndex] = entry.count;
        }
      }
  
      const hours = Array.from(hourSet).sort((a, b) => a - b);
  
      // Fill missing hour slots with 0s for all items
      const finalizedOperators = {};
      for (const [itemName, hourCounts] of Object.entries(operators)) {
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
  
  

module.exports = {
  buildMachineOEE,
  buildDailyItemHourlyStack,
  buildTopOperatorEfficiency
};