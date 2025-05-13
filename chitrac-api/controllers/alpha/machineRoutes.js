const express = require("express");

module.exports = function (server) {
  const router = express.Router();
  const db = server.db;
  const logger = server.logger;

  // Utility imports
  const {
    parseAndValidateQueryParams,
    createPaddedTimeRange,
    formatDuration,
  } = require("../../utils/time");

  // State + Count imports
  const {
    fetchStatesForMachine,
    getAllMachineSerials
  } = require("../../utils/state");

  const {
    getCountsForMachine
  } = require("../../utils/count");

  // Dashboard Builders
  const {
    buildMachinePerformance,
    buildMachineItemSummary,
    buildItemHourlyStack,
    buildFaultData,
    buildOperatorEfficiency
  } = require("../../utils/machineDashboardBuilder");

  router.get("/machine-dashboard", async (req, res) => {
    try {
      const { start, end, serial } = parseAndValidateQueryParams(req);
      const { paddedStart, paddedEnd } = createPaddedTimeRange(start, end);

      const targetSerials = serial
        ? [parseInt(serial)]
        : await getAllMachineSerials(db);

      const results = [];

      for (const machineSerial of targetSerials) {
        const states = await fetchStatesForMachine(db, machineSerial, paddedStart, paddedEnd);
        const counts = await getCountsForMachine(db, machineSerial, paddedStart, paddedEnd);

        if (!states.length) continue;

        const performance = await buildMachinePerformance(db, states, counts, start, end);
        const itemSummary = await buildMachineItemSummary(states, counts, start, end);
        const itemHourlyStack = await buildItemHourlyStack(counts, start, end);
        const faultData = await buildFaultData(states, start, end);
        const operatorEfficiency = await buildOperatorEfficiency(states, counts, start, end);

        const latestState = states[states.length - 1];
        const machineName = latestState.machine?.name || "Unknown";
        const statusCode = latestState.status?.code || 0;
        const statusName = latestState.status?.name || "Unknown";

        results.push({
          machine: {
            serial: machineSerial,
            name: machineName,
          },
          currentStatus: {
            code: statusCode,
            name: statusName,
          },
          performance,
          itemSummary,
          itemHourlyStack,
          faultData,
          operatorEfficiency
        });
      }

      res.json(results);
    } catch (err) {
      logger.error("Error in /machine-dashboard route:", err);
      res.status(500).json({ error: "Failed to fetch dashboard data" });
    }
  });

  return router;
};
