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
          { "timestamps.end": { $exists: true, $gte: queryStart, $lte: queryEnd } },
          { "timestamps.start": { $lte: queryStart }, "timestamps.end": { $exists: true, $gte: queryEnd } },
          { "timestamps.start": { $lte: queryStart }, "timestamps.end": { $exists: false } } // open sessions spanning end
        ]
      });

      console.log(operatorIds,"operatorIds");
  
      if (!operatorIds.length) return res.json([]);
  
      const rows = await Promise.all(
        operatorIds.map(async (opId) => {
          try {
            // Pull all overlapping sessions for this operator
            const sessions = await coll.find({
              "operator.id": opId,
              $or: [
                { "timestamps.start": { $gte: queryStart, $lte: queryEnd } },
                { "timestamps.end": { $exists: true, $gte: queryStart, $lte: queryEnd } },
                { "timestamps.start": { $lte: queryStart }, "timestamps.end": { $exists: true, $gte: queryEnd } },
                { "timestamps.start": { $lte: queryStart }, "timestamps.end": { $exists: false } }
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
              } else {
                sessions[0] = ensureRecalcOperator(first);
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
              } else {
                sessions[lastIdx] = ensureRecalcOperator(last);
              }
            }
  
            // Ensure middle sessions are recomputed
            for (let i = 1; i < sessions.length - 1; i++) {
              sessions[i] = ensureRecalcOperator(sessions[i]);
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
                runtime: { total: runtimeMs, formatted: formatDuration(runtimeMs) },
                downtime: { total: downtimeMs, formatted: formatDuration(downtimeMs) },
                output: { totalCount, misfeedCount },
                performance: {
                  availability: { value: availability, percentage: (availability * 100).toFixed(2) },
                  throughput: { value: throughput, percentage: (throughput * 100).toFixed(2) },
                  efficiency: { value: efficiency, percentage: (efficiency * 100).toFixed(2) },
                  oee: { value: oee, percentage: (oee * 100).toFixed(2) }
                }
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
  
  function deepClone(o) {
    return JSON.parse(JSON.stringify(o));
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
  
    // Build item -> pph map from session.items
    const items = Array.isArray(session.items) ? session.items : [];
    const stdById = new Map();
    for (const it of items) {
      if (it && it.id != null) {
        stdById.set(it.id, normalizePPH(it.standard));
      }
    }
  
    // Count by item.id
    const byItem = new Map();
    for (const c of counts) {
      const id = c?.item?.id;
      if (id == null) continue;
      byItem.set(id, (byItem.get(id) || 0) + 1);
    }
  
    const totalByItem = [];
    const timeCreditByItem = [];
    let totalTimeCredit = 0;
  
    for (const it of items) {
      const id = it?.id;
      const countTotal = byItem.get(id) || 0;
      const pph = stdById.get(id) ?? normalizePPH(it?.standard ?? 0);
      const tci = pph > 0 ? countTotal / (pph / 3600) : 0; // seconds
      totalByItem.push(countTotal);
      timeCreditByItem.push(Number(tci.toFixed(2)));
      totalTimeCredit += tci;
    }
  
    session._recalc = {
      runtimeMs,
      workTimeSec,
      totalCount,
      misfeedCount,
      totalTimeCredit: Number(totalTimeCredit.toFixed(2)),
      totalByItem,
      timeCreditByItem
    };
    return session;
  }
  
  // Truncate to [newStart, newEnd] and recompute
  function truncateAndRecalcOperator(original, newStart, newEnd) {
    if (!original || !original.timestamps) {
      logger.warn('Invalid session for truncation');
      return original;
    }
    
    const s = deepClone(original);
  
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
  
    s.counts = (s.counts || []).filter(inWindow);
    s.misfeeds = (s.misfeeds || []).filter(inWindow);
  
    return recalcOperatorSession(s);
  }
  
  // Ensure recompute even for unmodified sessions
  function ensureRecalcOperator(s) {
    if (!s || s._recalc) return s;
    // For open sessions, cap at now to avoid runaway
    if (!s.timestamps?.end) {
      const c = deepClone(s);
      c.timestamps = { ...c.timestamps, end: new Date() };
      return recalcOperatorSession(c);
    }
    return recalcOperatorSession(s);
  }
  
  return router;
};