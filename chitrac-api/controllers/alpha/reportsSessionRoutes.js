const express = require("express");
const config = require("../../modules/config");
const { parseAndValidateQueryParams, formatDuration } = require("../../utils/time");

module.exports = function (server) {
  const router = express.Router();
  const db = server.db;
  const logger = server.logger;

  router.get("/analytics/machine-item-sessions-summary", async (req, res) => {
    try {
      const { start, end, serial } = parseAndValidateQueryParams(req);
      const exactStart = new Date(start);
      const exactEnd = new Date(end);

      // Pull machine-sessions that overlap the window.
      // If still-open sessions (no timestamps.end), treat end as "now".
      const match = {
        ...(serial ? { "machine.serial": serial } : {}),
        "timestamps.start": { $lte: exactEnd },
        $or: [
          { "timestamps.end": { $exists: false } },
          { "timestamps.end": { $gte: exactStart } },
        ],
      };

      // Use an aggregation so we only carry the counts inside the window.
      // Note: we still keep session-level info for computing worked time.
      const sessions = await db
        .collection(config.machineSessionCollectionName)
        .aggregate([
          { $match: match },
          // Compute overlap window and slice length in Mongo
          {
            $addFields: {
              ovStart: { $max: ["$timestamps.start", exactStart] },
              ovEnd: {
                $min: [
                  { $ifNull: ["$timestamps.end", exactEnd] },
                  exactEnd,
                ],
              },
            },
          },
          {
            $addFields: {
              sliceMs: { $max: [0, { $subtract: ["$ovEnd", "$ovStart"] }] },
            },
          },
          {
            $project: {
              _id: 0,
              timestamps: 1,
              machine: 1,
              operators: 1, // to compute activeStations (exclude dummy -1)
              // Keep only fields used and filter arrays to [start,end], then project minimal subfields
              countsFiltered: {
                $map: {
                  input: {
                    $filter: {
                      input: "$counts",
                      as: "c",
                      cond: {
                        $and: [
                          { $gte: ["$$c.timestamp", exactStart] },
                          { $lte: ["$$c.timestamp", exactEnd] },
                        ],
                      },
                    },
                  },
                  as: "c",
                  in: {
                    timestamp: "$$c.timestamp",
                    item: {
                      id: "$$c.item.id",
                      name: "$$c.item.name",
                      standard: "$$c.item.standard",
                    },
                  },
                },
              },
              ovStart: 1,
              ovEnd: 1,
              sliceMs: 1,
            },
          },
          // Keep all sessions (even with no counts) since they contribute worked time
        ])
        .toArray();

      if (!sessions.length) return res.json([]);

      // Group by machine.serial (preserve old route’s multi-machine behavior)
      const grouped = new Map();
      for (const s of sessions) {
        const key = s.machine?.serial;
        if (!key) continue;
        if (!grouped.has(key)) {
          grouped.set(key, {
            machine: {
              name: s.machine?.name || "Unknown",
              serial: key,
            },
            sessions: [],
            // per-item running aggregates across sessions in the window
            itemAgg: new Map(), // itemId -> { name, standard, count, workedTimeMs }
            totalCount: 0,
            totalWorkedMs: 0,
          });
        }
        const bucket = grouped.get(key);

        // Use precomputed overlap slice
        if (!s.sliceMs || s.sliceMs <= 0) continue;

        // Active stations = operators excluding dummy (-1)
        const activeStations = Array.isArray(s.operators)
          ? s.operators.filter((op) => op && op.id !== -1).length
          : 0;

        // Worked time for this clipped slice
        const workedTimeMs = Math.max(0, s.sliceMs * activeStations);

        // Session entry for response 
        bucket.sessions.push({
          start: new Date(s.ovStart).toISOString(),
          end: new Date(s.ovEnd).toISOString(),
          workedTimeMs,
          workedTimeFormatted: formatDuration(workedTimeMs),
        });

        // Counts inside the clipped slice (already filtered by the pipeline)
        const counts = Array.isArray(s.countsFiltered) ? s.countsFiltered : [];
        if (!counts.length) {
          continue;
        }

        // Group counts by item id
        const byItem = new Map();
        for (const c of counts) {
          const it = c.item || {};
          const id = it.id;
          if (id == null) continue;
          if (!byItem.has(id)) {
            byItem.set(id, {
              id,
              name: it.name || "Unknown",
              standard: Number(it.standard) || 0,
              count: 0,
            });
          }
          byItem.get(id).count += 1;
        }

        for (const [, itm] of byItem) {
          const rec = bucket.itemAgg.get(itm.id) || {
            name: itm.name,
            standard: itm.standard,
            count: 0,
            workedTimeMs: 0,
          };
          rec.count += itm.count;
          rec.workedTimeMs += workedTimeMs; // full credit to each item that appeared in this slice
          bucket.itemAgg.set(itm.id, rec);

          bucket.totalCount += itm.count;
          bucket.totalWorkedMs += workedTimeMs;
        }
      }

      // Build final per-machine results (same shape as before)
      const results = [];
      for (const [, b] of grouped) {
        if (!b.sessions.length) {
          results.push({
            machine: b.machine,
            sessions: [],
            machineSummary: {
              totalCount: 0,
              workedTimeMs: 0,
              workedTimeFormatted: formatDuration(0),
              pph: 0,
              proratedStandard: 0,
              efficiency: 0,
              itemSummaries: {},
            },
          });
          continue;
        }

        // Per-item summaries + prorated standard
        let proratedStandard = 0;
        const itemSummaries = {};
        for (const [itemId, s] of b.itemAgg.entries()) {
          const hours = s.workedTimeMs / 3600000;
          const pph = hours > 0 ? s.count / hours : 0;

          // Efficiency = PPH / standard
          const eff = s.standard > 0 ? pph / s.standard : 0;

          // weight for prorated standard
          const weight = b.totalCount > 0 ? s.count / b.totalCount : 0;
          proratedStandard += weight * s.standard;

          itemSummaries[itemId] = {
            name: s.name,
            standard: s.standard,
            countTotal: s.count,
            workedTimeFormatted: formatDuration(s.workedTimeMs),
            pph: Math.round(pph * 100) / 100,
            efficiency: Math.round(eff * 10000) / 100,
          };
        }

        const totalHours = b.totalWorkedMs / 3600000;
        const machinePph = totalHours > 0 ? b.totalCount / totalHours : 0;
        const machineEff = proratedStandard > 0 ? machinePph / proratedStandard : 0;

        results.push({
          machine: b.machine,
          sessions: b.sessions,
          machineSummary: {
            totalCount: b.totalCount,
            workedTimeMs: b.totalWorkedMs,
            workedTimeFormatted: formatDuration(b.totalWorkedMs),
            pph: Math.round(machinePph * 100) / 100,
            proratedStandard: Math.round(proratedStandard * 100) / 100,
            efficiency: Math.round(machineEff * 10000) / 100,
            itemSummaries,
          },
        });
      }

      res.json(results);
    } catch (error) {
      logger.error(`Error in ${req.method} ${req.originalUrl}:`, error);
      res
        .status(500)
        .json({ error: "Failed to generate machine item summary" });
    }
  });



  // /analytics/operator-item-summary (sessions-based)
router.get("/analytics/operator-item-sessions-summary", async (req, res) => {
    try {
      const { start, end } = parseAndValidateQueryParams(req);
      const operatorId = req.query.operatorId ? parseInt(req.query.operatorId) : null;
      const exactStart = new Date(start);
      const exactEnd = new Date(end);
  
      // Pull operator-sessions that overlap the window
      const match = {
        ...(operatorId ? { "operator.id": operatorId } : {}),
        "timestamps.start": { $lte: exactEnd },
        $or: [
          { "timestamps.end": { $exists: false } },
          { "timestamps.end": { $gte: exactStart } }
        ]
      };
  
      // Filter counts/misfeeds to exact [start,end] in Mongo; only use padded for session overlap
      const sessions = await db
        .collection(config.operatorSessionCollectionName)
        .aggregate([
          { $match: match },
          // Compute overlap window and slice length in Mongo
          {
            $addFields: {
              ovStart: { $max: ["$timestamps.start", exactStart] },
              ovEnd: {
                $min: [
                  { $ifNull: ["$timestamps.end", exactEnd] },
                  exactEnd
                ]
              }
            }
          },
          {
            $addFields: {
              sliceMs: { $max: [0, { $subtract: ["$ovEnd", "$ovStart"] }] }
            }
          },
          {
            $project: {
              _id: 0,
              timestamps: 1,
              operator: 1,
              machine: 1,
              // Only what we need out of the arrays
              countsFiltered: {
                $map: {
                  input: {
                    $filter: {
                      input: "$counts",
                      as: "c",
                      cond: {
                        $and: [
                          { $gte: ["$$c.timestamp", exactStart] },
                          { $lte: ["$$c.timestamp", exactEnd] }
                        ]
                      }
                    }
                  },
                  as: "c",
                  in: {
                    timestamp: "$$c.timestamp",
                    item: {
                      id: "$$c.item.id",
                      name: "$$c.item.name",
                      standard: "$$c.item.standard"
                    }
                  }
                }
              },
              misfeedsFiltered: {
                $map: {
                  input: {
                    $filter: {
                      input: "$misfeeds",
                      as: "m",
                      cond: {
                        $and: [
                          { $gte: ["$$m.timestamp", exactStart] },
                          { $lte: ["$$m.timestamp", exactEnd] }
                        ]
                      }
                    }
                  },
                  as: "m",
                  in: {
                    timestamp: "$$m.timestamp",
                    item: {
                      id: "$$m.item.id",
                      name: "$$m.item.name",
                      standard: "$$m.item.standard"
                    }
                  }
                }
              },
              ovStart: 1,
              ovEnd: 1,
              sliceMs: 1
            }
          },
          // Sorting not required for aggregation accuracy
        ])
        .toArray();
  
      if (!sessions.length) return res.json([]);
  
      // Aggregate by operator-machine pair
      const pairMap = new Map(); // key = `${opId}-${serial}`
  
      for (const s of sessions) {
        const opId = s.operator?.id;
        const serial = s.machine?.serial;
        if (typeof opId !== "number" || opId === -1 || !serial) continue;
  
        const key = `${opId}-${serial}`;
        if (!pairMap.has(key)) {
          pairMap.set(key, {
            operatorName: s.operator?.name || "Unknown",
            machineName: s.machine?.name || "Unknown",
            operatorId: opId,
            machineSerial: serial,
            totalRunMs: 0,
            items: new Map(), // itemId -> { name, standard, count, misfeed }
          });
        }
        const bucket = pairMap.get(key);
  
        // Use precomputed overlap slice
        if (!s.sliceMs || s.sliceMs <= 0) continue;
  
        // Operator session represents RUN time for that operator
        bucket.totalRunMs += Math.max(0, s.sliceMs);
  
        // Inside-window counts/misfeeds already filtered in Mongo to [start,end]
        const counts = s.countsFiltered || [];
        const misfeeds = s.misfeedsFiltered || [];
  
        // Group counts by item
        for (const c of counts) {
          const it = c.item || {};
          const id = it.id;
          if (id == null) continue;
          const rec = bucket.items.get(id) || {
            name: it.name || "Unknown",
            standard: Number(it.standard) || 666,
            count: 0,
            misfeed: 0
          };
          rec.count += 1;
          bucket.items.set(id, rec);
        }
  
        // Group misfeeds by item
        for (const m of misfeeds) {
          const it = m.item || {};
          const id = it.id;
          if (id == null) continue;
          const rec = bucket.items.get(id) || {
            name: it.name || "Unknown",
            standard: Number(it.standard) || 666,
            count: 0,
            misfeed: 0
          };
          rec.misfeed += 1;
          bucket.items.set(id, rec);
        }
      }
  
      // Build per-item rows per operator-machine pair (same shape as current route)
      const rows = [];
      for (const [, b] of pairMap) {
        if (b.items.size === 0) continue; // match current route behavior
  
        const hours = b.totalRunMs / 3_600_000;
        const workedTimeFormatted = formatDuration(b.totalRunMs); // same helper as today (object with hours/minutes)
  
        for (const [, it] of b.items) {
          const pph = hours > 0 ? it.count / hours : 0;
          const standard = it.standard > 0 ? it.standard : 666;
          const efficiency = standard > 0 ? pph / standard : 0;
  
          rows.push({
            operatorName: b.operatorName,
            machineName: b.machineName,
            itemName: it.name,
            workedTimeFormatted,
            count: it.count,
            misfeed: it.misfeed,
            pph: Math.round(pph * 100) / 100,
            standard,
            efficiency: Math.round(efficiency * 10000) / 100
          });
        }
      }
  
      res.json(rows);
    } catch (err) {
      logger.error(`Error in ${req.method} ${req.originalUrl}:`, err);
      res.status(500).json({ error: "Failed to generate operator item summary report" });
    }
  });
  

  return router;
};




