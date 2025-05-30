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
    getAllMachinesFromStates,
    getAllMachineSerialsAndNames
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
    buildDailyItemHourlyStack,
    buildPlantwideMetricsByHour
  } = require("../../utils/dailyDashboardBuilder");

  const {
    fetchGroupedAnalyticsData
  } = require("../../utils/fetchData");


  
  // router.get("/machine-dashboard", async (req, res) => {
  //   try {
  //     const { start, end, serial } = parseAndValidateQueryParams(req);
  //     const { paddedStart, paddedEnd } = createPaddedTimeRange(start, end);
  
  //     const serialNamePairs = serial
  // ? [parseInt(serial)]
  // : await getAllMachineSerialsAndNames(db, paddedStart, paddedEnd);

  
  // const results = [];

  // for (const { serial: machineSerial, name: machineName } of serialNamePairs) {
  //   const states = await fetchStatesForMachine(db, machineSerial, paddedStart, paddedEnd);
  //   const counts = await getCountsForMachine(db, machineSerial, paddedStart, paddedEnd);
  
  //   if (!states.length) continue;
  
  //   const performance = await buildMachinePerformance(db, states, counts, start, end);
  //   const itemSummary = await buildMachineItemSummary(states, counts, start, end);
  //   const itemHourlyStack = await buildItemHourlyStack(counts, start, end);
  //   const faultData = await buildFaultData(states, start, end);
  //   const operatorEfficiency = await buildOperatorEfficiency(states, counts, start, end, machineSerial);
  
  //   const latestState = states[states.length - 1];
  //   const statusCode = latestState.status?.code || 0;
  //   const statusName = latestState.status?.name || "Unknown";
  
  //   results.push({
  //     machine: {
  //       serial: machineSerial,
  //       name: machineName,
  //     },
  //     currentStatus: {
  //       code: statusCode,
  //       name: statusName,
  //     },
  //     performance,
  //     itemSummary,
  //     itemHourlyStack,
  //     faultData,
  //     operatorEfficiency
  //   });
  // }
  
  
  //     res.json(results);
  //   } catch (err) {
  //     logger.error("Error in /machine-dashboard route:", err);
  //     res.status(500).json({ error: "Failed to fetch dashboard data" });
  //   }
  // });
  

  
  router.get("/machine-dashboard", async (req, res) => {
    try {
      const { start, end, serial } = parseAndValidateQueryParams(req);
      const { paddedStart, paddedEnd } = createPaddedTimeRange(start, end);
  
      const targetSerials = serial ? [serial] : [];

      const groupedData = await fetchGroupedAnalyticsData(
        db,
        paddedStart,
        paddedEnd,
        "machine",
        { targetSerials }
      );
      

  
      const results = [];

      for (const [serial, group] of Object.entries(groupedData)) {
        const machineSerial = parseInt(serial);
        const { states, counts } = group;
  
        if (!states.length) continue;
  
        // ✅ Compute performance using pre-filtered counts
        const performance = await buildMachinePerformance(
          states,
          counts.valid,
          counts.misfeed,
          start,
          end
        );
        const itemSummary = buildMachineItemSummary(states, counts.valid, start, end);
        const itemHourlyStack = buildItemHourlyStack(counts.valid, start, end);
        const faultData = buildFaultData(states, start, end);
        const operatorEfficiency = await buildOperatorEfficiency(states, counts.valid, start, end, parseInt(serial));
  
        const latestState = states[states.length - 1];
        const statusCode = latestState.status?.code || 0;
        const statusName = latestState.status?.name || "Unknown";
        const machineName = latestState.machine?.name || "Unknown";
  
        results.push({
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

  //API route for plantwide metrics by hour start
  router.get("/daily-dashboard/plantwide-metrics-by-hour", async (req, res) => {
    try {
      const { start, end } = parseAndValidateQueryParams(req);
      const { paddedStart, paddedEnd } = createPaddedTimeRange(start, end);

      const hourlyMetrics = await buildPlantwideMetricsByHour(db, paddedStart, paddedEnd);

      // Format the response for the chart
      const response = {
        title: "Plantwide Metrics by Hour",
        data: {
          hours: hourlyMetrics.map(m => m.hour),
          series: {
            Availability: hourlyMetrics.map(m => Math.round(m.availability * 100) / 100),
            Efficiency: hourlyMetrics.map(m => Math.round(m.efficiency * 100) / 100),
            Throughput: hourlyMetrics.map(m => Math.round(m.throughput * 100) / 100),
            OEE: hourlyMetrics.map(m => Math.round(m.oee * 100) / 100)
          }
        },
        timeRange: {
          start: start,
          end: end,
          total: formatDuration(new Date(end) - new Date(start))
        }
      };

      res.json(response);
    } catch (err) {
      logger.error("Error in /analytics/plantwide-metrics-by-hour:", err);
      res.status(500).json({ error: "Failed to generate plantwide metrics by hour" });
    }
  });
  //API route for plantwide metrics by hour end
  
  

  

  return router;
};
