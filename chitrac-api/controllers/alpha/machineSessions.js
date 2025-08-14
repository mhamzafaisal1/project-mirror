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

// Debug route to check database state
router.get("/analytics/debug", async (req, res) => {
  try {
    logger.info("[machineSessions] Debug route called");
    
    // Check collections
    const collections = await db.listCollections().toArray();
    const collectionNames = collections.map(c => c.name);
    
    // Check machine collection
    const machineCount = await db.collection(config.machineCollectionName).countDocuments();
    const activeMachineCount = await db.collection(config.machineCollectionName).countDocuments({ active: true });
    
    // Check stateTicker collection
    const tickerCount = await db.collection(config.stateTickerCollectionName).countDocuments();
    
    // Check machineSession collection
    const sessionCount = await db.collection(config.machineSessionCollectionName).countDocuments();
    
    res.json({
      collections: collectionNames,
      machineCollection: {
        name: config.machineCollectionName,
        totalCount: machineCount,
        activeCount: activeMachineCount
      },
      stateTickerCollection: {
        name: config.stateTickerCollectionName,
        totalCount: tickerCount
      },
      machineSessionCollection: {
        name: config.machineSessionCollectionName,
        totalCount: sessionCount
      }
    });
  } catch (err) {
    logger.error("[machineSessions] Debug route error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Add this debug query to see actual session dates
router.get("/analytics/debug-sessions", async (req, res) => {
    try {
      const sessions = await db.collection("machine-session")
        .find({})
        .project({ 
          "machine.serial": 1, 
          "timestamps.start": 1, 
          "timestamps.end": 1,
          _id: 0 
        })
        .sort({ "timestamps.start": 1 })
        .limit(20)
        .toArray();
      
      res.json({
        totalSessions: await db.collection("machine-session").countDocuments(),
        sampleSessions: sessions,
        dateRange: {
          earliest: sessions[0]?.timestamps?.start,
          latest: sessions[sessions.length-1]?.timestamps?.end
        }
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

// ---- /api/alpha/analytics/machines-summary ----
router.get("/analytics/machines-summary", async (req, res) => {
    try {
      const { start, end } = parseAndValidateQueryParams(req);
      const queryStart = new Date(start);
      let queryEnd = new Date(end);
      const now = new Date();
      if (queryEnd > now) queryEnd = now;
      
      // Active machines set
      const activeSerials = new Set(
        await db.collection(config.machineCollectionName)
          .distinct("serial", { active: true })
      );
  
      // Pull tickers for active machines only
      const tickers = await db.collection(config.stateTickerCollectionName)
        .find({ "machine.serial": { $in: [...activeSerials] } })
        .project({ _id: 0 })
        .toArray();
  
      // Build one promise per machine
      const results = await Promise.all(
        tickers.map(async (t) => {
          const { machine, status } = t || {};
          const serial = machine?.serial;
          if (!serial) {
            return null;
          }
  
          // Fetch sessions that overlap the window
          // Spec: start in [S,E] OR end in [S,E].
          // Add "spans entire window" guard to avoid misses.
          const sessions = await db.collection(config.machineSessionCollectionName)
            .find({
              "machine.serial": serial,
              $or: [
                { "timestamps.start": { $gte: queryStart, $lte: queryEnd } },
                { "timestamps.end":   { $exists: true, $gte: queryStart, $lte: queryEnd } },
                { "timestamps.start": { $lte: queryStart }, "timestamps.end": { $exists: true, $gte: queryEnd } },
                { "timestamps.start": { $lte: queryStart }, "timestamps.end": { $exists: false } } // open session spanning end
              ]
            })
            .sort({ "timestamps.start": 1 })
            .toArray();
  
          // If nothing in range, still return zeroed row for the machine
          if (!sessions.length) {
            const totalMs = queryEnd - queryStart;
            return formatMachinesSummaryRow({
              machine, status,
              runtimeMs: 0, downtimeMs: totalMs,
              totalCount: 0, misfeedCount: 0,
              workTimeSec: 0, totalTimeCredit: 0,
              queryStart, queryEnd
            });
          }
  
          // Truncate first session if it starts before queryStart
          {
            const first = sessions[0];
            const firstStart = new Date(first.timestamps?.start);
            if (firstStart < queryStart) {
              sessions[0] = truncateAndRecalc(first, queryStart, first.timestamps?.end ? new Date(first.timestamps.end) : queryEnd);
              sessions[0]._truncated = true;
            } else {
              // Ensure metrics exist even if not truncated
              sessions[0] = ensureRecalcIfMissing(first);
            }
          }
  
          // Truncate last session if it ends after queryEnd (or is open)
          {
            const lastIdx = sessions.length - 1;
            const last = sessions[lastIdx];
            const lastEnd = last.timestamps?.end ? new Date(last.timestamps.end) : null;
  
            if (!lastEnd || lastEnd > queryEnd) {
              const effectiveEnd = lastEnd ? queryEnd : queryEnd; // clamp open or overrun to queryEnd
              sessions[lastIdx] = truncateAndRecalc(
                last,
                new Date(sessions[lastIdx].timestamps.start), // after possible first fix, use its current start
                effectiveEnd
              );
              sessions[lastIdx]._truncated = true;
            } else {
              // Ensure metrics exist even if not truncated
              sessions[lastIdx] = ensureRecalcIfMissing(last);
            }
          }
  
          // Recalc any middle sessions missing metrics
          for (let i = 1; i < sessions.length - 1; i++) {
            sessions[i] = ensureRecalcIfMissing(sessions[i]);
          }
  
          // Aggregate
          let runtimeMs = 0;
          let workTimeSec = 0;
          let totalCount = 0;
          let misfeedCount = 0;
          let totalTimeCredit = 0;
  
          for (const s of sessions) {
            const r = s._recalc;
            if (!r) {
              continue;
            }
            runtimeMs += r.runtimeMs;
            workTimeSec += r.workTimeSec;
            totalCount += r.totalCount;
            misfeedCount += r.misfeedCount;
            totalTimeCredit += r.totalTimeCredit;
          }
  
          const downtimeMs = Math.max(0, (queryEnd - queryStart) - runtimeMs);
  
          const result = formatMachinesSummaryRow({
            machine, status,
            runtimeMs, downtimeMs,
            totalCount, misfeedCount,
            workTimeSec, totalTimeCredit,
            queryStart, queryEnd
          });
          
          // Add debug info if requested
          if (req.query.debugSessions === 'true') {
            result.debug = {
              sessionCount: sessions.length,
              truncatedSessions: sessions.filter(s => s._truncated).length,
              totalMachines: tickers.length
            };
          }
          
          return result;
        })
      );
  
      const finalResults = results.filter(Boolean);
      res.json(finalResults);
    } catch (err) {
      logger.error(`Error in ${req.method} ${req.originalUrl}:`, err);
      
      // Check if it's a validation error
      if (err.message.includes('Start and end dates are required') || 
          err.message.includes('Invalid date format') ||
          err.message.includes('Start date must be before end date')) {
        return res.status(400).json({ error: err.message });
      }
      
      res.status(500).json({ error: "Failed to build machines summary" });
    }
  });
  
  /* -------------------- helpers -------------------- */
  
  
  function formatDuration(ms) {
    const s = Math.floor(ms / 1000);
    const hh = String(Math.floor(s / 3600)).padStart(2, "0");
    const mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
    const ss = String(s % 60).padStart(2, "0");
    return `${hh}:${mm}:${ss}`;
  }
  
  // Clamp standard to PPH
  function normalizePPH(std) {
    const n = Number(std) || 0;
    return n > 0 && n < 60 ? n * 60 : n;
  }
  
  // Recompute a session’s metrics given its counts/misfeeds and timestamps
  function recalcSession(session) {
    const start = new Date(session.timestamps.start);
    const end = new Date(session.timestamps.end || new Date());
    const runtimeMs = Math.max(0, end - start);
    const runtimeSec = runtimeMs / 1000;
  
    // Active stations = non-dummy operators
    const activeStations = Array.isArray(session.operators)
      ? session.operators.filter((op) => op && op.id !== -1).length
      : 0;
  
    const workTimeSec = runtimeSec * activeStations;
  
    const counts = Array.isArray(session.counts) ? session.counts : [];
    const misfeeds = Array.isArray(session.misfeeds) ? session.misfeeds : [];
  
    const totalCount = counts.length;
    const misfeedCount = misfeeds.length;
  
    // Build item -> standard map from session.items
    const items = Array.isArray(session.items) ? session.items : [];
    const stdById = new Map();
    for (const it of items) {
      if (it && it.id != null) {
        stdById.set(it.id, normalizePPH(it.standard));
      }
    }
  
    // Aggregate counts by item.id
    const byItem = new Map();
    for (const c of counts) {
      const id = c?.item?.id;
      if (id == null) continue;
      const prev = byItem.get(id) || 0;
      byItem.set(id, prev + 1);
    }
  
    // Align arrays to session.items order
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
  
    totalTimeCredit = Number(totalTimeCredit.toFixed(2));
  
    session._recalc = {
      runtimeMs,
      workTimeSec,
      totalCount,
      misfeedCount,
      totalTimeCredit,
      totalByItem,
      timeCreditByItem
    };
    return session;
  }
  
  // Truncate a session to [start,end] and recalc
  function truncateAndRecalc(original, newStart, newEnd) {
    const s = structuredClone(original);
  
    // Clamp timestamps
    const start = new Date(s.timestamps.start);
    const end = new Date(s.timestamps.end || new Date());
  
    const clampedStart = start < newStart ? newStart : start;
    const clampedEnd = end > newEnd ? newEnd : end;
  
    s.timestamps.start = clampedStart;
    s.timestamps.end = clampedEnd;
  
    // Filter counts/misfeeds to window
    const inWindow = (d) => {
      const ts = new Date(d.timestamp);
      return ts >= clampedStart && ts <= clampedEnd;
    };
  
    s.counts = (s.counts || []).filter(inWindow);
    s.misfeeds = (s.misfeeds || []).filter(inWindow);
  
    return recalcSession(s);
  }
  
  // Ensure a session has recalculated fields even if not truncated
  function ensureRecalcIfMissing(s) {
    if (!s || s._recalc) return s;
    // For open sessions without end, cap at now to avoid runaway runtime
    if (!s.timestamps?.end) {
      const clone = structuredClone(s);
      clone.timestamps = { ...clone.timestamps, end: new Date() };
      return recalcSession(clone);
    }
    return recalcSession(s);
  }
  
  // Build the final response row matching your existing shape
  function formatMachinesSummaryRow({
    machine, status,
    runtimeMs, downtimeMs,
    totalCount, misfeedCount,
    workTimeSec, totalTimeCredit,
    queryStart, queryEnd
  }) {
    const totalMs = Math.max(0, queryEnd - queryStart);
    const availability = totalMs ? Math.min(Math.max(runtimeMs / totalMs, 0), 1) : 0;
    const throughput = (totalCount + misfeedCount) ? totalCount / (totalCount + misfeedCount) : 0;
    const efficiency = workTimeSec > 0 ? totalTimeCredit / workTimeSec : 0;
    const oee = availability * throughput * efficiency;
  
    return {
      machine: {
        serial: machine?.serial ?? -1,
        name: machine?.name ?? "Unknown"
      },
      currentStatus: {
        code: status?.code ?? 0,
        name: status?.name ?? "Unknown"
      },
      metrics: {
        runtime: {
          total: runtimeMs,
          formatted: formatDuration(runtimeMs)
        },
        downtime: {
          total: downtimeMs,
          formatted: formatDuration(downtimeMs)
        },
        output: {
          totalCount,
          misfeedCount
        },
        performance: {
          availability: {
            value: availability,
            percentage: (availability * 100).toFixed(2)
          },
          throughput: {
            value: throughput,
            percentage: (throughput * 100).toFixed(2)
          },
          efficiency: {
            value: efficiency,
            percentage: (efficiency * 100).toFixed(2)
          },
          oee: {
            value: oee,
            percentage: (oee * 100).toFixed(2)
          }
        }
      },
      timeRange: {
        start: queryStart,
        end: queryEnd
      }
    };
  }
  
  return router;
};
  