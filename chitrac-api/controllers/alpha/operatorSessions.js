const express = require('express');

module.exports = function (server) {
  const router = express.Router();
  
  // Get logger and db from server object
  const logger = server.logger;
  const db = server.db;
  const config = require('../../modules/config');

  // Helper function to parse and validate query parameters
  function parseAndValidateQueryParams(req) {
    const { start, end } = req.query;
    
    if (!start || !end) {
      throw new Error('Start and end dates are required');
    }
    
    const startDate = new Date(start);
    const endDate = new Date(end);
    
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      throw new Error('Invalid date format');
    }
    
    if (startDate >= endDate) {
      throw new Error('Start date must be before end date');
    }
    
    return { start: startDate, end: endDate };
  }

// ---- /api/alpha/analytics/operators-summary ----
router.get("/analytics/operators-summary", async (req, res) => {
    try {
      const { start, end } = parseAndValidateQueryParams(req);
      const queryStart = new Date(start);
      let queryEnd = new Date(end);
      const now = new Date();
      if (queryEnd > now) queryEnd = now;
      if (!(queryStart < queryEnd)) {
        return res.status(416).json({ error: "start must be before end" });
      }
  
      const collName = config.operatorSessionCollectionName;
      const coll = db.collection(collName);
  
      // Find operators that have at least one overlapping operator-session
      const operatorIds = await coll.distinct("operator.id", {
        "operator.id": { $ne: -1 },
        $or: [
          { "timestamps.start": { $gte: queryStart, $lte: queryEnd } },
          { "timestamps.end":   { $gte: queryStart, $lte: queryEnd } }
        ]
      });
  
      if (!operatorIds.length) return res.json([]);
  
      const rows = await Promise.all(
        operatorIds.map(async (opId) => {
          try {
            // Pull all overlapping sessions for this operator
            const sessions = await coll.find({
              "operator.id": opId,
              $or: [
                { "timestamps.start": { $gte: queryStart, $lte: queryEnd } },
                { "timestamps.end":   { $gte: queryStart, $lte: queryEnd } }
              ]
            })
            .sort({ "timestamps.start": 1 })
            .toArray();
  
            if (!sessions.length) return null;
  
            // Most recent session for status + machine
            const mostRecent = sessions[sessions.length - 1];
            const statusSource = mostRecent.endState || mostRecent.startState || {};
            const currentStatus = {
              code: statusSource?.status?.code ?? 0,
              name: statusSource?.status?.name ?? "Unknown"
            };
            const currentMachine = {
              serial: mostRecent?.machine?.serial ?? null,
              name: mostRecent?.machine?.name ?? null
            };
            const operatorName =
              mostRecent?.operator?.name ??
              sessions[0]?.operator?.name ??
              "Unknown";
  
            // Truncate first if it starts before window
            {
              const first = sessions[0];
              const firstStart = new Date(first.timestamps?.start);
              if (firstStart < queryStart) {
                sessions[0] = truncateAndRecalcOperator(first, queryStart, first.timestamps?.end ? new Date(first.timestamps.end) : queryEnd);
              }
            }
  
            // Truncate last if it ends after window or is open
            {
              const lastIdx = sessions.length - 1;
              const last = sessions[lastIdx];
              const lastEnd = last.timestamps?.end ? new Date(last.timestamps.end) : null;
              if (!lastEnd || lastEnd > queryEnd) {
                const effectiveEnd = queryEnd;
                // keep its current (possibly truncated) start
                sessions[lastIdx] = truncateAndRecalcOperator(
                  last,
                  new Date(sessions[lastIdx].timestamps.start),
                  effectiveEnd
                );
              }
            }
  
            // Aggregate
            let runtimeMs = 0;
            let workTimeSec = 0;      // operator-level work time == runtimeSec
            let totalCount = 0;
            let misfeedCount = 0;
            let totalTimeCredit = 0;
  
            for (const s of sessions) {
              if (s && s._recalc) {
                const r = s._recalc;
                runtimeMs += r.runtimeMs || 0;
                workTimeSec += r.workTimeSec || 0;
                totalCount += r.totalCount || 0;
                misfeedCount += r.misfeedCount || 0;
                totalTimeCredit += r.totalTimeCredit || 0;
              }
            }
  
            const totalMs = Math.max(0, queryEnd - queryStart);
            const downtimeMs = Math.max(0, totalMs - runtimeMs);
            const availability = totalMs ? clamp01(runtimeMs / totalMs) : 0;
            const throughput = (totalCount + misfeedCount) ? clamp01(totalCount / (totalCount + misfeedCount)) : 0;
            const efficiency = workTimeSec > 0 ? totalTimeCredit / workTimeSec : 0;
            const oee = availability * throughput * efficiency;
  
            return {
              operator: { id: opId, name: operatorName },
              currentStatus,
              currentMachine,
              metrics: {
                runtime: runtimeMs,
                downtime: downtimeMs,
                totalCount,
                misfeedCount,
                availability: (availability * 100).toFixed(2),
                throughput: (throughput * 100).toFixed(2),
                efficiency: (efficiency * 100).toFixed(2),
                oee: (oee * 100).toFixed(2)
              },
              timeRange: { start: queryStart, end: queryEnd }
            };
          } catch (sessionError) {
            logger.error(`Error processing operator ${opId}:`, sessionError);
            return null;
          }
        })
      );
  
      res.json(rows.filter(Boolean));
    } catch (err) {
      logger.error(`Error in ${req.method} ${req.originalUrl}:`, err);
      res.status(500).json({ error: "Failed to build operators summary" });
    }
  });
  
  /* ---------------- helpers (operator version) ---------------- */
  
  function clamp01(x) {
    return Math.min(Math.max(x, 0), 1);
  }
  
  function formatDuration(ms) {
    const s = Math.floor(ms / 1000);
    const hh = String(Math.floor(s / 3600)).padStart(2, "0");
    const mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
    const ss = String(s % 60).padStart(2, "0");
    return `${hh}:${mm}:${ss}`;
  }
  
  function normalizePPH(std) {
    const n = Number(std) || 0;
    return n > 0 && n < 60 ? n * 60 : n;
  }
  
  // Recompute metrics exactly like simulator's operator-session rules
  function recalcOperatorSession(session) {
    if (!session || !session.timestamps || !session.timestamps.start) {
      logger.warn('Invalid session data for recalculation');
      return session;
    }
    
    const start = new Date(session.timestamps.start);
    const end = new Date(session.timestamps.end || new Date());
    const runtimeMs = Math.max(0, end - start);
    const runtimeSec = runtimeMs / 1000;
  
    // Operator-level work time == runtimeSec
    const workTimeSec = runtimeSec;
  
    const counts = Array.isArray(session.counts) ? session.counts : [];
    const misfeeds = Array.isArray(session.misfeeds) ? session.misfeeds : [];
    const totalCount = counts.length;
    const misfeedCount = misfeeds.length;
  
    // Calculate total time credit (simplified - count per-item and use per-item standards)
    let totalTimeCredit = 0;
    
    // 1. Count how many of each item were produced in the truncated window
    const perItemCounts = new Map(); // key: item.id
    for (const c of counts) {
      const id = c?.item?.id;
      if (id == null) continue;
      perItemCounts.set(id, (perItemCounts.get(id) || 0) + 1);
    }
    
    // 2. Calculate time credit for each item based on its actual count and standard
    for (const [id, cnt] of perItemCounts) {
      // Find the standard for this specific item from session.items
      const item = session.items?.find(it => it && it.id === id);
      if (item && item.standard) {
        const pph = normalizePPH(item.standard);
        if (pph > 0) {
          totalTimeCredit += cnt / (pph / 3600); // seconds
        }
      }
    }
  
    session._recalc = {
      runtimeMs,
      workTimeSec,
      totalCount,
      misfeedCount,
      totalTimeCredit: Number(totalTimeCredit.toFixed(2))
    };
    return session;
  }
  
  // Truncate to [newStart, newEnd] and recompute
  function truncateAndRecalcOperator(original, newStart, newEnd) {
    if (!original || !original.timestamps) {
      logger.warn('Invalid session for truncation');
      return original;
    }
    
    // Only clone what we need to modify
    const s = {
      ...original,
      timestamps: { ...original.timestamps },
      counts: [...(original.counts || [])],
      misfeeds: [...(original.misfeeds || [])]
    };
  
    const start = new Date(s.timestamps.start);
    const end = new Date(s.timestamps.end || new Date());
  
    const clampedStart = start < newStart ? newStart : start;
    const clampedEnd = end > newEnd ? newEnd : end;
  
    s.timestamps.start = clampedStart;
    s.timestamps.end = clampedEnd;
  
    const inWindow = (d) => {
      if (!d || !d.timestamp) return false;
      const ts = new Date(d.timestamp);
      return ts >= clampedStart && ts <= clampedEnd;
    };
  
    s.counts = s.counts.filter(inWindow);
    s.misfeeds = s.misfeeds.filter(inWindow);
  
    return recalcOperatorSession(s);
  }
  
  return router;
};