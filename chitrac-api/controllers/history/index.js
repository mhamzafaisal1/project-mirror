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
      const { paddedStart, paddedEnd } = createPaddedTimeRange(start, end);

      if (!serial) {
        return res.status(400).json({ error: "Machine serial is required" });
      }

      // Fetch states for the specified machine
      const states = await fetchStatesForMachine(
        db,
        serial,
        paddedStart,
        paddedEnd
      );

      if (!states.length) {
        return res.json({ faultCycles: [], faultSummary: [] });
      }

      // Extract fault cycles
      const { faultCycles, faultSummaries } = extractFaultCycles(
        states,
        start,
        end
      );

      res.json({
        faultCycles,
        faultSummaries,
      });
    } catch (err) {
      logger.error("Error in /history/machine/faults:", err);
      res.status(500).json({ error: "Failed to fetch fault history" });
    }
  });

  return router;
}