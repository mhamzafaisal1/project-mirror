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
    getAllMachineSerials,
    fetchStatesForOperator
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
      : await getAllMachineSerials(db, paddedStart, paddedEnd);
    
  
      // ✅ MACHINE SECTION (copied from /machine-dashboard)
      const machineResults = [];
  
      for (const machineSerial of targetSerials) {
        const states = await fetchStatesForMachine(db, machineSerial, paddedStart, paddedEnd);
        const counts = await getCountsForMachine(db, machineSerial, paddedStart, paddedEnd);
  
        if (!states.length) continue;
  
        const performance = await buildMachinePerformance(db, states, counts, start, end);
        const itemSummary =  buildMachineItemSummary(states, counts, start, end);
        const itemHourlyStack =  buildItemHourlyStack(counts, start, end);
        const faultData = buildFaultData(states, start, end);
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
  
      // === Operators ===
      const operatorIds = await getAllOperatorIds(db); // Get unique operator IDs
      const operators = [];
      const operatorResults = [];

      for (const operatorId of operatorIds) {
        const states = await fetchStatesForOperator(db, operatorId, paddedStart, paddedEnd);
        const counts = await getCountsForOperator(db, operatorId, paddedStart, paddedEnd);
        const valid = counts.filter((c) => !c.misfeed);

        if (!states.length && !counts.length) continue;

        const performance = await buildOperatorPerformance(states, counts, start, end);
        const countByItem = await buildOperatorCountByItem(states, counts, start, end);

        const name = await getOperatorNameFromCount(db, operatorId);
        const latest = states[states.length - 1] || {};

        operatorResults.push({
          operator: { id: operatorId, name: name || "Unknown" },
          currentStatus: {
            code: latest.status?.code || 0,
            name: latest.status?.name || "Unknown",
          },
          metrics: {
            runtime: {
              total: performance.runtime.total,
              formatted: performance.runtime.formatted
            },
            performance: {
              efficiency: {
                value: performance.performance.efficiency.value,
                percentage: performance.performance.efficiency.percentage
              }
            }
          },
          countByItem
        });
      }
  
      // === Items ===
      const items = [];
      for (const machineResult of machineResults) {
        const machineSerial = machineResult.machine.serial;
        const machineStates = await fetchStatesForMachine(db, machineSerial, paddedStart, paddedEnd);
        const machineCounts = await getCountsForMachine(db, machineSerial, paddedStart, paddedEnd);
        const runCycles = extractAllCyclesFromStates(machineStates, start, end).running;

        const machineSummary = {
          totalCount: 0,
          totalWorkedMs: 0,
          itemSummaries: {}
        };

        for (const cycle of runCycles) {
          const cycleStart = new Date(cycle.start);
          const cycleEnd = new Date(cycle.end);
          const cycleMs = cycleEnd - cycleStart;

          const cycleCounts = machineCounts.filter(c => {
            const ts = new Date(c.timestamp);
            return ts >= cycleStart && ts <= cycleEnd;
          });

          if (!cycleCounts.length) continue;

          const operators = new Set(cycleCounts.map(c => c.operator?.id).filter(Boolean));
          const workedTimeMs = cycleMs * Math.max(1, operators.size);

          const itemGroups = groupCountsByItem(cycleCounts);

          for (const [itemId, group] of Object.entries(itemGroups)) {
            const countTotal = group.length;
            const standard = group[0].item?.standard > 0 ? group[0].item.standard : 666;
            const name = group[0].item?.name || "Unknown";

            if (!machineSummary.itemSummaries[itemId]) {
              machineSummary.itemSummaries[itemId] = {
                count: 0,
                standard,
                workedTimeMs: 0,
                name
              };
            }

            machineSummary.itemSummaries[itemId].count += countTotal;
            machineSummary.itemSummaries[itemId].workedTimeMs += workedTimeMs;
            machineSummary.totalCount += countTotal;
            machineSummary.totalWorkedMs += workedTimeMs;
          }
        }

        // Add per-item formatted metrics
        Object.entries(machineSummary.itemSummaries).forEach(([itemId, summary]) => {
          const workedTimeFormatted = formatDuration(summary.workedTimeMs);
          const totalHours = summary.workedTimeMs / 3600000;
          const pph = totalHours > 0 ? summary.count / totalHours : 0;
          const efficiency = summary.standard > 0 ? pph / summary.standard : 0;

          items.push({
            itemName: summary.name,
            workedTimeFormatted,
            count: summary.count,
            pph: Math.round(pph * 100) / 100,
            standard: summary.standard,
            efficiency: Math.round(efficiency * 10000) / 100
          });
        });
      }
  
      res.json({
        timeRange: { start, end, total: formatDuration(Date.now() - queryStartTime) },
        machineResults,
        operatorResults,
        items
      });
    } catch (error) {
      logger.error("Error in /analytics/daily-summary-dashboard:", error);
      res.status(500).json({ error: "Failed to generate daily summary dashboard" });
    }
  });
  
  

  return router;

}