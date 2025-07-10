// const {
//   parseAndValidateQueryParams,
//   createPaddedTimeRange,
//   formatDuration,
// } = require("./time");

// const {
//   fetchStatesForOperator,
//   groupStatesByOperator,
//   getCompletedCyclesForOperator,
//   extractAllCyclesFromStates,
//   extractFaultCycles,
//   fetchAllStates,
//   groupStatesByOperatorAndSerial,
// } = require("./state");

// const {
//   getCountsForOperator,
//   getValidCountsForOperator,
//   getOperatorNameFromCount,
//   processCountStatistics,
//   groupCountsByItem,
//   extractItemNamesFromCounts,
//   groupCountsByOperatorAndMachine,
//   getCountsForOperatorMachinePairs,
//   groupCountsByOperator,
// } = require("./count");

// const {
//     calculateDowntime,
//     calculateAvailability,
//     calculateEfficiency,
//     calculateOEE,
//     calculateThroughput,
//     calculateTotalCount,
//     calculateOperatorTimes,
//     calculatePiecesPerHour,
//     calculateTotalTimeCredits,
//     calculateTimeCreditsByItem,
//     calculateStandardFromCounts
//   } = require('./analytics');

// /**
//  * Builds a detailed summary for a Softrol cycle
//  * @param {Object} cycle - The cycle object containing start, end, and states
//  * @param {Array} sortedCounts - Array of counts sorted by timestamp
//  * @param {Object} countGroup - Group of counts with operator and machine info
//  * @returns {Object|null} Detailed cycle summary or null if no counts
//  */
// function buildSoftrolCycleSummary(cycle, sortedCounts, countGroup) {
//   const cycleStart = new Date(cycle.start);
//   const cycleEnd = new Date(cycle.end);

//   // Get counts within this cycle
//   const cycleCounts = sortedCounts.filter((c) => {
//     const ts = new Date(c.timestamp);
//     return ts >= cycleStart && ts <= cycleEnd;
//   });

//   if (!cycleCounts.length) return null;

//   // Calculate basic stats
//   const stats = processCountStatistics(cycleCounts);
//   const { runtime } = calculateOperatorTimes(
//     cycle.states,
//     cycleStart,
//     cycleEnd
//   );

//   // Calculate performance metrics
//   const piecesPerHour = calculatePiecesPerHour(stats.total, runtime);
//   const efficiency = calculateEfficiency(
//     runtime,
//     stats.total,
//     cycleCounts
//   );

//   // Process items and determine standard
//   const itemGroups = groupCountsByItem(cycleCounts);
//   const items = Object.entries(itemGroups).map(([itemId, group]) => ({
//     id: parseInt(itemId),
//     name: group[0]?.item?.name || "Unknown",
//     standard: group[0]?.item?.standard > 0 ? group[0]?.item?.standard : 666,
//     count: group.length
//   }));

//   // Calculate standard based on number of items
//   let standard;
//   if (items.length === 1) {
//     // For single items, use the standard directly from the database
//     standard = items[0].standard;
//   } else {
//     // For multiple items, calculate weighted average
//     const totalCount = items.reduce((sum, item) => sum + item.count, 0);
//     standard = items.reduce((sum, item) => {
//       const weight = totalCount > 0 ? item.count / totalCount : 0;
//       return sum + (weight * item.standard);
//     }, 0);
//   }

//   return {
//     startTimestamp: cycleStart.toISOString(),
//     endTimestamp: cycleEnd.toISOString(),
//     totalCount: stats.total,
//     items,
//     standard: Math.round(standard * 100) / 100,
//     piecesPerHour: Math.round(piecesPerHour * 100) / 100,
//     efficiency: Math.round(efficiency * 10000) / 100,
//     runtime: {
//       total: runtime,
//       formatted: formatDuration(runtime)
//     }
//   };
// }

// module.exports = {
//   buildSoftrolCycleSummary,
// };


const {
    processCountStatistics,
    extractItemNamesFromCounts,
    groupCountsByItem
  } = require("./count");
  
  const {
    calculateOperatorTimes,
    calculateEfficiency,
    calculatePiecesPerHour
  } = require("./analytics");
  
  const { formatDuration } = require("./time");
  
  /**
   * Builds a detailed summary for a Softrol cycle
   * @param {Object} cycle - The cycle object containing start, end, and states
   * @param {Array} sortedCounts - Array of counts sorted by timestamp
   * @param {Object} countGroup - Group of counts with operator and machine info
   * @returns {Object|null} Detailed cycle summary or null if no counts
   */
  function buildSoftrolCycleSummary(cycle, sortedCounts, countGroup) {
    const cycleStart = new Date(cycle.start);
    const cycleEnd = new Date(cycle.end);
  
    // Get counts within this cycle
    const cycleCounts = sortedCounts.filter(c => {
      const ts = new Date(c.timestamp);
      return ts >= cycleStart && ts <= cycleEnd && !c.misfeed;
    });
    
  
    if (!cycleCounts.length) return null;
  
    // Calculate basic stats
    const stats = processCountStatistics(cycleCounts);
    const { runtime } = calculateOperatorTimes(cycle.states, cycleStart, cycleEnd);
    const piecesPerHour = calculatePiecesPerHour(stats.total, runtime);
    const efficiency = calculateEfficiency(runtime, stats.total, cycleCounts);
  
    // Dynamic standard = pph / efficiency (guard against 0)
    const standard = efficiency > 0
      ? parseFloat((piecesPerHour / efficiency).toFixed(2))
      : 0;
  
    // Filter out counts without valid item data before grouping
    const itemGroups = groupCountsByItem(cycleCounts.filter(c => c.item));
    const task = Object.entries(itemGroups)
    .map(([_, group]) => group[0]?.item?.name || "Unknown")
    .join(", ");
  
  
    return {
      startTimestamp: cycleStart.toISOString(),
      endTimestamp: cycleEnd.toISOString(),
      totalCount: stats.total,
      task,
      standard: Math.round(standard)
    };
  }
  
  // async function getBookendedStates(db, serials, start, end) {
  //   const now = new Date();
  //   const effectiveEnd = new Date(end) > now ? now.toISOString() : end;
  
  //   if (end !== effectiveEnd) {
  //     console.log(`[Bookend] End date was in the future. Clamped to now: ${effectiveEnd}`);
  //   }
  
  //   const result = {};
  
  //   for (const serial of serials) {
  //     const serialInt = parseInt(serial);
  
  //     const [beforeStart, inRange, afterEnd] = await Promise.all([
  //       db.collection("state")
  //         .find({
  //           "machine.serial": serialInt,
  //           timestamp: { $lt: start }
  //         })
  //         .sort({ timestamp: -1 })
  //         .limit(1)
  //         .toArray(),
  
  //       db.collection("state")
  //         .find({
  //           "machine.serial": serialInt,
  //           timestamp: { $gte: start, $lte: effectiveEnd }
  //         })
  //         .sort({ timestamp: 1 })
  //         .toArray(),
  
  //       db.collection("state")
  //         .find({
  //           "machine.serial": serialInt,
  //           timestamp: { $gt: effectiveEnd }
  //         })
  //         .sort({ timestamp: 1 })
  //         .limit(1)
  //         .toArray()
  //     ]);
  
  //     if (beforeStart.length === 0) {
  //       console.log(`[Bookend] No pre-start state found for serial ${serialInt} before ${start}`);
  //     }
  
  //     if (afterEnd.length === 0) {
  //       console.log(`[Bookend] No post-end state found for serial ${serialInt} after ${effectiveEnd}`);
  //     }
  
  //     const combined = [
  //       ...beforeStart,
  //       ...inRange,
  //       ...afterEnd
  //     ].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  
  //     result[serialInt] = combined;
  //   }
  
  //   return result;
  // }

  async function getBookendedGlobalRange(db, serials, start, end) {
    const now = new Date();
    const effectiveEnd = new Date(end) > now ? now.toISOString() : end;
  
    let minPreStart = null;
    let maxPostEnd = null;
  
    for (const serial of serials) {
      const serialInt = parseInt(serial);
  
      const [beforeStart, afterEnd] = await Promise.all([
        db.collection("state")
          .find({ "machine.serial": serialInt, timestamp: { $lt: start } })
          .sort({ timestamp: -1 })
          .limit(1)
          .toArray(),
  
        db.collection("state")
          .find({ "machine.serial": serialInt, timestamp: { $gt: effectiveEnd } })
          .sort({ timestamp: 1 })
          .limit(1)
          .toArray()
      ]);
  
      if (beforeStart.length) {
        const ts = beforeStart[0].timestamp;
        if (!minPreStart || new Date(ts) < new Date(minPreStart)) {
          minPreStart = ts;
        }
      }
  
      if (afterEnd.length) {
        const ts = afterEnd[0].timestamp;
        if (!maxPostEnd || new Date(ts) > new Date(maxPostEnd)) {
          maxPostEnd = ts;
        }
      }
    }
  
    const adjustedStart = minPreStart ? minPreStart : start;
    const adjustedEnd = maxPostEnd ? maxPostEnd : effectiveEnd;
  
    return { adjustedStart, adjustedEnd };
  }
  
  
  
  module.exports = {
    buildSoftrolCycleSummary,
    getBookendedGlobalRange
  };
  