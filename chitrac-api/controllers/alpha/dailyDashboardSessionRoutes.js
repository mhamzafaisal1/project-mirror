// routes/analytics/daily-dashboard.js  (or wherever your route lives)
const express = require("express");
const { DateTime } = require("luxon");
const config = require("../../modules/config");
const { formatDuration } = require("../../utils/time"); 
const {
  buildDailyItemHourlyStack,
  buildPlantwideMetricsByHour,
  buildDailyCountTotals,
} = require("../../utils/dailyDashboardBuilder");

module.exports = function (server) {
  const router = express.Router();
  const db = server.db;
  const logger = server.logger;

  // ---- helpers (local) ----
  const safe = n => (typeof n === "number" && isFinite(n) ? n : 0);
  const overlap = (sStart, sEnd, wStart, wEnd) => {
    const ss = new Date(sStart); const se = new Date(sEnd || wEnd);
    const os = ss > wStart ? ss : wStart;
    const oe = se < wEnd ? se : wEnd;
    const ovSec = Math.max(0, (oe - os) / 1000);
    const fullSec = Math.max(0, (se - ss) / 1000);
    const f = fullSec > 0 ? ovSec / fullSec : 0;
    return { ovSec, fullSec, factor: f };
  };

  // #1 DailyMachineStackedBarChartComponent (runtime + faulttime -> downtime)
  async function buildDailyMachineStatusFromSessions(db, dayStart, dayEnd) {
    const msColl = db.collection(config.machineSessionCollectionName);
    const fsColl = db.collection(config.faultSessionCollectionName);

    // machines that actually have sessions today
    const serials = await msColl.distinct("machine.serial", {
      "timestamps.start": { $lt: dayEnd },
      $or: [{ "timestamps.end": { $gt: dayStart } }, { "timestamps.end": { $exists: false } }, { "timestamps.end": null }],
    });

    const perMachine = await Promise.all(serials.map(async (serial) => {
      const [msessions, fsessions] = await Promise.all([
        msColl.find({
          "machine.serial": serial,
          "timestamps.start": { $lt: dayEnd },
          $or: [{ "timestamps.end": { $gt: dayStart } }, { "timestamps.end": { $exists: false } }, { "timestamps.end": null }],
        }).project({
          _id: 0, machine: 1, timestamps: 1,
          runtime: 1, workTime: 1, totalTimeCredit: 1, totalCount: 1, misfeedCount: 1
        }).toArray(),
        fsColl.find({
          "machine.serial": serial,
          "timestamps.start": { $lt: dayEnd },
          $or: [{ "timestamps.end": { $gt: dayStart } }, { "timestamps.end": { $exists: false } }, { "timestamps.end": null }],
        }).project({ _id: 0, timestamps: 1, faulttime: 1 }).toArray()
      ]);

      let runtimeSec = 0;
      for (const s of msessions) {
        const { factor } = overlap(s.timestamps?.start, s.timestamps?.end, dayStart, dayEnd);
        runtimeSec += safe(s.runtime) * factor; // runtime is stored in seconds (from simulator stats)
      }

      let faultSec = 0;
      for (const fs of fsessions) {
        const sStart = fs.timestamps?.start;
        const sEnd = fs.timestamps?.end || dayEnd;
        const { ovSec, fullSec } = overlap(sStart, sEnd, dayStart, dayEnd);
        if (ovSec === 0) continue;
        const ft = safe(fs.faulttime);
        if (ft > 0 && fullSec > 0) {
          const factor = ovSec / fullSec;
          faultSec += ft * factor;
        } else {
          // open/unfinished or unrecalculated fault-session → use overlap duration
          faultSec += ovSec;
        }
      }

      const windowMs = dayEnd - dayStart;
      const runningMs = Math.round(runtimeSec * 1000);
      const faultedMs = Math.round(faultSec * 1000);
      const downtimeMs = Math.max(0, windowMs - (runningMs + faultedMs));

      return {
        serial,
        name: msessions[0]?.machine?.name || `Serial ${serial}`,
        runningMs,
        // UI expects pausedMs; map computed downtime to pausedMs for compatibility
        pausedMs: downtimeMs,
        faultedMs
      };
    }));

    return perMachine;
  }

  // #2 DailyMachineOeeBarChartComponent (Availability, Efficiency, Throughput, OEE)
  async function buildMachineOEEFromSessions(db, dayStart, dayEnd) {
    const msColl = db.collection(config.machineSessionCollectionName);

    const serials = await msColl.distinct("machine.serial", {
      "timestamps.start": { $lt: dayEnd },
      $or: [{ "timestamps.end": { $gt: dayStart } }, { "timestamps.end": { $exists: false } }, { "timestamps.end": null }],
    });

    const windowSec = (dayEnd - dayStart) / 1000;

    const rows = await Promise.all(serials.map(async (serial) => {
      const sessions = await msColl.find({
        "machine.serial": serial,
        "timestamps.start": { $lt: dayEnd },
        $or: [{ "timestamps.end": { $gt: dayStart } }, { "timestamps.end": { $exists: false } }, { "timestamps.end": null }],
      }).project({
        _id: 0, machine: 1, timestamps: 1,
        runtime: 1, workTime: 1, totalTimeCredit: 1, totalCount: 1, misfeedCount: 1
      }).toArray();

      let runtimeSec = 0, workSec = 0, timeCreditSec = 0, totalCount = 0, misfeed = 0;

      for (const s of sessions) {
        const { factor } = overlap(s.timestamps?.start, s.timestamps?.end, dayStart, dayEnd);
        runtimeSec      += safe(s.runtime)          * factor;
        workSec         += safe(s.workTime)         * factor;
        timeCreditSec   += safe(s.totalTimeCredit)  * factor;
        totalCount      += safe(s.totalCount)       * factor;
        misfeed         += safe(s.misfeedCount)     * factor;
      }

      const availability = windowSec > 0 ? (runtimeSec / windowSec) : 0;
      const efficiency   = workSec  > 0 ? (timeCreditSec / workSec) : 0;
      const throughput   = (totalCount + misfeed) > 0 ? (totalCount / (totalCount + misfeed)) : 0;
      const oee          = availability * efficiency * throughput;

      return {
        serial,
        name: sessions[0]?.machine?.name || `Serial ${serial}`,
        // Match original daily dashboard shape: only oee percentage
        oee: +(oee * 100).toFixed(2)
      };
    }));

    // sort desc by OEE as before
    rows.sort((a,b) => b.oee - a.oee);
    return rows;
  }

  // #3 RankedOperatorBarChartComponent (operator sessions today)
  async function buildTopOperatorEfficiencyFromSessions(db, dayStart, dayEnd) {
    const osColl = db.collection(config.operatorSessionCollectionName);

    // quick agg to get operators who have a session overlapping today
    const operators = await osColl.aggregate([
      { $match: {
          "timestamps.start": { $lt: dayEnd },
          $or: [{ "timestamps.end": { $gt: dayStart } }, { "timestamps.end": { $exists: false } }, { "timestamps.end": null }],
          "operator.id": { $exists: true, $ne: -1 }
      }},
      { $group: { _id: "$operator.id", name: { $first: "$operator.name" } } }
    ]).toArray();

    if (!operators.length) return [];

    const rows = await Promise.all(operators.map(async (op) => {
      const sessions = await osColl.find({
        "operator.id": op._id,
        "timestamps.start": { $lt: dayEnd },
        $or: [{ "timestamps.end": { $gt: dayStart } }, { "timestamps.end": { $exists: false } }, { "timestamps.end": null }],
      }).project({
        _id: 0, timestamps: 1, workTime: 1, totalTimeCredit: 1, totalCount: 1, misfeedCount: 1
      }).toArray();

      let workSec = 0, timeCreditSec = 0, totalCount = 0, misfeed = 0;
      for (const s of sessions) {
        const { factor } = overlap(s.timestamps?.start, s.timestamps?.end, dayStart, dayEnd);
        workSec       += safe(s.workTime)        * factor;
        timeCreditSec += safe(s.totalTimeCredit) * factor;
        totalCount    += safe(s.totalCount)      * factor;
        misfeed       += safe(s.misfeedCount)    * factor;
      }

      const efficiency = workSec > 0 ? (timeCreditSec / workSec) : 0;
      const roundedValid = Math.round(totalCount);
      const roundedMisfeed = Math.round(misfeed);
      return {
        id: op._id,
        name: op.name || `#${op._id}`,
        efficiency: +(efficiency * 100).toFixed(2),
        metrics: {
          runtime: { total: Math.round(workSec * 1000), formatted: formatDuration(Math.round(workSec * 1000)) },
          output: {
            totalCount: roundedValid + roundedMisfeed,
            validCount: roundedValid,
            misfeedCount: roundedMisfeed
          }
        }
      };
    }));

    return rows.sort((a,b) => b.efficiency - a.efficiency).slice(0, 10);
  }

  // ---- ROUTE\----
  router.get('/analytics/daily-sessions-dashboard', async (req, res) => {
    try {
      const now = DateTime.now();
      const dayStart = now.startOf('day').toJSDate();
      const dayEnd = now.toJSDate();

      const [
        machineStatus,             // sessions-based
        machineOee,                // sessions-based
        itemHourlyStack,           // existing (counts)
        topOperators,              // sessions-based
        plantwideMetrics,          // existing (states/counts) – leaving as-is for now
        dailyCounts                // existing (counts)
      ] = await Promise.all([
        buildDailyMachineStatusFromSessions(db, dayStart, dayEnd),
        buildMachineOEEFromSessions(db, dayStart, dayEnd),
        buildDailyItemHourlyStack(db, dayStart, dayEnd),
        buildTopOperatorEfficiencyFromSessions(db, dayStart, dayEnd),
        buildPlantwideMetricsByHour(db, dayStart, dayEnd),
        buildDailyCountTotals(db, null, dayEnd)
      ]);

      return res.json({
        timeRange: { start: dayStart, end: dayEnd, total: formatDuration(dayEnd - dayStart) },
        machineStatus,
        machineOee,
        itemHourlyStack,
        topOperators,
        plantwideMetrics,
        dailyCounts
      });
    } catch (error) {
      logger.error(`Error in ${req.method} ${req.originalUrl}:`, error);
      res.status(500).json({ error: "Failed to fetch full daily dashboard data" });
    }
  });

  return router;
};
