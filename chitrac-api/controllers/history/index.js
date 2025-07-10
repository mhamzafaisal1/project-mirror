/*** histories API controller */
/*** Contributors: RTI II */

/** MODULE REQUIRES */
const express = require("express");
const router = express.Router();

const {
  parseAndValidateQueryParams,
  createPaddedTimeRange
} = require("../../utils/time");

const {
  fetchStatesForMachine,
  extractFaultCycles
} = require("../../utils/state");

module.exports = function (server) {
  return constructor(server);
};

function constructor(server) {
  const db = server.db;
  const logger = server.logger;

  //API Route for operator count by item end

  // API route for machine fault history start
  router.get("/machine/faults", async (req, res) => {
    try {
      const { start, end, serial } = parseAndValidateQueryParams(req);
      let { paddedStart, paddedEnd } = createPaddedTimeRange(start, end);

      if (!serial) {
        return res.status(400).json({ error: "Machine serial is required" });
      }

      // Prevent future timestamps by clamping to current time
      const now = new Date();
      if (paddedEnd > now) {
        logger.warn(`Query end time ${paddedEnd} is in the future, clamping to current time`);
        paddedEnd = now;
      }

      // Fetch states for the specified machine
      const states = await fetchStatesForMachine(
        db,
        serial,
        paddedStart,
        paddedEnd
      );

      if (!states.length) {
        return res.json({ faultCycles: [], faultSummaries: [] });
      }

      // Extract fault cycles using the padded time range to get complete cycles
      const { faultCycles, faultSummaries } = extractFaultCycles(
        states,
        paddedStart,
        paddedEnd
      );

      // Filter fault cycles to only include those that overlap with the original query range
      const filteredFaultCycles = faultCycles.filter(cycle => {
        const cycleStart = new Date(cycle.start);
        const cycleEnd = new Date(cycle.end);
        const queryStart = new Date(start);
        const queryEnd = new Date(end);
        
        // Include cycles that overlap with the query range
        return cycleStart < queryEnd && cycleEnd > queryStart;
      });

      res.json({
        faultCycles: filteredFaultCycles,
        faultSummaries,
      });
    } catch (err) {
      logger.error(`Error in ${req.method} ${req.originalUrl}:`, err);
      res.status(500).json({ error: "Failed to fetch fault history" });
    }
  });

  return router;
}