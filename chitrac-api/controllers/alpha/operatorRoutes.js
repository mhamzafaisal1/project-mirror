// 📁 operatorRoutes.js
const express = require("express");

module.exports = function (server) {
  const router = express.Router();
  const db = server.db;
  const logger = server.logger;

const {
  parseAndValidateQueryParams,
  createPaddedTimeRange,
  formatDuration
} = require('../../utils/time');

const {
  buildTopOperatorEfficiency
} = require('../../utils/dailyDashboardBuilder');


router.get("/daily-dashboard/operator-efficiency-top10", async (req, res) => {
    try {
      const { start, end } = parseAndValidateQueryParams(req);
      const operators = await buildTopOperatorEfficiency(db, start, end);
  
      res.json({
        timeRange: {
          start,
          end,
          total: formatDuration(new Date(end) - new Date(start))
        },
        operators
      });
    } catch (err) {
      logger.error("Error in /daily-dashboard/operator-efficiency-top10:", err);
      res.status(500).json({ error: "Failed to fetch top operator efficiencies" });
    }
  });
  
  

  return router;
}