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

  return router;

}