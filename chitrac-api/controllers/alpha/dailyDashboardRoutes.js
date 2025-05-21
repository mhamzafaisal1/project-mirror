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
      const { start, end } = parseAndValidateQueryParams(req);
      const { paddedStart, paddedEnd } = createPaddedTimeRange(start, end);
      const totalQueryMs = new Date(end) - new Date(start);
  
      // === Fetch all states and counts once ===
      const [allStates, allCounts] = await Promise.all([
        db.collection("state")
          .find({
            timestamp: { $gte: paddedStart, $lte: paddedEnd },
            "machine.serial": { $exists: true },
            "status.code": { $exists: true },
          })
          .sort({ timestamp: 1 })
          .toArray(),
  
        db.collection("count")
          .find({
            timestamp: { $gte: new Date(start), $lte: new Date(end) },
            "operator.id": { $exists: true, $ne: -1 },
          })
          .sort({ timestamp: 1 })
          .toArray(),
      ]);
  
      const validCounts = allCounts.filter((c) => !c.misfeed);
      const misfeedCounts = allCounts.filter((c) => c.misfeed);
  
      const groupedMachineStates = groupStatesByMachine(allStates);
      const groupedOperatorStates = groupStatesByOperator(allStates);
      const groupedStatesByMachine = groupStatesByMachine(allStates);
  
      // === Machines ===
      const machines = Object.entries(groupedMachineStates).map(
        ([serial, group]) => {
          const name = group.machine?.name || "Unknown";
          const serialNum = parseInt(serial);
          const states = group.states;
          const latest = states[states.length - 1] || {};
  
          const cycles = extractAllCyclesFromStates(states, start, end).running;
          const runtimeMs = cycles.reduce((sum, c) => sum + c.duration, 0);
          const downtimeMs = totalQueryMs - runtimeMs;
  
          const machineValid = validCounts.filter(
            (c) => c.machine?.serial === serialNum
          );
          const machineMisfeeds = misfeedCounts.filter(
            (c) => c.machine?.serial === serialNum
          );
          const totalCount = machineValid.length + machineMisfeeds.length;
  
          const availability = calculateAvailability(
            runtimeMs,
            downtimeMs,
            totalQueryMs
          );
          const throughput = calculateThroughput(totalCount, machineMisfeeds.length);
          const efficiency = calculateEfficiency(runtimeMs, totalCount, machineValid);
          const oee = calculateOEE(availability, efficiency, throughput);
  
          return {
            machine: { name, serial: serialNum },
            currentStatus: {
              code: latest.status?.code || 0,
              name: latest.status?.name || "Unknown",
            },
            metrics: {
              runtime: { total: runtimeMs, formatted: formatDuration(runtimeMs) },
              downtime: {
                total: downtimeMs,
                formatted: formatDuration(downtimeMs),
              },
              output: {
                totalCount,
                misfeedCount: machineMisfeeds.length,
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
                oee: { value: oee, percentage: (oee * 100).toFixed(2) + "%" },
              },
            },
            timeRange: { start, end, total: formatDuration(totalQueryMs) },
          };
        }
      );
  
      // === Operators ===
      const operatorCounts = groupCountsByOperator(allCounts);
      const operators = Object.entries(groupedOperatorStates).map(
        ([id, group]) => {
          const operatorId = parseInt(id);
          const name = group.operator?.name || "Unknown";
          const states = group.states;
          const counts = operatorCounts[operatorId] || [];
          const stats = processCountStatistics(counts);
  
          const { runtime, pausedTime, faultTime } = calculateOperatorTimes(
            states,
            start,
            end
          );
          const pph = calculatePiecesPerHour(stats.total, runtime);
          const efficiency = calculateEfficiency(runtime, stats.total, stats.validCounts);
  
          const latest = states[states.length - 1] || {};
  
          return {
            operator: { id: operatorId, name },
            currentStatus: {
              code: latest.status?.code || 0,
              name: latest.status?.name || "Unknown",
            },
            metrics: {
              runtime: { total: runtime, formatted: formatDuration(runtime) },
              pausedTime: {
                total: pausedTime,
                formatted: formatDuration(pausedTime),
              },
              faultTime: {
                total: faultTime,
                formatted: formatDuration(faultTime),
              },
              output: {
                totalCount: stats.total,
                misfeedCount: stats.misfeeds,
                validCount: stats.valid,
              },
              performance: {
                piecesPerHour: {
                  value: pph,
                  formatted: Math.round(pph).toString(),
                },
                efficiency: {
                  value: efficiency,
                  percentage: (efficiency * 100).toFixed(2) + "%",
                },
              },
            },
            timeRange: { start, end, total: formatDuration(totalQueryMs) },
          };
        }
      );
  
      // === Items ===
      const groupedByItem = {};
      for (const [serial, group] of Object.entries(groupedStatesByMachine)) {
        const machineValidCounts = validCounts.filter(
          (c) => c.machine?.serial === parseInt(serial)
        );
        const runCycles = extractAllCyclesFromStates(group.states, start, end).running;
  
        for (const cycle of runCycles) {
          const cycleCounts = machineValidCounts.filter((c) => {
            const ts = new Date(c.timestamp);
            return ts >= new Date(cycle.start) && ts <= new Date(cycle.end);
          });
          if (!cycleCounts.length) continue;
  
          const workedTime = new Date(cycle.end) - new Date(cycle.start);
          const itemGroups = groupCountsByItem(cycleCounts);
  
          for (const [itemId, group] of Object.entries(itemGroups)) {
            const item = group[0]?.item || {};
            const standard = item.standard > 0 ? item.standard : 666;
  
            if (!groupedByItem[itemId]) {
              groupedByItem[itemId] = {
                itemName: item.name || "Unknown",
                standard,
                count: 0,
                workedTimeMs: 0,
              };
            }
  
            groupedByItem[itemId].count += group.length;
            groupedByItem[itemId].workedTimeMs += workedTime;
          }
        }
      }
  
      const items = Object.values(groupedByItem).map((entry) => {
        const hours = entry.workedTimeMs / 3600000;
        const pph = hours > 0 ? entry.count / hours : 0;
        const efficiency = entry.standard > 0 ? pph / entry.standard : 0;
        return {
          itemName: entry.itemName,
          workedTimeFormatted: formatDuration(entry.workedTimeMs),
          count: entry.count,
          pph: Math.round(pph * 100) / 100,
          standard: entry.standard,
          efficiency: Math.round(efficiency * 10000) / 100,
        };
      });
  
      res.json({
        timeRange: { start, end, total: formatDuration(totalQueryMs) },
        machines,
        operators,
        items,
      });
    } catch (error) {
      logger.error("Error in /analytics/daily-summary-dashboard:", error);
      res.status(500).json({ error: "Failed to generate daily summary dashboard" });
    }
  });
  
  

  return router;

}