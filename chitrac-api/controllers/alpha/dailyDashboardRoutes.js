// 📁 dailyDashboardRoutes.js
const express = require("express");

module.exports = function (server) {
  const router = express.Router();
  const db = server.db;
  const logger = server.logger;

  const {
    buildTopOperatorEfficiency,
    buildDailyMachineStatus,
    buildMachineOEE,
    buildDailyItemHourlyStack,
    buildPlantwideMetricsByHour,
    buildDailyCountTotals
  } = require('../../utils/dailyDashboardBuilder'); 

  const {
    getAllOperatorIds,
    buildOperatorPerformance,
    buildOperatorItemSummary,
    buildOperatorCountByItem,
    buildOperatorCyclePie,
    buildOperatorFaultHistory,
    buildOperatorEfficiencyLine,
  } = require("../../utils/operatorDashboardBuilder");

  const {
    buildMachinePerformance,
    buildMachineItemSummary,
    buildItemHourlyStack,
    buildFaultData,
    buildOperatorEfficiency
  } = require("../../utils/machineDashboardBuilder");

  const {
    parseAndValidateQueryParams,
    createPaddedTimeRange,
    formatDuration
  } = require('../../utils/time');

  
  const {
    groupStatesByMachine,
    groupStatesByOperator,
    extractAllCyclesFromStates,
    extractFaultCycles,
    fetchAllStates,
    groupStatesByOperatorAndSerial,
    fetchStatesForMachine,
    getAllMachineSerials
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
    getCountsForMachine
  } = require("../../utils/count");

  const { calculateAvailability, calculateThroughput, calculateEfficiency, calculateOEE, calculatePiecesPerHour, calculateOperatorTimes } = require("../../utils/analytics");


  router.get('/analytics/daily-dashboard/full', async (req, res) => {
    try {
      const { start, end } = parseAndValidateQueryParams(req);
  
      const [
        machineStatus,
        machineOee,
        itemHourlyStack,
        topOperators,
        plantwideMetrics,
        dailyCounts
      ] = await Promise.all([
        buildDailyMachineStatus(db, start, end),
        buildMachineOEE(db, start, end),
        buildDailyItemHourlyStack(db, start, end),
        buildTopOperatorEfficiency(db, start, end),
        buildPlantwideMetricsByHour(db, start, end),
        buildDailyCountTotals(db, start, end)
      ]);
  
      return res.json({
        timeRange: { start, end, total: formatDuration(new Date(end) - new Date(start)) },
        machineStatus,
        machineOee,
        itemHourlyStack,
        topOperators,
        plantwideMetrics,
        dailyCounts
      });
    } catch (error) {
      logger.error("Error in /daily-dashboard/full:", error);
      res.status(500).json({ error: "Failed to fetch full daily dashboard data" });
    }
  });
  
  router.get('/analytics/daily-dashboard/daily-counts', async (req, res) => {
    try {
      const { start, end } = parseAndValidateQueryParams(req);
      const dailyCounts = await buildDailyCountTotals(db, start, end);
      
      return res.json({
        timeRange: { start, end, total: formatDuration(new Date(end) - new Date(start)) },
        dailyCounts
      });
    } catch (error) {
      logger.error("Error in /daily-dashboard/daily-counts:", error);
      res.status(500).json({ error: "Failed to fetch daily count totals" });
    }
  });
  
  router.get("/analytics/daily-summary-dashboard", async (req, res) => {
    try {
      const queryStartTime = Date.now();
      const { start, end, serial } = parseAndValidateQueryParams(req);
      const { paddedStart, paddedEnd } = createPaddedTimeRange(start, end);
  
      const targetSerials = serial
        ? [parseInt(serial)]
        : await getAllMachineSerials(db);
  
      // ✅ MACHINE SECTION (copied from /machine-dashboard)
      const machineResults = [];
  
      for (const machineSerial of targetSerials) {
        const states = await fetchStatesForMachine(db, machineSerial, paddedStart, paddedEnd);
        const counts = await getCountsForMachine(db, machineSerial, paddedStart, paddedEnd);
  
        if (!states.length) continue;
  
        const performance = await buildMachinePerformance(db, states, counts, start, end);
        const itemSummary = await buildMachineItemSummary(states, counts, start, end);
        const itemHourlyStack = await buildItemHourlyStack(counts, start, end);
        const faultData = await buildFaultData(states, start, end);
        const operatorEfficiency = await buildOperatorEfficiency(states, counts, start, end, machineSerial);
  
        const latestState = states[states.length - 1];
        const machineName = latestState.machine?.name || 'Unknown';
        const statusCode = latestState.status?.code || 0;
        const statusName = latestState.status?.name || 'Unknown';
  
        machineResults.push({
          machine: {
            serial: machineSerial,
            name: machineName
          },
          currentStatus: {
            code: statusCode,
            name: statusName
          },
          performance,
          itemSummary,
          itemHourlyStack,
          faultData,
          operatorEfficiency
        });
      }
  
      // // === Operators ===
      // const operatorIds = Object.keys(groupedOperatorStates).map((id) => parseInt(id));
      // const operators = [];
      
      // for (const operatorId of operatorIds) {
      //   const states = groupedOperatorStates[operatorId]?.states || [];
      //   const counts = allCounts.filter((c) => c.operator?.id === operatorId);
      //   const valid = validCounts.filter((c) => c.operator?.id === operatorId);
      
      //   if (!states.length && !counts.length) continue;
      
      //   const performance = await buildOperatorPerformance(states, counts, start, end);
      //   const countByItem = await buildOperatorCountByItem(states, counts, start, end);
      //   const cyclePie = await buildOperatorCyclePie(states, start, end);
      //   const faultHistory = await buildOperatorFaultHistory(states, start, end);
      //   const dailyEfficiency = await buildOperatorEfficiencyLine(valid, states, start, end);
      
      //   const name = await getOperatorNameFromCount(db, operatorId);
      //   const latest = states[states.length - 1] || {};
      
      //   operators.push({
      //     operator: { id: operatorId, name: name || "Unknown" },
      //     currentStatus: {
      //       code: latest.status?.code || 0,
      //       name: latest.status?.name || "Unknown",
      //     },
      //     metrics: {
      //       runtime: {
      //         total: performance.runtime,
      //         formatted: formatDuration(performance.runtime),
      //       },
      //       performance: {
      //         efficiency: {
      //           value: performance.efficiency,
      //           percentage: (performance.efficiency * 100).toFixed(2) + "%",
      //         },
      //       },
      //     },
      //     countByItem,
      //     cyclePie,
      //     faultHistory,
      //     dailyEfficiency
      //   });
      // }
      
  
      // // === Items ===
      // const groupedByItem = {};
      // for (const [serial, group] of Object.entries(groupedStatesByMachine)) {
      //   const machineValidCounts = validCounts.filter(
      //     (c) => c.machine?.serial === parseInt(serial)
      //   );
      //   const runCycles = extractAllCyclesFromStates(group.states, start, end).running;
  
      //   for (const cycle of runCycles) {
      //     const cycleCounts = machineValidCounts.filter((c) => {
      //       const ts = new Date(c.timestamp);
      //       return ts >= new Date(cycle.start) && ts <= new Date(cycle.end);
      //     });
      //     if (!cycleCounts.length) continue;
  
      //     const workedTime = new Date(cycle.end) - new Date(cycle.start);
      //     const itemGroups = groupCountsByItem(cycleCounts);
  
      //     for (const [itemId, group] of Object.entries(itemGroups)) {
      //       const item = group[0]?.item || {};
      //       const standard = item.standard > 0 ? item.standard : 666;
  
      //       if (!groupedByItem[itemId]) {
      //         groupedByItem[itemId] = {
      //           itemName: item.name || "Unknown",
      //           standard,
      //           count: 0,
      //           workedTimeMs: 0,
      //         };
      //       }
  
      //       groupedByItem[itemId].count += group.length;
      //       groupedByItem[itemId].workedTimeMs += workedTime;
      //     }
      //   }
      // }
  
      // const items = Object.values(groupedByItem).map((entry) => {
      //   const hours = entry.workedTimeMs / 3600000;
      //   const pph = hours > 0 ? entry.count / hours : 0;
      //   const efficiency = entry.standard > 0 ? pph / entry.standard : 0;
      //   return {
      //     itemName: entry.itemName,
      //     workedTimeFormatted: formatDuration(entry.workedTimeMs),
      //     count: entry.count,
      //     pph: Math.round(pph * 100) / 100,
      //     standard: entry.standard,
      //     efficiency: Math.round(efficiency * 10000) / 100,
      //   };
      // });
  
      res.json({
        timeRange: { start, end, total: formatDuration(Date.now() - queryStartTime) },
        machineResults,
        // operators,
        // items,
      });
    } catch (error) {
      logger.error("Error in /analytics/daily-summary-dashboard:", error);
      res.status(500).json({ error: "Failed to generate daily summary dashboard" });
    }
  });
  
  

  return router;

}