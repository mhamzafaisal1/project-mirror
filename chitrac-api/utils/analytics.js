const { extractCyclesFromStates } = require('./state');

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

function calculateTotalCount(counts) {
const totalCounts =  counts.length;
return totalCounts;
}

function calculateMisfeeds(counts) {
  // Count misfeeds from status codes or specific item names
  const misfeeds = 0;
  return misfeeds;
}

function calculateAvailability(runtimeMs, downtimeMs, totalQueryMs) {
  if (!totalQueryMs) return 0;
  const availability = (runtimeMs + downtimeMs) / totalQueryMs;
  return Math.min(Math.max(availability, 0), 1);
}

function calculateThroughput(totalCount, misfeedCount) {
  const totalOutput = totalCount + misfeedCount;
  if (!totalOutput) return 0;
  const throughput = totalCount / totalOutput;
  return Math.min(Math.max(throughput, 0), 1);
}

//working on this: adding time credit, get the item and then figure out the time credit for it 
function calculateTimeCredit(totalCount) {
    const timeCredit = totalCount;
    return timeCredit;
}


function calculateEfficiency(runtimeMs, totalCount) {
  if (!runtimeMs || !totalCount) return 0;
  // Convert runtime to hours for efficiency calculation
  const timeCredit = totalCount;

  const runtimeHours = runtimeMs / (60 * 60 * 1000);
  const efficiency = totalCount / runtimeHours;
  return Math.min(Math.max(efficiency, 0), 1);
}

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
  calculateOEE
};
  