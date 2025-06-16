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
    buildOptimizedOperatorFaultHistory
  } = require("../../utils/operatorDashboardBuilder");

  const {
    fetchGroupedAnalyticsData
  } = require("../../utils/fetchData");

  const { getBookendedOperatorStatesAndTimeRange } = require('../../utils/bookendingBuilder');

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
  
  //         // Preprocess once and reuse
  //         const validCounts = counts.valid;
  //         const misfeedCounts = counts.misfeed;
  //         const allCounts = counts.all;
  
  //         const { faultCycles } = extractFaultCycles(states, start, end);
  //         const { running: runCycles } = extractAllCyclesFromStates(states, start, end);
  
  //         const [
  //           performance,
  //           itemSummary,
  //           countByItem,
  //           cyclePie,
  //           faultHistory,
  //           dailyEfficiency
  //         ] = await Promise.all([
  //           buildOperatorPerformance(states, validCounts, misfeedCounts, start, end),
  //           buildOptimizedOperatorItemSummary(states, allCounts, start, end, group.machineNames || {}),
  //           buildOptimizedOperatorCountByItem(allCounts, start, end),
  //           buildOptimizedOperatorCyclePie(group.states, start, end),
  //           buildOptimizedOperatorFaultHistory({ [operatorId]: group }, start, end),
  //           buildOperatorEfficiencyLine(group, start, end, db)
  //         ]);
  
  //         const operatorName =
  //           validCounts[0]?.operator?.name ||
  //           allCounts[0]?.operator?.name ||
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
  
  //     res.json(results.filter(r => r !== null));
  
  //   } catch (err) {
  //     logger.error("Error in /analytics/operator-dashboard route:", err);
  //     res.status(500).json({ error: "Failed to fetch operator dashboard data" });
  //   }
  // });

  //Universal bookending implementation 

  

  router.get("/analytics/operator-dashboard", async (req, res) => {
    try {
      const { start, end } = parseAndValidateQueryParams(req);
  
      const groupedData = await fetchGroupedAnalyticsData(
        db,
        start,
        end,
        "operator"
      );
  
      const results = await Promise.all(
        Object.entries(groupedData).map(async ([operatorId, group]) => {
          const numericOperatorId = parseInt(operatorId);
          const { states: rawStates, counts } = group;
  
          if (!rawStates.length && !counts.all.length) return null;
  
          const validCounts = counts.valid;
          const misfeedCounts = counts.misfeed;
          const allCounts = counts.all;
  
          // ✅ Use your proper utility for operator-level bookending
          const bookended = await getBookendedOperatorStatesAndTimeRange(
            db,
            numericOperatorId,
            start,
            end
          );
  
          if (!bookended) return null;
  
          const { states: bookendedStates, sessionStart, sessionEnd } = bookended;
  
          const operatorName =
            validCounts[0]?.operator?.name ||
            allCounts[0]?.operator?.name ||
            "Unknown";
  
          const [
            performance,
            itemSummary,
            countByItem,
            cyclePie,
            faultHistory,
            dailyEfficiency
          ] = await Promise.all([
            buildOperatorPerformance(bookendedStates, validCounts, misfeedCounts, sessionStart, sessionEnd),
            buildOptimizedOperatorItemSummary(bookendedStates, allCounts, sessionStart, sessionEnd, group.machineNames || {}),
            buildOptimizedOperatorCountByItem(allCounts, sessionStart, sessionEnd),
            buildOptimizedOperatorCyclePie(bookendedStates, sessionStart, sessionEnd),
            buildOptimizedOperatorFaultHistory({ [operatorId]: { states: bookendedStates, counts } }, sessionStart, sessionEnd),
            buildOperatorEfficiencyLine({
              operator: { id: numericOperatorId, name: operatorName },
              counts
            }, sessionStart, sessionEnd, db)
          ]);
  
          return {
            operator: {
              id: numericOperatorId,
              name: operatorName,
            },
            currentStatus: {
              code: bookendedStates.at(-1)?.status?.code || 0,
              name: bookendedStates.at(-1)?.status?.name || "Unknown",
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
  
      res.json(results.filter(Boolean));
    } catch (err) {
      logger.error("Error in /analytics/operator-dashboard route:", err);
      res.status(500).json({ error: "Failed to fetch operator dashboard data" });
    }
  });
  

  

  return router;
};
