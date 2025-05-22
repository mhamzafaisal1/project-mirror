const express = require("express");

const {
  parseAndValidateQueryParams,
  createPaddedTimeRange,
  formatDuration,
} = require("../../utils/time");

const {
  fetchStatesForOperator,
  groupStatesByOperator,
  getCompletedCyclesForOperator,
  groupStatesByOperatorAndSerial,
} = require("../../utils/state");

const {
  getCountsForOperator,
  getValidCountsForOperator,
  getOperatorNameFromCount,
  processCountStatistics,
  groupCountsByOperatorAndMachine,
  getCountsForOperatorMachinePairs,
} = require("../../utils/count");

const { buildSoftrolCycleSummary } = require("../../utils/miscFunctions");

module.exports = function (server) {
  const router = express.Router();
  const db = server.db;
  const logger = server.logger;

  router.get("/softrol/get-softrol-data", async (req, res) => {
    try {
      // Use centralized time parser
      const { start, end } = parseAndValidateQueryParams(req);
      const { paddedStart, paddedEnd } = createPaddedTimeRange(start, end);

      // 1. Fetch and group states by operator and machine
      const allStates = await fetchStatesForOperator(
        db,
        null,
        paddedStart,
        paddedEnd
      );
      const groupedStates = groupStatesByOperatorAndSerial(allStates);

      // 2. Process completed cycles for each group
      const completedCyclesByGroup = {};
      for (const [key, group] of Object.entries(groupedStates)) {
        const completedCycles = getCompletedCyclesForOperator(group.states);
        if (completedCycles.length > 0) {
          completedCyclesByGroup[key] = { ...group, completedCycles };
        }
      }

      // 3. Get operator-machine pairs for count lookup
      const operatorMachinePairs = Object.keys(completedCyclesByGroup).map(
        (key) => {
          const [operatorId, machineSerial] = key.split("-");
          return {
            operatorId: parseInt(operatorId),
            machineSerial: parseInt(machineSerial),
          };
        }
      );

      // 4. Fetch and group counts
      const allCounts = await getCountsForOperatorMachinePairs(
        db,
        operatorMachinePairs,
        start,
        end
      );
      const groupedCounts = groupCountsByOperatorAndMachine(allCounts);

      // 5. Process each group's cycles and counts
      const results = [];
      for (const [key, group] of Object.entries(completedCyclesByGroup)) {
        const [operatorId, machineSerial] = key.split("-");
        const countGroup = groupedCounts[`${operatorId}-${machineSerial}`];
        if (!countGroup) continue;

        // Sort counts by timestamp for efficient processing
        const sortedCounts = countGroup.counts.sort(
          (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
        );

        // Process each cycle
        for (const cycle of group.completedCycles) {
          const summary = buildSoftrolCycleSummary(
            cycle,
            sortedCounts,
            countGroup
          );
          
          if (summary) {
            results.push({
              operatorId: parseInt(operatorId),
              machineSerial: parseInt(machineSerial),
              ...summary
            });
          }
        }
      }

      res.json(results);
    } catch (err) {
      logger.error("Error in /softrol/get-softrol-data:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });
  // Softrol Route end

  return router;
};
