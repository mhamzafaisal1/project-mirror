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
    getAllMachineSerials,
    groupStatesByMachine,
    extractAllCyclesFromStates,
    getAllMachinesFromStates
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

  const {
    buildMachineOEE,
    buildDailyItemHourlyStack
  } = require("../../utils/dailyDashboardBuilder");

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


  router.get("/daily-dashboard/machine-status", async (req, res) => {
  try {
    const { start, end, serial } = parseAndValidateQueryParams(req);
    const { paddedStart, paddedEnd } = createPaddedTimeRange(start, end);

    let machines;
    if (serial) {
      machines = [{ serial: parseInt(serial) }];
    } else {
      machines = await getAllMachinesFromStates(db, paddedStart, paddedEnd);
    }

    const results = [];

    for (const machine of machines) {
      const states = await fetchStatesForMachine(
        db,
        machine.serial,
        paddedStart,
        paddedEnd
      );

      if (!states.length) continue;

      const cycles = extractAllCyclesFromStates(states, start, end);
      const runningMs = cycles.running.reduce((sum, c) => sum + c.duration, 0);
      const pausedMs = cycles.paused.reduce((sum, c) => sum + c.duration, 0);
      const faultedMs = cycles.fault.reduce((sum, c) => sum + c.duration, 0);

      results.push({
        serial: machine.serial,
        name: states[0].machine?.name || "Unknown",
        runningMs,
        pausedMs,
        faultedMs,
      });
    }

    res.json(results);
  } catch (error) {
    logger.error("Error calculating daily stacked bar data:", error);
    res.status(500).json({ error: "Failed to fetch daily stacked bar data" });
  }
});

router.get("/daily-dashboard/machine-oee", async (req, res) => {
  try {
    const { start, end } = parseAndValidateQueryParams(req);
    const results = await buildMachineOEE(db, start, end);
    res.json(results);
  } catch (err) {
    logger.error("OEE fetch error:", err);
    res.status(500).json({ error: "Failed to calculate machine OEE%" });
  }
});

router.get("/daily-dashboard/item-hourly-stack", async (req, res) => {
  try {
    const { start, end } = parseAndValidateQueryParams(req);
    const result = await buildDailyItemHourlyStack(db, start, end);
    res.json(result);
  } catch (err) {
    logger.error("Error in /analytics/daily-dashboard/item-hourly-stack:", err);
    res.status(500).json({ error: "Failed to build item/hour stacked data" });
  }
});
  
  

  

  return router;
};
