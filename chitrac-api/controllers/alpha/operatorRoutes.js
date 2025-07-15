// 📁 operatorRoutes.js
const express = require("express");

module.exports = function (server) {
  const router = express.Router();
  const db = server.db;
  const logger = server.logger;

  const {
    parseAndValidateQueryParams,
    createPaddedTimeRange,
    formatDuration,
    getHourlyIntervals,
  } = require("../../utils/time");

  const {
    fetchStatesForOperator,
    groupStatesByOperator,
    getCompletedCyclesForOperator,
    extractAllCyclesFromStates,
    extractFaultCycles,
    fetchAllStates,
    groupStatesByOperatorAndSerial,
    extractFaultCyclesFromStates,
    extractCyclesFromStates
  } = require("../../utils/state");

  const {
    getCountsForOperator,
    getValidCountsForOperator,
    getOperatorNameFromCount,
    processCountStatistics,
    groupCountsByItem,
    extractItemNamesFromCounts,
    groupCountsByOperatorAndMachine,
    getCountsForOperatorMachinePairs,
    groupCountsByOperator,
  } = require("../../utils/count");

  const {
    buildTopOperatorEfficiency,
  } = require("../../utils/dailyDashboardBuilder");

  const {
    getAllOperatorIds,
    buildOperatorPerformance,
    buildOperatorItemSummary,
    buildOperatorCountByItem,
    buildOperatorCyclePie,
    buildOperatorFaultHistory,
    buildOperatorEfficiencyLine,
    buildOptimizedOperatorItemSummary,
    buildOptimizedOperatorCountByItem,
    buildOptimizedOperatorCyclePie,
    buildOptimizedOperatorFaultHistory,
    fetchOperatorDashboardData
  } = require("../../utils/operatorDashboardBuilder");

  const {
    calculateDowntime,
    calculateAvailability,
    calculateEfficiency,
    calculateOEE,
    calculateThroughput,
    calculateTotalCount,
    calculateOperatorTimes,
    calculateMisfeeds,
    calculatePiecesPerHour,
  } = require("../../utils/analytics");

  const {
    fetchGroupedAnalyticsData
  } = require("../../utils/fetchData");

  // Helper to chunk an array into batches
  function chunkArray(arr, size) {
    return Array.from({ length: Math.ceil(arr.length / size) }, (_, i) =>
      arr.slice(i * size, i * size + size)
    );
  }

  // Optimized preprocessing function with minimal traversals
  function preprocessOperatorData(states, validCounts, allCounts, start, end) {
    const startDate = new Date(start);
    const endDate = new Date(end);
    
    // Single-pass data extraction and grouping
    const data = {
      runningCycles: [],
      faultCycles: { faultCycles: [], faultSummaries: [] },
      hourlyCountsMap: new Map(),
      hourlyStatesMap: new Map(),
      itemHourMap: new Map(),
      cycleAssignments: new Map(),
      itemCountsMap: {},
      operatorMachineCountsMap: {},
      operatorCountsMap: {},
      itemNames: new Set(),
      totalRuntimeMs: 0,
      totalFaultMs: 0,
      totalCounts: { valid: validCounts.length, misfeed: 0, total: allCounts.length },
      operatorName: validCounts[0]?.operator?.name || allCounts[0]?.operator?.name || "Unknown",
      currentStatus: { code: 0, name: "Unknown" }
    };

    // Extract cycles and calculate totals in single pass
    if (states.length > 0) {
      const allCycles = extractAllCyclesFromStates(states, start, end);
      data.runningCycles = allCycles.running;
      data.faultCycles = extractFaultCycles(states, start, end);
      
      // Calculate totals
      data.totalRuntimeMs = data.runningCycles.reduce((sum, c) => sum + c.duration, 0);
      data.totalFaultMs = data.faultCycles.faultCycles.reduce((sum, c) => sum + c.duration, 0);
      data.currentStatus = {
        code: states[states.length - 1]?.status?.code || 0,
        name: states[states.length - 1]?.status?.name || "Unknown"
      };
    }

    // Single-pass count processing with optimized data structures
    const countIndex = new Map(); // timestamp → count for O(1) cycle assignment
    const itemGroups = new Map(); // itemId → { name, standard, count, items: [] }
    const operatorGroups = new Map(); // operatorId → { counts: [], validCounts: [] }
    const operatorMachineGroups = new Map(); // "operatorId-machineId" → { counts: [], validCounts: [] }

    for (const count of allCounts) {
      const ts = new Date(count.timestamp);
      const hourIndex = Math.floor((ts - startDate) / (60 * 60 * 1000));
      
      // Build hourly maps
      if (!data.hourlyCountsMap.has(hourIndex)) {
        data.hourlyCountsMap.set(hourIndex, []);
        data.itemHourMap.set(hourIndex, {});
      }
      data.hourlyCountsMap.get(hourIndex).push(count);
      
      const hourEntry = data.itemHourMap.get(hourIndex);
      const itemName = count.item?.name || "Unknown";
      hourEntry[itemName] = (hourEntry[itemName] || 0) + 1;
      data.itemNames.add(itemName);

      // Build item groups
      const itemId = count.item?.id || "unknown";
      if (!itemGroups.has(itemId)) {
        itemGroups.set(itemId, {
          name: itemName,
          standard: count.item?.standard || 666,
          count: 0,
          items: []
        });
      }
      const itemGroup = itemGroups.get(itemId);
      itemGroup.count++;
      itemGroup.items.push(count);

      // Build operator groups
      const operatorId = count.operator?.id;
      if (operatorId) {
        if (!operatorGroups.has(operatorId)) {
          operatorGroups.set(operatorId, { counts: [], validCounts: [] });
        }
        const opGroup = operatorGroups.get(operatorId);
        opGroup.counts.push(count);
        if (!count.misfeed) {
          opGroup.validCounts.push(count);
        }

        // Build operator-machine groups
        const machineId = count.machine?.serial;
        if (machineId) {
          const key = `${operatorId}-${machineId}`;
          if (!operatorMachineGroups.has(key)) {
            operatorMachineGroups.set(key, { counts: [], validCounts: [] });
          }
          const opMachineGroup = operatorMachineGroups.get(key);
          opMachineGroup.counts.push(count);
          if (!count.misfeed) {
            opMachineGroup.validCounts.push(count);
          }
        }
      }

      // Index for cycle assignment
      countIndex.set(count.timestamp, count);
    }

    // Single-pass state processing
    for (const state of states) {
      const ts = new Date(state.timestamp);
      const hourIndex = Math.floor((ts - startDate) / (60 * 60 * 1000));
      
      if (!data.hourlyStatesMap.has(hourIndex)) {
        data.hourlyStatesMap.set(hourIndex, []);
      }
      data.hourlyStatesMap.get(hourIndex).push(state);
    }

    // Optimized cycle assignment using indexed counts
    for (let i = 0; i < data.runningCycles.length; i++) {
      const cycle = data.runningCycles[i];
      const cycleStart = new Date(cycle.start);
      const cycleEnd = new Date(cycle.end);
      
      const cycleCounts = [];
      for (const [timestamp, count] of countIndex) {
        const ts = new Date(timestamp);
        if (ts >= cycleStart && ts <= cycleEnd) {
          cycleCounts.push(count);
        }
      }
      data.cycleAssignments.set(i, cycleCounts);
    }

    // Convert maps to expected format
    data.itemCountsMap = Object.fromEntries(itemGroups);
    data.operatorCountsMap = Object.fromEntries(operatorGroups);
    data.operatorMachineCountsMap = Object.fromEntries(operatorMachineGroups);
    data.itemNames = Array.from(data.itemNames);

    return data;
  }

  // MongoDB aggregation-based preprocessing for operator dashboard
  async function preprocessOperatorDataAggregated(db, start, end) {
    const matchStage = {
      timestamp: { $gte: new Date(start), $lte: new Date(end) }
    };

    // Aggregate counts by operator
    const countPipeline = [
      { $match: matchStage },
      { $match: { "operator.id": { $exists: true, $ne: null, $ne: -1 } } },
      {
        $group: {
          _id: "$operator.id",
          operatorName: { $first: "$operator.name" },
          counts: { $push: "$$ROOT" },
          totalValid: {
            $sum: {
              $cond: [
                { $and: [{ $ne: ["$operator.id", -1] }, { $ne: ["$misfeed", true] }] },
                1,
                0
              ]
            }
          },
          totalMisfeed: {
            $sum: {
              $cond: [{ $eq: ["$misfeed", true] }, 1, 0]
            }
          },
          itemSummary: {
            $push: {
              itemId: "$item.id",
              itemName: "$item.name",
              itemStandard: "$item.standard",
              machineSerial: "$machine.serial",
              timestamp: "$timestamp",
              misfeed: "$misfeed"
            }
          }
        }
      },
      {
        $project: {
          operatorName: 1,
          counts: {
            $map: {
              input: "$counts",
              as: "count",
              in: {
                timestamp: "$$count.timestamp",
                machine: {
                  serial: "$$count.machine.serial"
                },
                operator: {
                  id: "$$count.operator.id",
                  name: "$$count.operator.name"
                },
                item: {
                  id: "$$count.item.id",
                  name: "$$count.item.name",
                  standard: "$$count.item.standard"
                },
                misfeed: "$$count.misfeed"
              }
            }
          },
          totalValid: 1,
          totalMisfeed: 1,
          itemSummary: 1
        }
      }
    ];

    // For states, we need to get all states and then group by operator in JS
    // since states don't have operator.id field directly
    const states = await db.collection("state")
      .find(matchStage)
      .project({
        timestamp: 1,
        "machine.serial": 1,
        "machine.name": 1,
        "program.mode": 1,
        "status.code": 1,
        "status.name": 1,
        operators: 1
      })
      .sort({ timestamp: 1 })
      .toArray();

    const countResults = await db.collection("count").aggregate(countPipeline).toArray();

    // Group states by operator in JavaScript
    const stateGroups = {};
    for (const state of states) {
      if (state.operators && Array.isArray(state.operators)) {
        for (const operator of state.operators) {
          const operatorId = operator.id;
          if (!stateGroups[operatorId]) {
            stateGroups[operatorId] = {
              states: [],
              latestStatus: { code: 0, name: "Unknown" }
            };
          }
          
          // Transform state to match expected format
          const transformedState = {
            timestamp: state.timestamp,
            machine: {
              serial: state.machine?.serial,
              name: state.machine?.name
            },
            program: {
              mode: state.program?.mode
            },
            status: {
              code: state.status?.code,
              name: state.status?.name
            },
            operators: state.operators
          };
          
          stateGroups[operatorId].states.push(transformedState);
          
          // Update latest status
          if (state.status) {
            stateGroups[operatorId].latestStatus = {
              code: state.status.code || 0,
              name: state.status.name || "Unknown"
            };
          }
        }
      }
    }

    // Merge results by operator id
    const grouped = {};
    for (const result of countResults) {
      const operatorId = result._id;
      grouped[operatorId] = {
        operatorName: result.operatorName,
        counts: result.counts,
        totalValid: result.totalValid,
        totalMisfeed: result.totalMisfeed,
        itemSummary: result.itemSummary,
        states: stateGroups[operatorId]?.states || [],
        latestStatus: stateGroups[operatorId]?.latestStatus || { code: 0, name: "Unknown" }
      };
    }
    
    // Add operators that only have states but no counts
    for (const [operatorId, stateGroup] of Object.entries(stateGroups)) {
      if (!grouped[operatorId]) {
        grouped[operatorId] = {
          operatorName: "Unknown",
          counts: [],
          totalValid: 0,
          totalMisfeed: 0,
          itemSummary: [],
          states: stateGroup.states,
          latestStatus: stateGroup.latestStatus
        };
      }
    }
    
    return grouped;
  }

  // Optimized build functions using pre-calculated data
  function buildOperatorPerformanceOptimized(preprocessedData, start, end) {
    const { totalRuntimeMs, totalCounts } = preprocessedData;
    const totalQueryMs = new Date(end) - new Date(start);
    const downtimeMs = calculateDowntime(totalQueryMs, totalRuntimeMs);

    const totalCount = totalCounts.total;
    const misfeedCount = totalCounts.total - totalCounts.valid;

    const availability = calculateAvailability(totalRuntimeMs, downtimeMs, totalQueryMs);
    const throughput = calculateThroughput(totalCounts.valid, misfeedCount);
    const efficiency = calculateEfficiency(totalRuntimeMs, totalCounts.valid, []);
    const oee = calculateOEE(availability, efficiency, throughput);

    return {
      runtime: {
        total: totalRuntimeMs,
        formatted: formatDuration(totalRuntimeMs),
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
      },
    };
  }

  function buildOperatorItemSummaryOptimized(preprocessedData, start, end) {
    const { runningCycles, cycleAssignments, itemCountsMap, totalRuntimeMs, totalCounts } = preprocessedData;
    
    if (!runningCycles.length) {
      return {
        sessions: [],
        operatorSummary: {
          totalCount: 0,
          workedTimeMs: 0,
          workedTimeFormatted: formatDuration(0),
          pph: 0,
          proratedStandard: 0,
          efficiency: 0,
          itemSummaries: {},
        },
      };
    }

    const sessions = [];
    const formattedItemSummaries = {};

    // Build sessions using pre-assigned cycle counts
    for (let i = 0; i < runningCycles.length; i++) {
      const cycle = runningCycles[i];
      const cycleCounts = cycleAssignments.get(i) || [];
      
      if (!cycleCounts.length) continue;

      const cycleStart = new Date(cycle.start);
      const cycleEnd = new Date(cycle.end);
      const cycleMs = cycleEnd - cycleStart;

      const cycleItems = [];
      for (const [itemId, itemGroup] of Object.entries(itemCountsMap)) {
        const cycleItemCounts = itemGroup.items.filter(c => {
          const ts = new Date(c.timestamp);
          return ts >= cycleStart && ts <= cycleEnd;
        });
        
        if (cycleItemCounts.length === 0) continue;

        const name = itemGroup.name;
        const standard = itemGroup.standard;
        const countTotal = cycleItemCounts.length;

        const hours = cycleMs / 3600000;
        const pph = hours ? countTotal / hours : 0;
        const efficiency = standard ? pph / standard : 0;

        cycleItems.push({
          itemId: parseInt(itemId),
          name,
          countTotal,
          standard,
          pph: Math.round(pph * 100) / 100,
          efficiency: Math.round(efficiency * 10000) / 100,
        });
      }

      sessions.push({
        start: cycleStart.toISOString(),
        end: cycleEnd.toISOString(),
        workedTimeMs: cycleMs,
        workedTimeFormatted: formatDuration(cycleMs),
        items: cycleItems,
      });
    }

    // Build item summaries from pre-grouped data
    for (const [itemId, itemGroup] of Object.entries(itemCountsMap)) {
      const hours = totalRuntimeMs / 3600000;
      const pph = hours ? itemGroup.count / hours : 0;
      const efficiency = itemGroup.standard ? pph / itemGroup.standard : 0;

      formattedItemSummaries[itemId] = {
        name: itemGroup.name,
        standard: itemGroup.standard,
        countTotal: itemGroup.count,
        workedTimeFormatted: formatDuration(totalRuntimeMs),
        pph: Math.round(pph * 100) / 100,
        efficiency: Math.round(efficiency * 10000) / 100,
      };
    }

    const totalHours = totalRuntimeMs / 3600000;
    const operatorPph = totalHours > 0 ? totalCounts.total / totalHours : 0;

    const proratedStandard = Object.values(itemCountsMap).reduce((acc, item) => {
      const weight = totalCounts.total > 0 ? item.count / totalCounts.total : 0;
      return acc + weight * item.standard;
    }, 0);

    const operatorEff = proratedStandard > 0 ? operatorPph / proratedStandard : 0;

    return {
      sessions,
      operatorSummary: {
        totalCount: totalCounts.total,
        workedTimeMs: totalRuntimeMs,
        workedTimeFormatted: formatDuration(totalRuntimeMs),
        pph: Math.round(operatorPph * 100) / 100,
        proratedStandard: Math.round(proratedStandard * 100) / 100,
        efficiency: Math.round(operatorEff * 10000) / 100,
        itemSummaries: formattedItemSummaries,
      },
    };
  }

  function buildOperatorCountByItemOptimized(preprocessedData, start, end) {
    const { itemCountsMap } = preprocessedData;
    
    if (!itemCountsMap || Object.keys(itemCountsMap).length === 0) {
      return {
        title: "No data",
        data: { items: [], counts: [] }
      };
    }

    const items = [];
    const counts = [];

    for (const [itemId, itemGroup] of Object.entries(itemCountsMap)) {
      items.push(itemGroup.name);
      counts.push(itemGroup.count);
    }

    return {
      title: "Count by Item",
      data: { items, counts }
    };
  }

  function buildOperatorCyclePieOptimized(preprocessedData, start, end) {
    const { totalRuntimeMs, totalFaultMs } = preprocessedData;
    const totalMs = new Date(end) - new Date(start);
    const otherMs = totalMs - totalRuntimeMs - totalFaultMs;

    return {
      title: "Cycle Distribution",
      data: {
        labels: ["Running", "Fault", "Other"],
        values: [totalRuntimeMs, totalFaultMs, otherMs],
        colors: ["#4CAF50", "#F44336", "#9E9E9E"]
      }
    };
  }

  function buildOperatorFaultHistoryOptimized(preprocessedData, start, end) {
    const { faultCycles } = preprocessedData;
    
    if (!faultCycles.faultCycles || !faultCycles.faultCycles.length) {
      return {
        faultCycles: [],
        faultSummaries: [],
      };
    }

    const formattedSummaries = faultCycles.faultSummaries.map((summary) => {
      const totalSeconds = Math.floor(summary.totalDuration / 1000);
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;

      return {
        ...summary,
        formatted: { hours, minutes, seconds },
      };
    });

    const sortedFaultCycles = faultCycles.faultCycles.sort(
      (a, b) => new Date(a.start) - new Date(b.start)
    );

    return {
      faultCycles: sortedFaultCycles,
      faultSummaries: formattedSummaries,
    };
  }

  router.get("/daily-dashboard/operator-efficiency-top10", async (req, res) => {
    try {
      const { start, end } = parseAndValidateQueryParams(req);
      const operators = await buildTopOperatorEfficiency(db, start, end);

      res.json({
        timeRange: {
          start,
          end,
          total: formatDuration(new Date(end) - new Date(start)),
        },
        operators,
      });
    } catch (err) {
      logger.error("Error in /daily-dashboard/operator-efficiency-top10:", err);
      res
        .status(500)
        .json({ error: "Failed to fetch top operator efficiencies" });
    }
  });

  // router.get("/analytics/operator-dashboard", async (req, res) => {
  //   try {
  //     const { start, end } = parseAndValidateQueryParams(req);
  //     const { paddedStart, paddedEnd } = createPaddedTimeRange(start, end);

  //     const groupedData = await fetchGroupedAnalyticsData(
  //       db,
  //       paddedStart,
  //       paddedEnd,
  //       "operator"
  //     );
  
  //     const results = await Promise.all(
  //       Object.entries(groupedData).map(async ([operatorId, group]) => {
  //         const numericOperatorId = parseInt(operatorId);
  //         const { states, counts } = group;
      
  //         if (!states.length && !counts.all.length) return null;
      
  //         const [
  //           performance,
  //           itemSummary,
  //           countByItem,
  //           cyclePie,
  //           faultHistory,
  //           dailyEfficiency
  //         ] = await Promise.all([
  //           buildOperatorPerformance(states, counts.valid, counts.misfeed, start, end),
  //           buildOperatorItemSummary(states, counts.all, start, end, group.machineNames || {}),
  //           buildOperatorCountByItem(group, start, end),
  //           buildOperatorCyclePie(group, start, end),
  //           buildOperatorFaultHistory({ [operatorId]: group }, start, end),
  //           buildOperatorEfficiencyLine(group, start, end, db)
  //         ]);
      
  //         const operatorName =
  //           counts.valid[0]?.operator?.name ||
  //           counts.all[0]?.operator?.name ||
  //           "Unknown";
      
  //         return {
  //           operator: {
  //             id: numericOperatorId,
  //             name: operatorName,
  //           },
  //           currentStatus: {
  //             code: states[states.length - 1]?.status?.code || 0,
  //             name: states[states.length - 1]?.status?.name || "Unknown",
  //           },
  //           performance,
  //           itemSummary,
  //           countByItem,
  //           cyclePie,
  //           faultHistory,
  //           dailyEfficiency,
  //         };
  //       })
  //     );
      
  //     // Filter out nulls from skipped operators
  //     res.json(results.filter(r => r !== null));
      
  //   } catch (err) {
  //     logger.error("Error in /analytics/operator-dashboard route:", err);
  //     res
  //       .status(500)
  //       .json({ error: "Failed to fetch operator dashboard data" });
  //   }
  // });
  
  
  router.get("/analytics/operator-dashboard", async (req, res) => {
    try {
      const { start, end } = parseAndValidateQueryParams(req);
      const { paddedStart, paddedEnd } = createPaddedTimeRange(start, end);
  
      const groupedData = await fetchGroupedAnalyticsData(
        db,
        paddedStart,
        paddedEnd,
        "operator"
      );
  
      const results = [];
      const entries = Object.entries(groupedData);
      const chunks = chunkArray(entries, 5); // 5 at a time
  
      for (const chunk of chunks) {
        const partial = await Promise.all(
          chunk.map(async ([operatorId, group]) => {
            const numericOperatorId = parseInt(operatorId);
            const { states, counts } = group;
  
            if (!states.length && !counts.all.length) return null;
  
            // Preprocess once and reuse
            const validCounts = counts.valid;
            const misfeedCounts = counts.misfeed;
            const allCounts = counts.all;
  
            const [
              performance,
              itemSummary,
              countByItem,
              cyclePie,
              faultHistory,
              dailyEfficiency
            ] = await Promise.all([
              buildOperatorPerformance(states, validCounts, misfeedCounts, start, end),
              buildOptimizedOperatorItemSummary(states, allCounts, start, end, group.machineNames || {}),
              buildOptimizedOperatorCountByItem(allCounts, start, end),
              buildOptimizedOperatorCyclePie(group.states, start, end),
              buildOptimizedOperatorFaultHistory({ [operatorId]: group }, start, end),
              buildOperatorEfficiencyLine(group, start, end, db)
            ]);
  
            const operatorName =
              validCounts[0]?.operator?.name ||
              allCounts[0]?.operator?.name ||
              "Unknown";
  
            return {
              operator: {
                id: numericOperatorId,
                name: operatorName,
              },
              currentStatus: {
                code: states[states.length - 1]?.status?.code || 0,
                name: states[states.length - 1]?.status?.name || "Unknown",
              },
              performance,
              itemSummary,
              countByItem,
              cyclePie,
              faultHistory,
              dailyEfficiency,
            };
          })
        );
        results.push(...partial.filter(r => r !== null));
      }
  
      res.json(results);
  
    } catch (err) {
      logger.error("Error in /analytics/operator-dashboard route:", err);
      res.status(500).json({ error: "Failed to fetch operator dashboard data" });
    }
  });

  router.get("/analytics/operator-dashboard-v2", async (req, res) => {
    try {
      const { start, end } = parseAndValidateQueryParams(req);
      const { paddedStart, paddedEnd } = createPaddedTimeRange(start, end);

      // Use the new optimized helper
      const results = await fetchOperatorDashboardData(db, paddedStart, paddedEnd);
      res.json(results);
    } catch (err) {
      logger.error("Error in /analytics/operator-dashboard route:", err);
      res.status(500).json({ error: "Failed to fetch operator dashboard data" });
    }
  });
  

  router.get("/analytics/operator-dashboard-optimized", async (req, res) => {
    try {
      const { start, end } = parseAndValidateQueryParams(req);
      const { paddedStart, paddedEnd } = createPaddedTimeRange(start, end);

      // Use aggregation-based preprocessing
      const groupedData = await preprocessOperatorDataAggregated(db, paddedStart, paddedEnd);

      // Process all operators in parallel with pre-aggregated data
      const results = await Promise.all(
        Object.entries(groupedData).map(async ([operatorId, group]) => {
          const numericOperatorId = parseInt(operatorId);
          const { states, counts, operatorName, latestStatus, totalValid, totalMisfeed, itemSummary } = group;

          if (!states.length && !counts.length) return null;

          // Minimal in-memory preprocessing
          const preprocessedData = {
            runningCycles: [],
            faultCycles: { faultCycles: [], faultSummaries: [] },
            hourlyCountsMap: new Map(),
            hourlyStatesMap: new Map(),
            itemHourMap: new Map(),
            cycleAssignments: new Map(),
            itemCountsMap: {},
            operatorMachineCountsMap: {},
            operatorCountsMap: {},
            itemNames: new Set(),
            totalRuntimeMs: 0,
            totalFaultMs: 0,
            totalCounts: { valid: totalValid, misfeed: totalMisfeed, total: counts.length },
            operatorName: operatorName,
            currentStatus: { code: latestStatus?.code || 0, name: latestStatus?.name || "Unknown" }
          };

          // Only do cycle extraction and minimal grouping in JS
          if (states.length > 0) {
            const allCycles = extractAllCyclesFromStates(states, start, end);
            preprocessedData.runningCycles = allCycles.running;
            preprocessedData.faultCycles = extractFaultCycles(states, start, end);
            preprocessedData.totalRuntimeMs = preprocessedData.runningCycles.reduce((sum, c) => sum + c.duration, 0);
            preprocessedData.totalFaultMs = preprocessedData.faultCycles.faultCycles.reduce((sum, c) => sum + c.duration, 0);
          }

          // Pre-group item counts
          const itemGroups = {};
          for (const item of itemSummary) {
            if (item.misfeed) continue;
            const itemId = item.itemId;
            if (!itemGroups[itemId]) {
              itemGroups[itemId] = { name: item.itemName, standard: item.itemStandard, count: 0, items: [] };
            }
            itemGroups[itemId].count++;
            itemGroups[itemId].items.push(item);
            preprocessedData.itemNames.add(item.itemName);
          }
          preprocessedData.itemCountsMap = itemGroups;
          preprocessedData.itemNames = Array.from(preprocessedData.itemNames);

          // Pre-group hourly counts
          const startDate = new Date(start);
          for (const count of counts) {
            const ts = new Date(count.timestamp);
            const hourIndex = Math.floor((ts - startDate) / (60 * 60 * 1000));
            if (!preprocessedData.hourlyCountsMap.has(hourIndex)) {
              preprocessedData.hourlyCountsMap.set(hourIndex, []);
              preprocessedData.itemHourMap.set(hourIndex, {});
            }
            preprocessedData.hourlyCountsMap.get(hourIndex).push(count);
            const hourEntry = preprocessedData.itemHourMap.get(hourIndex);
            const itemName = count.item?.name || "Unknown";
            hourEntry[itemName] = (hourEntry[itemName] || 0) + 1;
          }
          // Pre-group hourly states
          for (const state of states) {
            const ts = new Date(state.timestamp);
            const hourIndex = Math.floor((ts - startDate) / (60 * 60 * 1000));
            if (!preprocessedData.hourlyStatesMap.has(hourIndex)) {
              preprocessedData.hourlyStatesMap.set(hourIndex, []);
            }
            preprocessedData.hourlyStatesMap.get(hourIndex).push(state);
          }
          // Assign counts to cycles
          for (let i = 0; i < preprocessedData.runningCycles.length; i++) {
            const cycle = preprocessedData.runningCycles[i];
            const cycleStart = new Date(cycle.start);
            const cycleEnd = new Date(cycle.end);
            const cycleCounts = counts.filter(c => {
              const ts = new Date(c.timestamp);
              return ts >= cycleStart && ts <= cycleEnd;
            });
            preprocessedData.cycleAssignments.set(i, cycleCounts);
          }

          // All build functions use pre-calculated data - no additional traversals
          const [
            performance,
            itemSummaryResult,
            countByItem,
            cyclePie,
            faultHistory,
            dailyEfficiency
          ] = await Promise.all([
            buildOperatorPerformanceOptimized(preprocessedData, start, end),
            buildOperatorItemSummaryOptimized(preprocessedData, start, end),
            buildOperatorCountByItemOptimized(preprocessedData, start, end),
            buildOperatorCyclePieOptimized(preprocessedData, start, end),
            buildOperatorFaultHistoryOptimized(preprocessedData, start, end),
            buildOperatorEfficiencyLine(group, start, end, db)
          ]);

          return {
            operator: {
              id: numericOperatorId,
              name: preprocessedData.operatorName,
            },
            currentStatus: preprocessedData.currentStatus,
            performance,
            itemSummary: itemSummaryResult,
            countByItem,
            cyclePie,
            faultHistory,
            dailyEfficiency,
          };
        })
      );

      res.json(results.filter(r => r !== null));

    } catch (err) {
      logger.error("Error in /analytics/operator-dashboard-optimized route:", err);
      res.status(500).json({ error: "Failed to fetch operator dashboard data" });
    }
  });

  // Helper: Build item summary from aggregation and run time
  function buildAggregatedOperatorItemSummary(itemAgg, totalRunMs) {
    // itemAgg: array of { operatorId, machineSerial, machineName, itemId, itemName, standard, count, misfeed }
    const result = [];
    for (const row of itemAgg) {
      const hours = totalRunMs / 3600000;
      const pph = hours > 0 ? row.count / hours : 0;
      const efficiency = row.standard > 0 ? pph / row.standard : 0;
      result.push({
        operatorName: row.operatorName,
        machineSerial: row.machineSerial,
        machineName: row.machineName,
        itemName: row.itemName,
        count: row.count,
        misfeed: row.misfeed,
        rawRunMs: totalRunMs,
        standard: row.standard,
        workedTimeFormatted: formatDuration(totalRunMs),
        pph: Math.round(pph * 100) / 100,
        efficiency: Math.round(efficiency * 10000) / 100
      });
    }
    return result;
  }

  // Helper: Build hourly count by item from aggregation
  function buildAggregatedOperatorCountByItem(hourlyAgg) {
    // hourlyAgg: array of { itemId, itemName, hourlyCounts: [{hour, count}], total }
    const operators = {};
    for (const row of hourlyAgg) {
      const arr = Array(24).fill(0);
      for (const hc of row.hourlyCounts) {
        arr[hc.hour] = hc.count;
      }
      operators[row.itemName] = arr;
    }
    return {
      title: 'Operator Counts by item',
      data: {
        hours: Array.from({ length: 24 }, (_, i) => i),
        operators
      }
    };
  }

  // Aggregated operator performance route
  router.get("/analytics/operator-performance-agg", async (req, res) => {
    try {
      // Step 1: Parse and validate query parameters
      const { start, end, operatorId } = parseAndValidateQueryParams(req);
      const { paddedStart, paddedEnd } = createPaddedTimeRange(start, end);

      let states;
      let groupedStates;

      if (operatorId) {
        // If operatorId provided, get states for just that operator
        states = await fetchStatesForOperator(
          db,
          operatorId,
          paddedStart,
          paddedEnd
        );
        // Create a single group for this operator
        groupedStates = {
          [operatorId]: {
            operator: {
              id: operatorId,
              name: await getOperatorNameFromCount(db, operatorId),
            },
            states: states,
          },
        };
      } else {
        // If no operatorId, get all states and group them by operator
        const allStates = await fetchStatesForOperator(
          db,
          null,
          paddedStart,
          paddedEnd
        );
        groupedStates = groupStatesByOperator(allStates);

        // Update operator names for all groups
        for (const [opId, group] of Object.entries(groupedStates)) {
          group.operator.name = await getOperatorNameFromCount(db, opId);
        }
      }

      // Step 3: Get all operator IDs for count query
      const operatorIds = Object.keys(groupedStates).map((id) => parseInt(id));

      // Use aggregation to get count stats per operator
      const countAgg = await db.collection("count").aggregate([
        {
          $match: {
            "operator.id": { $in: operatorIds },
            timestamp: { $gte: new Date(start), $lte: new Date(end) }
          }
        },
        {
          $group: {
            _id: "$operator.id",
            operatorName: { $first: "$operator.name" },
            totalCount: { $sum: 1 },
            validCount: { $sum: { $cond: [ { $ne: ["$misfeed", true] }, 1, 0 ] } },
            misfeedCount: { $sum: { $cond: [ { $eq: ["$misfeed", true] }, 1, 0 ] } },
            allCounts: { $push: "$$ROOT" }
          }
        }
      ]).toArray();
      const operatorCounts = {};
      for (const agg of countAgg) {
        operatorCounts[agg._id] = {
          counts: agg.allCounts,
          validCounts: agg.allCounts.filter(c => !c.misfeed),
          misfeedCounts: agg.allCounts.filter(c => c.misfeed),
          totalCount: agg.totalCount,
          validCount: agg.validCount,
          misfeedCount: agg.misfeedCount,
        };
      }

      // Aggregation for item summary (per operator, machine, item)
      const itemAggRaw = await db.collection("count").aggregate([
        {
          $match: {
            "operator.id": { $in: operatorIds },
            timestamp: { $gte: new Date(start), $lte: new Date(end) },
          }
        },
        {
          $group: {
            _id: {
              operatorId: "$operator.id",
              operatorName: "$operator.name",
              machineSerial: "$machine.serial",
              machineName: "$machine.name",
              itemId: "$item.id",
              itemName: "$item.name",
              standard: "$item.standard"
            },
            count: { $sum: { $cond: [ { $ne: ["$misfeed", true] }, 1, 0 ] } },
            misfeed: { $sum: { $cond: [ { $eq: ["$misfeed", true] }, 1, 0 ] } }
          }
        },
        {
          $project: {
            operatorId: "$_id.operatorId",
            operatorName: "$_id.operatorName",
            machineSerial: "$_id.machineSerial",
            machineName: "$_id.machineName",
            itemId: "$_id.itemId",
            itemName: "$_id.itemName",
            standard: { $ifNull: ["$_id.standard", 666] },
            count: 1,
            misfeed: 1
          }
        }
      ]).toArray();

      // Aggregation for hourly count by item (per operator)
      const hourlyAggRaw = await db.collection("count").aggregate([
        {
          $match: {
            "operator.id": { $in: operatorIds },
            timestamp: { $gte: new Date(start), $lte: new Date(end) },
          }
        },
        {
          $group: {
            _id: {
              operatorId: "$operator.id",
              itemId: "$item.id",
              itemName: "$item.name",
              hour: { $hour: "$timestamp" }
            },
            count: { $sum: 1 }
          }
        },
        {
          $group: {
            _id: { operatorId: "$_id.operatorId", itemId: "$_id.itemId", itemName: "$_id.itemName" },
            hourlyCounts: { $push: { hour: "$_id.hour", count: "$count" } },
            total: { $sum: "$count" }
          }
        },
        {
          $project: {
            operatorId: "$_id.operatorId",
            itemId: "$_id.itemId",
            itemName: "$_id.itemName",
            hourlyCounts: 1,
            total: 1
          }
        }
      ]).toArray();

      // Step 4: Process each operator's data in parallel
      const operatorResults = await Promise.all(
        Object.entries(groupedStates).map(async ([operatorId, group]) => {
          const states = group.states;

          // Skip if no states found for this operator
          if (!states.length) return null;

          // Get counts for this operator
          const counts = operatorCounts[parseInt(operatorId)];
          if (!counts) return null;

          // Process count statistics using the new utility function
          const stats = processCountStatistics(counts.counts);

          // Calculate metrics for this operator
          const totalQueryMs = new Date(end) - new Date(start);
          const {
            runtime: runtimeMs,
            pausedTime: pausedTimeMs,
            faultTime: faultTimeMs,
          } = calculateOperatorTimes(states, start, end);

          const piecesPerHour = calculatePiecesPerHour(stats.total, runtimeMs);
          const efficiency = calculateEfficiency(
            runtimeMs,
            stats.total,
            counts.validCounts
          );

          // Get current status for this operator
          const currentState = states[states.length - 1] || {};

          // Filter itemAgg and hourlyAgg for this operator
          const itemAgg = itemAggRaw.filter(row => row.operatorId === parseInt(operatorId));
          const hourlyAgg = hourlyAggRaw.filter(row => row.operatorId === parseInt(operatorId));
          // Build summaries
          const itemSummary = buildAggregatedOperatorItemSummary(itemAgg, runtimeMs);
          const countByItem = buildAggregatedOperatorCountByItem(hourlyAgg);

          // New: Add cyclePie, faultHistory, dailyEfficiency using state data
          const cyclePie = buildOptimizedOperatorCyclePie(states, start, end);
          const faultHistory = buildOptimizedOperatorFaultHistory({ [operatorId]: group }, start, end);
          const dailyEfficiency = await buildOperatorEfficiencyLine(group, start, end, db);

          // Format response for this operator
          return {
            operator: {
              id: parseInt(operatorId),
              name: group.operator.name || "Unknown",
            },
            currentStatus: {
              code: currentState.status?.code || 0,
              name: currentState.status?.name || "Unknown",
            },
            metrics: {
              runtime: {
                total: runtimeMs,
                formatted: formatDuration(runtimeMs),
              },
              pausedTime: {
                total: pausedTimeMs,
                formatted: formatDuration(pausedTimeMs),
              },
              faultTime: {
                total: faultTimeMs,
                formatted: formatDuration(faultTimeMs),
              },
              output: {
                totalCount: stats.total,
                misfeedCount: stats.misfeeds,
                validCount: stats.valid,
              },
              performance: {
                piecesPerHour: {
                  value: piecesPerHour,
                  formatted: Math.round(piecesPerHour).toString(),
                },
                efficiency: {
                  value: efficiency,
                  percentage: (efficiency * 100).toFixed(2) + "%",
                },
              },
            },
            timeRange: {
              start: start,
              end: end,
              total: formatDuration(totalQueryMs),
            },
            itemSummary,
            countByItem,
            cyclePie,
            faultHistory,
            dailyEfficiency,
          };
        })
      );

      // Filter out null results and send response
      res.json(operatorResults.filter((result) => result !== null));
    } catch (error) {
      logger.error(`Error in ${req.method} ${req.url}:`, error);
      res
        .status(500)
        .json({ error: "Failed to fetch operator performance metrics (agg)" });
    }
  });

  return router;
};
