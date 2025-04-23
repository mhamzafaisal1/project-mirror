const { extractCyclesFromStates } = require("./state");

async function calculateRuntime(states, startTime, endTime) {
  // Use the same cycle extraction logic as run-session/state/cycles
  const cycles = extractCyclesFromStates(states, startTime, endTime);

  // Sum up the duration of all cycles
  return cycles.reduce((total, cycle) => {
    const cycleStart = new Date(cycle.start);
    const cycleEnd = new Date(cycle.end);
    const cycleDuration = cycleEnd - cycleStart;
    return total + cycleDuration;
  }, 0);
}

function calculateDowntime(totalQueryMs, runtimeMs) {
  return Math.max(totalQueryMs - runtimeMs, 0);
}

function calculateTotalCount(validCounts, misfeedCounts) {
  const totalCounts = validCounts.length + misfeedCounts.length;
  return totalCounts;
}

function calculateMisfeeds(misfeedCounts) {
  return misfeedCounts.length;
}

function calculateAvailability(runtimeMs, downtimeMs, totalQueryMs) {
  if (!totalQueryMs) return 0;
  const availability = runtimeMs / totalQueryMs;
  return Math.min(Math.max(availability, 0), 1);
}

function calculateThroughput(totalCount, misfeedCount) {
  const totalOutput = totalCount + misfeedCount;
  if (!totalOutput) return 0;
  const throughput = totalCount / totalOutput;
  return Math.min(Math.max(throughput, 0), 1);
}

/***  Time Credit Calculation Start */
function calculateTimeCreditsByItem(countRecords) {
  const itemMap = {};

  for (const record of countRecords) {
    const item = record.item;
    const key = `${item.id}-${item.name}`; // use both ID + name for uniqueness

    if (!itemMap[key]) {
      itemMap[key] = {
        id: item.id,
        name: item.name,
        standard: item.standard,
        count: 0
      };
    }

    itemMap[key].count += 1;
  }

  const itemsWithTimeCredit = Object.values(itemMap).map(item => {
    const { count, standard } = item;
    // Convert standard to per hour if it's in per minute (standard < 60)
    const standardPerHour = standard < 60 ? standard * 60 : standard;
    const timeCredit = standardPerHour > 0 ? count / (standardPerHour / 3600) : 0;
    return {
      ...item,
      timeCredit: parseFloat(timeCredit.toFixed(2))
    };
  });

  return itemsWithTimeCredit;
}

function calculateTotalTimeCredit(countRecords) {
  const itemCredits = calculateTimeCreditsByItem(countRecords);
  const totalTimeCredit = itemCredits.reduce((sum, item) => sum + item.timeCredit, 0);
  return parseFloat(totalTimeCredit.toFixed(2));
}

/***  Time Credit Calculation End */

/***  Efficiency Calculation Start */
function calculateEfficiency(runtimeMs, totalCount, counts) {
  if (!runtimeMs || !totalCount) return 0;
  // Convert runtime to seconds for efficiency calculation
  const runtimeSeconds = runtimeMs / (1000);
  const totalTimeCredit = calculateTotalTimeCredit(counts);
  const efficiency = totalTimeCredit / runtimeSeconds;
  return Math.min(Math.max(efficiency, 0), 1);
}
/***  Efficiency Calculation End */
function calculateOEE(availability, efficiency, throughput) {
  return availability * efficiency * throughput;
}

module.exports = {
  calculateRuntime,
  calculateDowntime,
  calculateTotalCount,
  calculateMisfeeds,
  calculateAvailability,
  calculateThroughput,
  calculateEfficiency,
  calculateOEE,
};
