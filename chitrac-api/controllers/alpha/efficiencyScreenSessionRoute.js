// --- SPL Efficiency Screen API (sessions-powered) ---

const express = require('express');
const { DateTime } = require('luxon');

module.exports = function (server) {
  const router = express.Router();
  const db = server.db;
  const logger = server.logger;
  const config = require('../../modules/config');

  router.get('/analytics/machine-live-session-summary', async (req, res) => {
  try {
    const { serial, date } = req.query;
    if (!serial || !date) {
      return res.status(400).json({ error: 'Missing serial or date' });
    }

    const serialNum = Number(serial);
    const ticker = await db.collection(config.stateTickerCollectionName || 'stateTicker')
      .findOne(
        { 'machine.serial': serialNum },
        {
          projection: {
            _id: 0,
            timestamp: 1,
            machine: 1,
            program: 1,
            status: 1,
            operators: 1
          }
        }
      );

    // No ticker: Offline
    if (!ticker) {
      return res.json({
        status: { code: -1, name: 'Offline' },
        machine: { serial: serialNum }
      });
    }

    // Build list of active operators from ticker (skip dummies; preserve existing station 2 skip for 67801/67802)
    const onMachineOperators = (Array.isArray(ticker.operators) ? ticker.operators : [])
      .filter(op => op && op.id !== -1)
      .filter(op => !([67801, 67802].includes(serialNum) && op.station === 2));

    // If machine is NOT running, mirror existing route behavior by returning entries with 0% efficiency
    // (we still include operator/machine/batch info for the screen to render cleanly)
    if ((ticker.status?.code ?? 0) !== 1) {
      const performanceData = await Promise.all(
        onMachineOperators.map(async (op, idx) => {
          const batchItem = await resolveBatchItemFromSessions(db, serialNum, op.id);
          return {
            status: ticker.status?.code ?? 0,
            fault: ticker.status?.name ?? 'Unknown',
            operator: op.name || 'Unknown',
            operatorId: op.id,
            machine: ticker.machine?.name || `Serial ${serialNum}`,
            timers: { on: 0, ready: 0 },
            displayTimers: { on: '', run: '' },
            efficiency: buildZeroEfficiencyPayload(),
            // keep the field to match the existing response shape; values not required in the new flow
            oee: {},
            batch: { item: batchItem, code: 10000001 }
          };
        })
      );

      // Back-compat: preserve existing top-level shape/key
      return res.json({ flipperData: performanceData });
    }

    // Running: compute performance from operator-sessions over four windows
    const now = DateTime.now();
    const frames = {
      lastSixMinutes: { start: now.minus({ minutes: 6 }), label: 'Last 6 Mins' },
      lastFifteenMinutes: { start: now.minus({ minutes: 15 }), label: 'Last 15 Mins' },
      lastHour: { start: now.minus({ hours: 1 }), label: 'Last Hour' },
      today: { start: now.startOf('day'), label: 'All Day' }
    };

    const performanceData = await Promise.all(
      onMachineOperators.map(async (op, idx) => {
        // Run the four timeframe queries in parallel
        const results = await queryOperatorTimeframes(db, serialNum, op.id, frames);

        // If ANY timeframe came back empty, fetch most recent OPEN session and use it for all frames
        if (Object.values(results).some(arr => arr.length === 0)) {
          const open = await db.collection(config.operatorSessionCollectionName)
            .findOne(
              { 'operator.id': op.id, 'machine.serial': serialNum, 'timestamps.end': { $exists: false } },
              { sort: { 'timestamps.start': -1 }, projection: projectSessionForPerf() }
            );
          if (open) {
            for (const k of Object.keys(results)) results[k] = [open];
          }
        }

        // Compute efficiency% per timeframe from sessions (truncate overlap at frame start)
        const efficiencyObj = {};
        for (const [key, arr] of Object.entries(results)) {
          const { start, label } = frames[key];
          const { runtimeSec, totalTimeCreditSec } = sumWindow(arr, start, now);
          const eff = runtimeSec > 0 ? totalTimeCreditSec / runtimeSec : 0;
          efficiencyObj[key] = {
            value: Math.round(eff * 100),
            label,
            color: eff >= 0.9 ? 'green' : eff >= 0.7 ? 'yellow' : 'red'
          };
        }

        // Batch item: concatenate current items if multiple (prefer the most recent session; fallback to union)
        const batchItem = await resolveBatchItemFromSessions(db, serialNum, op.id);

        return {
          status: ticker.status?.code ?? 0,
          fault: ticker.status?.name ?? 'Unknown',
          operator: op.name || 'Unknown',
          operatorId: op.id,
          machine: ticker.machine?.name || `Serial ${serialNum}`,
          timers: { on: 0, ready: 0 },
          displayTimers: { on: '', run: '' },
          efficiency: efficiencyObj,
          // keep the field to match the existing response shape; not required for the new flow
          oee: {},
          batch: { item: batchItem, code: 10000001 }
        };
      })
    );

    // Back-compat: preserve existing top-level shape/key
    return res.json({ flipperData: performanceData });
  } catch (err) {
    logger.error(`Error in ${req.method} ${req.originalUrl}:`, err);
    return res.status(500).json({ error: 'Internal server error' });
  }
  });

  /* -------------------------- helpers (local) -------------------------- */

// Projection for operator-session queries used by this route
  function projectSessionForPerf() {
    return {
      projection: {
        _id: 0,
        timestamps: 1,
        items: 1,
        machine: 1,
        operator: 1,
        counts: { // we compute time credit from counts in the window
          timestamp: 1,
          item: { id: 1, name: 1, standard: 1 }
        }
      }
    };
  }

// Query all four time windows in parallel for a single operator
  async function queryOperatorTimeframes(db, serialNum, operatorId, frames) {
    const coll = db.collection(config.operatorSessionCollectionName);
    const nowJs = new Date();

    // Build the overlap filter template: (start < now) AND (end >= windowStart OR end missing)
    const buildFilter = (windowStart) => ({
      'operator.id': operatorId,
      'machine.serial': serialNum,
      'timestamps.start': { $lt: nowJs },
      $or: [
        { 'timestamps.end': { $exists: false } },
        { 'timestamps.end': { $gte: new Date(windowStart.toISO()) } }
      ]
    });

    const [six, fifteen, hour, today] = await Promise.all([
      coll.find(buildFilter(frames.lastSixMinutes.start), projectSessionForPerf()).sort({ 'timestamps.start': 1 }).toArray(),
      coll.find(buildFilter(frames.lastFifteenMinutes.start), projectSessionForPerf()).sort({ 'timestamps.start': 1 }).toArray(),
      coll.find(buildFilter(frames.lastHour.start), projectSessionForPerf()).sort({ 'timestamps.start': 1 }).toArray(),
      coll.find(buildFilter(frames.today.start), projectSessionForPerf()).sort({ 'timestamps.start': 1 }).toArray()
    ]);

    return {
      lastSixMinutes: six,
      lastFifteenMinutes: fifteen,
      lastHour: hour,
      today
    };
  }

// Sum runtime + time credit for a given window across an array of sessions
  function sumWindow(sessions, windowStartDT, windowEndDT) {
    const windowStart = new Date(windowStartDT.toISO());
    const windowEnd = new Date(windowEndDT.toISO());

    let runtimeSec = 0;
    let totalTimeCreditSec = 0;

    for (const s of sessions) {
      const sStart = new Date(s.timestamps.start);
      const sEnd = s.timestamps.end ? new Date(s.timestamps.end) : windowEnd;

      const effStart = sStart < windowStart ? windowStart : sStart;  // truncate first session if needed
      const effEnd = sEnd > windowEnd ? windowEnd : sEnd;

      if (effEnd <= effStart) continue;

      runtimeSec += (effEnd - effStart) / 1000;

      // Count records inside the effective window
      const inWindowCounts = (Array.isArray(s.counts) ? s.counts : []).filter(c => {
        const t = new Date(c.timestamp);
        return t >= effStart && t <= effEnd && !c.misfeed;
      });

      totalTimeCreditSec += calculateTotalTimeCredit(inWindowCounts);
    }

    if (sessions[0].operator.id === 170657) {
      console.log('run: ' + runtimeSec);
      console.log('credit: ' + totalTimeCreditSec);
    }
    return { runtimeSec: Math.round(runtimeSec), totalTimeCreditSec: totalTimeCreditSec };
  }

// Resolve batch item name string (concatenate with " + " if multiple)
  async function resolveBatchItemFromSessions(db, serialNum, operatorId) {
    const coll = db.collection(config.operatorSessionCollectionName);
    // Prefer the most recent open session; else latest any session
    const session =
      (await coll.findOne(
        { 'operator.id': operatorId, 'machine.serial': serialNum, 'timestamps.end': { $exists: false } },
        { sort: { 'timestamps.start': -1 }, projection: { _id: 0, items: 1 } }
      )) ||
      (await coll.findOne(
        { 'operator.id': operatorId, 'machine.serial': serialNum },
        { sort: { 'timestamps.start': -1 }, projection: { _id: 0, items: 1 } }
      ));

    const names = new Set(
      (session?.items || [])
        .map(it => it?.name)
        .filter(Boolean)
    );

    return [...names].join(' + ');
  }

// Build a zeroed efficiency map (for non-running statuses)
  function buildZeroEfficiencyPayload() {
    return {
      lastSixMinutes: { value: 0, label: 'Last 6 Mins', color: 'red' },
      lastFifteenMinutes: { value: 0, label: 'Last 15 Mins', color: 'red' },
      lastHour: { value: 0, label: 'Last Hour', color: 'red' },
      today: { value: 0, label: 'All Day', color: 'red' }
    };
  }

// ---- time-credit helpers (same math used elsewhere) ----
  function calculateTotalTimeCredit(countRecords) {
    if (!Array.isArray(countRecords) || countRecords.length === 0) return 0;

    const byItem = {};
    for (const r of countRecords) {
      const it = r.item || {};
      const key = `${it.id}`;
      if (!byItem[key]) byItem[key] = { count: 0, standard: Number(it.standard) || 0 };
      byItem[key].count += 1;
    }

    let total = 0;
    for (const { count, standard } of Object.values(byItem)) {
      const perHour = standard > 0 && standard < 60 ? standard * 60 : standard; // treat <60 as PPM
      if (perHour > 0) {
        total += count / (perHour / 3600); // seconds of time credit
        
      }
    }
    return round2(total);
  }

  function round2(n) {
    return Math.round((Number(n) || 0) * 100) / 100;
  }

  return router;
};
