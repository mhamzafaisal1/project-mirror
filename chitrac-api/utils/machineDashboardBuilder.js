// ✅ Use CommonJS requires
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
  
  const { extractAllCyclesFromStates, extractFaultCycles } = require('./state');
  const { getMisfeedCounts, groupCountsByItem, processCountStatistics, groupCountsByOperatorAndMachine } = require('./count');
  
  // ✅ Use module.exports for CommonJS
  async function buildMachinePerformance(db, states, counts, start, end) {
    const runningCycles = extractAllCyclesFromStates(states, start, end).running;
    const misfeedCounts = await getMisfeedCounts(db, states[0]?.machine?.serial, start, end);
  
    const totalQueryMs = new Date(end) - new Date(start);
    const runtimeMs = runningCycles.reduce((total, cycle) => total + cycle.duration, 0);
    const downtimeMs = calculateDowntime(totalQueryMs, runtimeMs);
  
    const totalCount = calculateTotalCount(counts, misfeedCounts);
    const misfeedCount = misfeedCounts.length;
  
    const availability = calculateAvailability(runtimeMs, downtimeMs, totalQueryMs);
    const throughput = calculateThroughput(totalCount, misfeedCount);
    const efficiency = calculateEfficiency(runtimeMs, totalCount, counts);
    const oee = calculateOEE(availability, efficiency, throughput);
  
    return {
      runtime: {
        total: runtimeMs,
        formatted: formatDuration(runtimeMs),
      },
      downtime: {
        total: downtimeMs,
        formatted: formatDuration(downtimeMs),
      },
      output: {
        totalCount,
        misfeedCount,
      },
      performance: {
        availability: {
          value: availability,
          percentage: (availability * 100).toFixed(2) + "%",
        },
        throughput: {
          value: throughput,
          percentage: (throughput * 100).toFixed(2) + "%",
        },
        efficiency: {
          value: efficiency,
          percentage: (efficiency * 100).toFixed(2) + "%",
        },
        oee: {
          value: oee,
          percentage: (oee * 100).toFixed(2) + "%",
        },
      }
    };
  }

  function buildMachineItemSummary(states, counts, start, end) {
    try {
      if (!Array.isArray(states)) {
        throw new Error('States must be an array');
      }
      if (!Array.isArray(counts)) {
        throw new Error('Counts must be an array');
      }

      const cycles = extractAllCyclesFromStates(states, start, end).running;
      if (!cycles.length || !counts.length) {
        return {
          sessions: [],
          machineSummary: {
            totalCount: 0,
            workedTimeMs: 0,
            workedTimeFormatted: formatDuration(0),
            pph: 0,
            proratedStandard: 0,
            efficiency: 0,
            itemSummaries: {}
          }
        };
      }

      const itemSummary = {};
      let totalWorkedMs = 0;
      let totalCount = 0;
      const sessions = [];

      for (const cycle of cycles) {
        const cycleStart = new Date(cycle.start);
        const cycleEnd = new Date(cycle.end);
        const cycleMs = cycleEnd - cycleStart;

        const cycleCounts = counts.filter(c => {
          const ts = new Date(c.timestamp);
          return ts >= cycleStart && ts <= cycleEnd;
        });

        if (!cycleCounts.length) continue;

        const grouped = groupCountsByItem(cycleCounts);
        const operators = new Set(cycleCounts.map(c => c.operator?.id).filter(Boolean));
        const workedTimeMs = cycleMs * Math.max(1, operators.size);

        const cycleItems = [];
        for (const [itemId, group] of Object.entries(grouped)) {
          const name = group[0]?.item?.name || "Unknown";
          const standard = group[0]?.item?.standard > 0 ? group[0]?.item?.standard : 666;
          const countTotal = group.length;

          if (!itemSummary[itemId]) {
            itemSummary[itemId] = {
              name,
              standard,
              count: 0,
              workedTimeMs: 0
            };
          }

          itemSummary[itemId].count += countTotal;
          itemSummary[itemId].workedTimeMs += workedTimeMs;
          totalWorkedMs += workedTimeMs;
          totalCount += countTotal;

          const hours = workedTimeMs / 3600000;
          const pph = hours ? countTotal / hours : 0;
          const efficiency = standard ? pph / standard : 0;

          cycleItems.push({
            itemId: parseInt(itemId),
            name,
            countTotal,
            standard,
            pph: Math.round(pph * 100) / 100,
            efficiency: Math.round(efficiency * 10000) / 100
          });
        }

        sessions.push({
          start: cycleStart.toISOString(),
          end: cycleEnd.toISOString(),
          workedTimeMs,
          workedTimeFormatted: formatDuration(workedTimeMs),
          items: cycleItems
        });
      }

      // Calculate machine-level metrics
      const totalHours = totalWorkedMs / 3600000;
      const machinePph = totalHours > 0 ? totalCount / totalHours : 0;

      // Calculate prorated standard based on item counts
      const proratedStandard = Object.values(itemSummary).reduce((acc, item) => {
        const weight = totalCount > 0 ? item.count / totalCount : 0;
        return acc + weight * item.standard;
      }, 0);

      const machineEff = proratedStandard > 0 ? machinePph / proratedStandard : 0;

      // Format item summaries
      const formattedItemSummaries = {};
      for (const [itemId, item] of Object.entries(itemSummary)) {
        const hours = item.workedTimeMs / 3600000;
        const pph = hours ? item.count / hours : 0;
        const efficiency = item.standard ? pph / item.standard : 0;

        formattedItemSummaries[itemId] = {
          name: item.name,
          standard: item.standard,
          countTotal: item.count,
          workedTimeFormatted: formatDuration(item.workedTimeMs),
          pph: Math.round(pph * 100) / 100,
          efficiency: Math.round(efficiency * 10000) / 100
        };
      }

      return {
        sessions,
        machineSummary: {
          totalCount,
          workedTimeMs: totalWorkedMs,
          workedTimeFormatted: formatDuration(totalWorkedMs),
          pph: Math.round(machinePph * 100) / 100,
          proratedStandard: Math.round(proratedStandard * 100) / 100,
          efficiency: Math.round(machineEff * 10000) / 100,
          itemSummaries: formattedItemSummaries
        }
      };
    } catch (error) {
      console.error('Error in buildMachineItemSummary:', error);
      throw error;
    }
  }

  function buildItemHourlyStack(counts, start, end) {
    try {
      if (!Array.isArray(counts)) {
        throw new Error('Counts must be an array');
      }

      if (!counts.length) {
        return {
          title: "No data",
          data: { hours: [], operators: {} }
        };
      }

      const startDate = new Date(start);
      const endDate = new Date(end);

      // Normalize counts into hour buckets
      const hourMap = new Map(); // hourIndex => { itemName => count }
      const itemNames = new Set();

      for (const count of counts) {
        const ts = new Date(count.timestamp);
        const hourIndex = Math.floor((ts - startDate) / (60 * 60 * 1000)); // hour offset since start
        const itemName = count.item?.name || "Unknown";

        if (!hourMap.has(hourIndex)) {
          hourMap.set(hourIndex, {});
        }
        const hourEntry = hourMap.get(hourIndex);
        hourEntry[itemName] = (hourEntry[itemName] || 0) + 1;
        itemNames.add(itemName);
      }

      // Build structure: hours[], and for each item: count array by hour
      const maxHour = Math.max(...hourMap.keys());
      const hours = Array.from({ length: maxHour + 1 }, (_, i) => i);

      // Initialize operator structure with all items
      const operators = {};
      for (const name of itemNames) {
        operators[name] = Array(maxHour + 1).fill(0);
      }

      // Fill operator counts
      for (const [hourIndex, itemCounts] of hourMap.entries()) {
        for (const [itemName, count] of Object.entries(itemCounts)) {
          operators[itemName][hourIndex] = count;
        }
      }

      return {
        title: "Item Stacked Count Chart",
        data: {
          hours,
          operators
        }
      };
    } catch (error) {
      console.error('Error in buildItemHourlyStack:', error);
      throw error;
    }
  }

  function buildFaultData(states, start, end) {
    try {
      if (!Array.isArray(states)) {
        throw new Error('States must be an array');
      }

      if (!states.length) {
        return {
          faultCycles: [],
          faultSummaries: []
        };
      }

      // Extract fault cycles using the existing utility
      const { faultCycles, faultSummaries } = extractFaultCycles(states, start, end);

      // Format fault summaries with duration breakdowns
      const formattedSummaries = faultSummaries.map(summary => {
        const totalSeconds = Math.floor(summary.totalDuration / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;

        return {
          ...summary,
          formatted: {
            hours,
            minutes,
            seconds
          }
        };
      });

      // Sort fault cycles by start time
      const sortedFaultCycles = faultCycles.sort((a, b) => 
        new Date(a.start) - new Date(b.start)
      );

      return {
        faultCycles: sortedFaultCycles,
        faultSummaries: formattedSummaries
      };
    } catch (error) {
      console.error('Error in buildFaultData:', error);
      throw error;
    }
  }

  
function buildOperatorEfficiency(states, counts, start, end) {
  try {
    if (!Array.isArray(states)) {
      throw new Error('States must be an array');
    }
    if (!Array.isArray(counts)) {
      throw new Error('Counts must be an array');
    }

    if (!states.length || !counts.length) {
      return {
        operators: [],
        summary: {
          totalOperators: 0,
          averageEfficiency: 0,
          highestEfficiency: 0,
          lowestEfficiency: 0
        }
      };
    }

    const grouped = groupCountsByOperatorAndMachine(counts);
    const operators = [];

    for (const key in grouped) {
      const { operator, counts: opCounts } = grouped[key];
      const opStates = states.filter(s =>
        s.operators?.some(o => o.id === operator?.id)
      );

      const { runtime, downtime } = calculateOperatorTimes(opStates, start, end);
      const stats = processCountStatistics(opCounts);

      const efficiency = calculateEfficiency(runtime, stats.total, opCounts);
      const availability = calculateAvailability(runtime, downtime, new Date(end) - new Date(start));
      const throughput = calculateThroughput(stats.total, stats.misfeeds);

      operators.push({
        id: operator?.id,
        name: operator?.name || 'Unknown',
        metrics: {
          efficiency: Math.round(efficiency * 10000) / 100,
          availability: Math.round(availability * 10000) / 100,
          throughput: Math.round(throughput * 10000) / 100,
          runtime: {
            total: runtime,
            formatted: formatDuration(runtime)
          },
          output: {
            totalCount: stats.total,
            misfeedCount: stats.misfeeds,
            pph: stats.pph
          }
        }
      });
    }

    // Calculate summary metrics
    const efficiencies = operators.map(op => op.metrics.efficiency);
    const summary = {
      totalOperators: operators.length,
      averageEfficiency: Math.round(
        (efficiencies.reduce((a, b) => a + b, 0) / efficiencies.length) * 100
      ) / 100,
      highestEfficiency: Math.max(...efficiencies),
      lowestEfficiency: Math.min(...efficiencies)
    };

    return {
      operators,
      summary
    };
  } catch (error) {
    console.error('Error in buildOperatorEfficiency:', error);
    throw error;
  }
} 


  
  module.exports = {
    buildMachinePerformance,
    buildMachineItemSummary,
    buildItemHourlyStack,
    buildFaultData,
    buildOperatorEfficiency
  };