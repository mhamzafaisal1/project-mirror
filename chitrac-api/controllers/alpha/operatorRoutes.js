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
  } = require("../../utils/time");

  const {
    fetchStatesForOperator,
    groupStatesByOperator,
    getCompletedCyclesForOperator,
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
  } = require("../../utils/operatorDashboardBuilder");

  const {
    fetchGroupedAnalyticsData
  } = require("../../utils/fetchData");

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

  //     const operatorIds = await getAllOperatorIds(db);

  //     const results = [];

  //     for (const operatorId of operatorIds) {
  //       const states = await fetchStatesForOperator(
  //         db,
  //         operatorId,
  //         paddedStart,
  //         paddedEnd
  //       );
  //       const counts = await getCountsForOperator(
  //         db,
  //         operatorId,
  //         paddedStart,
  //         paddedEnd
  //       );
  //       const validCounts = counts.filter((c) => !c.misfeed);

  //       if (!states.length && !counts.length) continue;

  //       const performance = await buildOperatorPerformance(
  //         states,
  //         counts,
  //         start,
  //         end
  //       );
  //         const itemSummary = await buildOperatorItemSummary(states, counts, start, end);
  //         const countByItem = await buildOperatorCountByItem(states, counts, start, end);
  //         const cyclePie = await buildOperatorCyclePie(states, start, end);
  //         const faultHistory = await buildOperatorFaultHistory(states, start, end);
  //         const dailyEfficiency = await buildOperatorEfficiencyLine(validCounts, states, start, end);

  //       const operatorName = await getOperatorNameFromCount(db, operatorId);

  //       results.push({
  //         operator: {
  //           id: operatorId,
  //           name: operatorName || "Unknown",
  //         },
  //         currentStatus: {
  //           code: states[states.length - 1]?.status?.code || 0,
  //           name: states[states.length - 1]?.status?.name || "Unknown",
  //         },
  //         performance,
  //         itemSummary,
  //         countByItem,
  //         cyclePie,
  //         faultHistory,
  //         dailyEfficiency
  //       });
  //     }

  //     res.json(results);
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
  
      for (const [operatorId, group] of Object.entries(groupedData)) {
        const numericOperatorId = parseInt(operatorId);
        const { states, counts } = group;
  
        if (!states.length && !counts.all.length) continue;
  
        const performance = await buildOperatorPerformance(
          states,
          counts.valid,
          counts.misfeed,
          start,
          end
        );
  
        const itemSummary = await buildOperatorItemSummary(
          states,
          counts.all,
          start,
          end,
          group.machineNames || {}
        );
        
  
        const countByItem = await buildOperatorCountByItem(group, start, end);
        const cyclePie = await buildOperatorCyclePie(group, start, end);
        const faultHistory = await buildOperatorFaultHistory(groupedData, start, end);
        const dailyEfficiency = await buildOperatorEfficiencyLine(group, start, end,db);
  
        const operatorName =
          counts.valid[0]?.operator?.name ||
          counts.all[0]?.operator?.name ||
          "Unknown";
  
        results.push({
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
        });
      }
  
      res.json(results);
    } catch (err) {
      logger.error("Error in /analytics/operator-dashboard route:", err);
      res
        .status(500)
        .json({ error: "Failed to fetch operator dashboard data" });
    }
  });
  

  return router;
};
