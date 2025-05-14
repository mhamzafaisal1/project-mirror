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

const { extractAllCyclesFromStates, fetchStatesForMachine, getAllMachinesFromStates } = require('./state');
const { getValidCounts } = require('./count');

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

// async function buildDailyItemHourlyStack(db, start, end) {
//   try {
//     const startDate = new Date(start);
//     const endDate = new Date(end);

//     const counts = await getValidCounts(db, null, start, end); // no serial
//     if (!counts.length) {
//       return {
//         title: "No data",
//         data: { hours: [], operators: {} }
//       };
//     }

//     const hourMap = new Map(); // hourIndex => { itemName => count }

//     for (const count of counts) {
//       const ts = new Date(count.timestamp);
//       const hourIndex = Math.floor((ts - startDate) / (60 * 60 * 1000)); // hour bucket
//       const itemName = count.item?.name || "Unknown";

//       if (!hourMap.has(hourIndex)) hourMap.set(hourIndex, {});
//       const hourEntry = hourMap.get(hourIndex);
//       hourEntry[itemName] = (hourEntry[itemName] || 0) + 1;
//     }

//     const maxHour = Math.max(...hourMap.keys());
//     const hours = Array.from({ length: maxHour + 1 }, (_, i) => i);
//     const itemNames = new Set();

//     for (const hourEntry of hourMap.values()) {
//       Object.keys(hourEntry).forEach(name => itemNames.add(name));
//     }

//     const operators = {};
//     for (const name of itemNames) {
//       operators[name] = Array(maxHour + 1).fill(0);
//     }

//     for (const [hourIndex, itemCounts] of hourMap.entries()) {
//       for (const [itemName, count] of Object.entries(itemCounts)) {
//         operators[itemName][hourIndex] = count;
//       }
//     }

//     return {
//       title: `Item Counts by Hour (All Machines)`,
//       data: {
//         hours,
//         operators
//       }
//     };
//   } catch (error) {
//     console.error('Error in buildDailyItemHourlyStack:', error);
//     throw error;
//   }
// }

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
  

module.exports = {
  buildMachineOEE,
  buildDailyItemHourlyStack
};