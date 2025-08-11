// 📁 dailyDashboardRoutes.js
const express = require("express");

module.exports = function (server) {
  const router = express.Router();
  const db = server.db;
  const logger = server.logger;

  const {
    buildTopOperatorEfficiency,
    buildDailyMachineStatus,
    buildMachineOEE,
    buildDailyItemHourlyStack,
    buildPlantwideMetricsByHour,
    buildDailyCountTotals
  } = require('../../utils/dailyDashboardBuilder'); 

  const {
    getAllOperatorIds,
    buildOperatorPerformance,
    buildOperatorItemSummary,
    buildOperatorCountByItem,
    buildOperatorCyclePie,
    buildOperatorFaultHistory,
    buildOperatorEfficiencyLine,
  } = require("../../utils/operatorDashboardBuilder");

  const {
    buildMachinePerformance,
    buildMachineItemSummary,
    buildItemHourlyStack,
    buildFaultData,
    buildOperatorEfficiency
  } = require("../../utils/machineDashboardBuilder");

  const {
    parseAndValidateQueryParams,
    createPaddedTimeRange,
    formatDuration
  } = require('../../utils/time');

  
  const {
    groupStatesByMachine,
    groupStatesByOperator,
    extractAllCyclesFromStates,
    extractFaultCycles,
    fetchAllStates,
    groupStatesByOperatorAndSerial,
    fetchStatesForMachine,
    getAllMachineSerials,
    fetchStatesForOperator
  } = require("../../utils/state");

  const {
    getCountsForOperator,
    getValidCountsForOperator,
    getOperatorNameFromCount,
    processCountStatistics,
    groupCountsByItem,
    extractItemNamesFromCounts,
    groupCountsByOperatorAndMachine,
    getCountsForOperatorMachinePairs,
    groupCountsByOperator,
    getCountsForMachine,
    getValidCounts,
    getMisfeedCounts,
  } = require("../../utils/count");

  const { calculateAvailability, calculateThroughput, calculateEfficiency, calculateOEE, calculatePiecesPerHour, calculateOperatorTimes } = require("../../utils/analytics");

  const { fetchGroupedAnalyticsData } = require("../../utils/fetchData");

  const {getBookendedStatesAndTimeRange} = require("../../utils/bookendingBuilder")

  // router.get('/analytics/daily-dashboard/full', async (req, res) => {
  //   try {
  //     const { start, end } = parseAndValidateQueryParams(req);
  
  //     const [
  //       machineStatus,
  //       machineOee,
  //       itemHourlyStack,
  //       topOperators,
  //       plantwideMetrics,
  //       dailyCounts
  //     ] = await Promise.all([
  //       buildDailyMachineStatus(db, start, end),
  //       buildMachineOEE(db, start, end),
  //       buildDailyItemHourlyStack(db, start, end),
  //       buildTopOperatorEfficiency(db, start, end),
  //       buildPlantwideMetricsByHour(db, start, end),
  //       buildDailyCountTotals(db, start, end)
  //     ]);
  
  //     return res.json({
  //       timeRange: { start, end, total: formatDuration(new Date(end) - new Date(start)) },
  //       machineStatus,
  //       machineOee,
  //       itemHourlyStack,
  //       topOperators,
  //       plantwideMetrics,
  //       dailyCounts
  //     });
  //   } catch (error) {
  //     logger.error(`Error in ${req.method} ${req.originalUrl}:`, error);
  //     res.status(500).json({ error: "Failed to fetch full daily dashboard data" });
  //   }
  // });



  // ---------- tiny utils ----------
function isoHour(d) {
  // Normalize to hour ISO key (keeps stable sort across TZ)
  return new Date(d).toISOString().slice(0, 13) + ':00:00.000Z';
}

// Default efficiency if you don't inject your own.
// Replace with your real formula if you have item standards etc.
function defaultCalcEfficiency(runtimeMs, validCount) {
  if (!runtimeMs) return 0;
  // counts per hour scaled to [0..1] assuming 600 cph is ~100% (tune this)
  const cph = validCount * (3_600_000 / runtimeMs);
  return Math.min(1, cph / 600);
}

// ---------- 1) Item Hourly Stack ----------
/**
 * @param {Array<{_id:{item:string,hour:Date},count:number}>} itemHourlyStackRaw
 * @returns {{ title: string, data: { hours: string[], operators: Record<string, number[]> } }}
 */
function reshapeItemHourly(itemHourlyStackRaw) {
  const hourSet = new Set();
  const perItem = new Map();

  for (const row of itemHourlyStackRaw) {
    const item = row._id.item ?? 'Unknown';
    const hourKey = isoHour(row._id.hour);
    hourSet.add(hourKey);
    if (!perItem.has(item)) perItem.set(item, new Map());
    perItem.get(item).set(hourKey, row.count);
  }

  const hours = Array.from(hourSet).sort(); // ISO hours ascending
  const operators = {};
  for (const [item, m] of perItem) {
    operators[item] = hours.map(h => m.get(h) ?? 0);
  }

  return {
    title: 'Item Counts by Hour (All Machines)',
    data: { hours, operators }
  };
}

// ---------- 2) Top Operators ----------
/**
 * @param {Array<{id:number,name?:string,runtime:number}>} operatorRuntime  // from states facet
 * @param {Array<{id:number,name?:string,validCount:number}>} operatorCounts // from counts facet
 * @param {(runtimeMs:number, validCount:number)=>number} [calcEfficiencyFn] // return 0..1
 */
function buildTopOperators(operatorRuntime, operatorCounts, calcEfficiencyFn = defaultCalcEfficiency) {
  const countsById = new Map(operatorCounts.map(o => [Number(o.id), o]));
  const rows = [];

  for (const r of operatorRuntime) {
    const id = Number(r.id);
    const c = countsById.get(id) || { validCount: 0, name: r.name };
    const runtime = r.runtime || 0;
    const valid = c.validCount || 0;
    const eff01 = calcEfficiencyFn(runtime, valid);

    rows.push({
      id,
      name: c.name || r.name || 'Unknown',
      efficiency: +(eff01 * 100).toFixed(2),
      metrics: {
        runtime: { total: runtime, formatted: formatDuration(runtime) },
        output: { totalCount: valid, validCount: valid, misfeedCount: 0 }
      }
    });
  }

  rows.sort((a, b) => b.efficiency - a.efficiency);
  return rows.slice(0, 10);
}

// ---------- 3) Plantwide Hourly (weighted by runtime) ----------
/**
 * @param {Array<{serial:number,hour:Date,runtimeMs:number,runMs:number}>} hourlyRuntimeByMachine
 * @param {Array<{serial:number,hour:Date,valid:number}>} countsByMachineHour
 * @param {Array<{serial:number,hour:Date,misfeed:number}>} [misfeedsByMachineHour=[]]
 * @param {(runtimeMs:number, validCount:number)=>number} [calcEfficiencyFn]
 * @returns {Array<{hour:number,availability:number,efficiency:number,throughput:number,oee:number}>}
 */
function buildPlantwideHourly(
  hourlyRuntimeByMachine,
  countsByMachineHour,
  misfeedsByMachineHour = [],
  calcEfficiencyFn = defaultCalcEfficiency
) {
  // index counts/misfeeds by serial|hourKey
  const key = (serial, hour) => serial + '|' + isoHour(hour);
  const countsIdx = new Map();
  for (const r of countsByMachineHour) {
    countsIdx.set(key(r.serial, r.hour), r.valid || 0);
  }
  const misIdx = new Map();
  for (const r of misfeedsByMachineHour) {
    misIdx.set(key(r.serial, r.hour), r.misfeed || 0);
  }

  // group runtime by hourKey then aggregate with weights
  const byHour = new Map(); // hourKey -> array of machine rows in that hour
  for (const r of hourlyRuntimeByMachine) {
    const hourKey = isoHour(r.hour);
    if (!byHour.has(hourKey)) byHour.set(hourKey, []);
    byHour.get(hourKey).push(r);
  }

  const out = [];
  for (const [hourKey, rows] of byHour) {
    let totalRuntime = 0;
    let wAvail = 0, wEff = 0, wThru = 0, wOee = 0;

    for (const r of rows) {
      const k = key(r.serial, hourKey);
      const runtime = r.runtimeMs || 0;
      if (!runtime) continue;

      const runMs = r.runMs || 0;
      const valid = countsIdx.get(k) || 0;
      const mis = misIdx.get(k) || 0;
      const hourWindowMs = 3_600_000;

      const availability = hourWindowMs ? (runMs / hourWindowMs) : 0;             // 0..1
      const throughput   = (valid + mis) > 0 ? (valid / (valid + mis)) : 0;       // 0..1
      const efficiency   = calcEfficiencyFn(runtime, valid);                       // 0..1
      const oee          = availability * efficiency * throughput;                 // 0..1

      totalRuntime += runtime;
      wAvail += availability * runtime;
      wEff   += efficiency   * runtime;
      wThru  += throughput   * runtime;
      wOee   += oee          * runtime;
    }

    if (totalRuntime > 0) {
      out.push({
        hour: new Date(hourKey).getHours(),
        availability: +( (wAvail / totalRuntime) * 100 ).toFixed(2),
        efficiency:   +( (wEff   / totalRuntime) * 100 ).toFixed(2),
        throughput:   +( (wThru  / totalRuntime) * 100 ).toFixed(2),
        oee:          +( (wOee   / totalRuntime) * 100 ).toFixed(2)
      });
    }
  }

  // sort by hour ascending just in case
  out.sort((a, b) => a.hour - b.hour);
  return out;
}

// ---------- 4) Machine OEE from facet ----------
/**
 * @param {Array<{serial:number,name:string,run:number,pause:number,fault:number,totalRuntime:number}>} machineOeeBase
 */
function shapeMachineOee(machineOeeBase) {
  const list = machineOeeBase.map(m => {
    const total = m.totalRuntime || (m.run + m.pause + m.fault) || 0;
    const oee = total ? (m.run / total) * 100 : 0;
    return { serial: m.serial, name: m.name || 'Unknown', oee: +oee.toFixed(2) };
  });
  list.sort((a, b) => b.oee - a.oee);
  return list;
}

  

  router.get('/analytics/daily-dashboard/full', async (req, res) => {
    try {
      // Validate database connection
      if (!db) {
        return res.status(500).json({ 
          error: "Database connection not available",
          details: "Server configuration error"
        });
      }

      const { start, end } = parseAndValidateQueryParams(req);
      const { paddedStart, paddedEnd } = createPaddedTimeRange(start, end);
      
      const TZ = "America/Chicago";
  
      // Create aggregation pipelines with proper variable scope
      const statesAgg = [
        {$match: { timestamp: {$gte: paddedStart, $lte: paddedEnd} }},
        {$set: {
          code: "$status.code",
          serial: "$machine.serial"
        }},
        {$setWindowFields: {
          partitionBy: "$serial",
          sortBy: { timestamp: 1 },
          output: {
            nextTs: { $shift: { output: "$timestamp", by:  -1 } }
          }
        }},
        // duration = min(next, paddedEnd) - currentTs; ignore last open record by clamping
        {$set: {
          durRaw: { $subtract: [ { $ifNull: ["$nextTs", paddedEnd] }, "$timestamp" ] },
          tsClamped: { $max: [ "$timestamp", paddedStart ] },
          endClamped: { $min: [ { $ifNull: ["$nextTs", paddedEnd] }, paddedEnd ] }
        }},
        {$set: {
          dur: { $max: [ 0, { $subtract: [ "$endClamped", "$tsClamped" ] } ] },
          hour: { $dateTrunc: { date: "$timestamp", unit: "hour", timezone: TZ } },
          bucket: {
            $switch: {
              branches: [
                { case: { $eq: ["$code", 1] }, then: "running" },
                { case: { $eq: ["$code", 0] }, then: "paused" }
              ],
              default: "fault"
            }
          }
        }},
        {$match: { dur: { $gt: 0 } }},
        {$facet: {
          // a) machine status totals (ms by state per machine)
          machineStatus: [
            {$group: {
              _id: { serial: "$serial", bucket: "$bucket" },
              ms: { $sum: "$dur" },
              name: { $first: "$machine.name" }
            }},
            {$group: {
              _id: "$_id.serial",
              name: { $first: "$name" },
              runningMs: {$sum: {$cond:[{$eq:["$_id.bucket","running"]},"$ms",0]}},
              pausedMs:  {$sum: {$cond:[{$eq:["$_id.bucket","paused"]},"$ms",0]}},
              faultedMs: {$sum: {$cond:[{$eq:["$_id.bucket","fault"]},"$ms",0]}}
            }},
            {$project: {
              _id: 0, serial: "$_id", name: {$ifNull:["$name","Unknown"]},
              runningMs:1, pausedMs:1, faultedMs:1
            }}
          ],

          // b) per-machine OEE components
          machineOeeBase: [
            {$group: {
              _id: { serial: "$serial", bucket: "$bucket" },
              ms: { $sum: "$dur" },
              name: { $first: "$machine.name" }
            }},
            {$group: {
              _id: "$_id.serial",
              name: { $first: "$name" },
              run: {$sum: {$cond:[{$eq:["$_id.bucket","running"]},"$ms",0]}},
              pause:{$sum: {$cond:[{$eq:["$_id.bucket","paused"]},"$ms",0]}},
              fault:{$sum: {$cond:[{$eq:["$_id.bucket","fault"]},"$ms",0]}}
            }},
            {$project: {
              _id:0, serial:"$_id", name: {$ifNull:["$name","Unknown"]},
              run:1, pause:1, fault:1,
              totalRuntime: { $add: ["$run","$pause","$fault"] }
            }}
          ],

          // c) hourly runtime per machine (for plantwide weighting)
          hourlyRuntimeByMachine: [
            {$group: {
              _id: { serial: "$serial", hour: "$hour", bucket: "$bucket" },
              ms: { $sum: "$dur" }
            }},
            {$group: {
              _id: { serial: "$_id.serial", hour: "$_id.hour" },
              runMs: {$sum: {$cond:[{$eq:["$_id.bucket","running"]},"$ms",0]}},
              pauseMs:{$sum: {$cond:[{$eq:["$_id.bucket","paused"]},"$ms",0]}},
              faultMs:{$sum: {$cond:[{$eq:["$_id.bucket","fault"]},"$ms",0]}}
            }},
            {$project: {
              _id:0,
              serial:"$_id.serial",
              hour:"$_id.hour",
              runtimeMs: { $add: ["$runMs","$pauseMs","$faultMs"] },
              runMs:1
            }}
          ],

          // d) operator runtime (if states carry operator id)
          operatorRuntime: [
            {$match: { "operator.id": { $exists: true, $ne: -1 } }},
            {$group: { _id: "$operator.id", runtime: { $sum: "$dur" }, name: { $first: "$operator.name" } }},
            {$project: { _id:0, id:"$_id", name: {$ifNull:["$name","Unknown"]}, runtime:1 }}
          ]
        }}
      ];

      const countsAgg = [
        {$match: {
          timestamp: {$gte: start, $lte: end},
          misfeed: { $ne: true },
          'operator.id': { $exists: true, $ne: -1 }
        }},
        {$set: {
          itemName: { $ifNull: ["$item.name", "Unknown"] },
          hour: { $dateTrunc: { date: "$timestamp", unit: "hour", timezone: TZ } },
          day:  { $dateTrunc: { date: "$timestamp", unit: "day",  timezone: TZ } },
          serial: "$machine.serial"
        }},
        {$facet: {
          // a) item hourly stack (All machines)
          itemHourlyStackRaw: [
            {$group: { _id: { item: "$itemName", hour: "$hour" }, count: { $sum: 1 } }},
            {$sort: { "_id.item": 1, "_id.hour": 1 }}
          ],
      
          // b) daily count totals (last 28 days ending at 'end')
          last28Days: [
            {$match: { /* keep same match; 'end' already constrained */ }},
            {$group: { _id: "$day", count: { $sum: 1 } }},
            {$sort: { "_id": 1 }},
            {$project: { _id:0, date: "$_id", count:1 }}
          ],
      
          // c) operator counts
          operatorCounts: [
            {$group: {
              _id: "$operator.id",
              name: { $first: "$operator.name" },
              validCount: { $sum: 1 }
            }},
            {$project: { _id:0, id:"$_id", name: {$ifNull:["$name","Unknown"]}, validCount:1 }}
          ],
      
          // d) per-machine, per-hour counts (for plantwide metrics)
          countsByMachineHour: [
            {$group: {
              _id: { serial: "$serial", hour: "$hour" },
              valid: { $sum: 1 }
            }},
            {$project: { _id:0, serial:"$_id.serial", hour:"$_id.hour", valid:1 }}
          ],
      
          // e) per-machine, per-hour misfeeds (if you need throughput = valid/(valid+misfeed))
          misfeedsByMachineHour: [
            {$match: { misfeed: true }}, // NOTE: run a **second** counts query OR use $unionWith
            {$set: { hour: { $dateTrunc: { date: "$timestamp", unit:"hour", timezone: TZ } }, serial: "$machine.serial" }},
            {$group: { _id: { serial:"$serial", hour:"$hour" }, misfeed: { $sum: 1 } }},
            {$project: { _id:0, serial:"$_id.serial", hour:"$_id.hour", misfeed:1 }}
          ]
        }}
      ];

      // Execute aggregation queries with timeout
      const aggregationOptions = { 
        allowDiskUse: true,
        maxTimeMS: 300000 // 5 minute timeout
      };

      const [stateFacets] = await db.collection('state')
        .aggregate(statesAgg, aggregationOptions)
        .toArray();
  
      const [countFacets] = await db.collection('count')
        .aggregate(countsAgg, aggregationOptions)
        .toArray();
  
      // Validate aggregation results
      if (!stateFacets || !countFacets) {
        return res.status(500).json({ 
          error: "Failed to retrieve data from database",
          details: "Aggregation returned null results"
        });
      }
  
    
      const machineStatus = stateFacets.machineStatus || [];
  
      const machineOee = (stateFacets.machineOeeBase || [])
        .map(m => ({
          serial: m.serial,
          name: m.name,
          oee: m.totalRuntime ? +( (m.run / m.totalRuntime) * 100 ).toFixed(2) : 0
        }))
        .sort((a,b) => b.oee - a.oee);
  
      const itemHourlyStack = reshapeItemHourly(countFacets.itemHourlyStackRaw || []); // fill zeros once
  
      const topOperators = buildTopOperators(
        stateFacets.operatorRuntime || [],
        countFacets.operatorCounts || []
      ); // compute efficiency %, slice 10
  
      const plantwideMetrics = buildPlantwideHourly(
        stateFacets.hourlyRuntimeByMachine || [],
        countFacets.countsByMachineHour || [],
        /* optional */ countFacets.misfeedsByMachineHour || []
      );
  
      const dailyCounts = (countFacets.last28Days || []).map(d => ({
        date: d.date.toISOString().split('T')[0],
        count: d.count
      }));
  
      return res.json({
        timeRange: { start, end, total: formatDuration(new Date(end) - new Date(start)) },
        machineStatus,
        machineOee,
        itemHourlyStack,
        topOperators,
        plantwideMetrics,
        dailyCounts
      });
    } catch (err) {
      logger.error(`Error in ${req.method} ${req.originalUrl}:`, err);
      
      res.status(500).json({ 
        error: "Failed to fetch full daily dashboard data",
        details: process.env.NODE_ENV === 'development' ? err.message : undefined
      });
    }
  });
  




  
// Bookending for daily-dashboard/full
// router.get('/analytics/daily-dashboard/full', async (req, res) => {
//   try {
//     const { start, end } = parseAndValidateQueryParams(req);
//     const bookended = await getBookendedStatesAndTimeRange(db, start, end);
//     if (!bookended) {
//       return res.status(200).json({
//         timeRange: { start, end },
//         machineStatus: [],
//         machineOee: [],
//         itemHourlyStack: [],
//         topOperators: [],
//         plantwideMetrics: [],
//         dailyCounts: []
//       });
//     }

//     const { sessionStart, sessionEnd } = bookended;

//     const [
//       machineStatus,
//       machineOee,
//       itemHourlyStack,
//       topOperators,
//       plantwideMetrics,
//       dailyCounts
//     ] = await Promise.all([
//       buildDailyMachineStatus(db, sessionStart, sessionEnd),
//       buildMachineOEE(db, sessionStart, sessionEnd),
//       buildDailyItemHourlyStack(db, sessionStart, sessionEnd),
//       buildTopOperatorEfficiency(db, sessionStart, sessionEnd),
//       buildPlantwideMetricsByHour(db, sessionStart, sessionEnd),
//       buildDailyCountTotals(db, sessionStart, sessionEnd)
//     ]);

//     return res.json({
//       timeRange: { start: sessionStart, end: sessionEnd, total: formatDuration(new Date(sessionEnd) - new Date(sessionStart)) },
//       machineStatus,
//       machineOee,
//       itemHourlyStack,
//       topOperators,
//       plantwideMetrics,
//       dailyCounts
//     });
//   } catch (error) {
//     logger.error("Error in /daily-dashboard/full:", error);
//     res.status(500).json({ error: "Failed to fetch full daily dashboard data" });
//   }
// });

//Bookending for daily-dashboard/full

  router.get('/analytics/daily-dashboard/daily-counts', async (req, res) => {
    try {
      const { start, end } = parseAndValidateQueryParams(req);
      const dailyCounts = await buildDailyCountTotals(db, start, end);
      
      return res.json({
        timeRange: { start, end, total: formatDuration(new Date(end) - new Date(start)) },
        dailyCounts
      });
    } catch (error) {
      logger.error(`Error in ${req.method} ${req.originalUrl}:`, error);
      res.status(500).json({ error: "Failed to fetch daily count totals" });
    }
  });
  
  // router.get("/analytics/daily-summary-dashboard", async (req, res) => {
  //   try {
  //     const queryStartTime = Date.now();
  //     const { start, end, serial } = parseAndValidateQueryParams(req);
  //     const { paddedStart, paddedEnd } = createPaddedTimeRange(start, end);
  
  //     const targetSerials = serial ? [parseInt(serial)] : [];

  //     // ✅ MACHINE SECTION
  //     const machineGroupedData = await fetchGroupedAnalyticsData(
  //       db,
  //       paddedStart,
  //       paddedEnd,
  //       "machine",
  //       { targetSerials }
  //     );

  //     const machineResults = [];

  //     for (const [serial, group] of Object.entries(machineGroupedData)) {
  //       const machineSerial = parseInt(serial);
  //       const { states, counts } = group;

  //       if (!states.length) continue;

  //       const performance = await buildMachinePerformance(
  //         states,
  //         counts.valid,
  //         counts.misfeed,
  //         start,
  //         end
  //       );
  //       const itemSummary = buildMachineItemSummary(states, counts.valid, start, end);
  //       const itemHourlyStack = buildItemHourlyStack(counts.valid, start, end);
  //       const faultData = buildFaultData(states, start, end);
  //       const operatorEfficiency = await buildOperatorEfficiency(states, counts.valid, start, end, machineSerial);

  //       const latestState = states[states.length - 1];
  //       const machineName = latestState.machine?.name || 'Unknown';
  //       const statusCode = latestState.status?.code || 0;
  //       const statusName = latestState.status?.name || 'Unknown';

  //       machineResults.push({
  //         machine: {
  //           serial: machineSerial,
  //           name: machineName
  //         },
  //         currentStatus: {
  //           code: statusCode,
  //           name: statusName
  //         },
  //         performance,
  //         itemSummary,
  //         itemHourlyStack,
  //         faultData,
  //         operatorEfficiency
  //       });
  //     }

  //     // === Operators ===
  //     const operatorGroupedData = await fetchGroupedAnalyticsData(
  //       db,
  //       paddedStart,
  //       paddedEnd,
  //       "operator"
  //     );

  //     const operatorResults = [];

  //     for (const [operatorId, group] of Object.entries(operatorGroupedData)) {
  //       const numericOperatorId = parseInt(operatorId);
  //       const { states, counts } = group;

  //       if (!states.length && !counts.all.length) continue;

  //       const performance = await buildOperatorPerformance(
  //         states,
  //         counts.valid,
  //         counts.misfeed,
  //         start,
  //         end
  //       );

  //       const countByItem = await buildOperatorCountByItem(group, start, end);

  //       const operatorName =
  //         counts.valid[0]?.operator?.name ||
  //         counts.all[0]?.operator?.name ||
  //         "Unknown";

  //       const latest = states[states.length - 1] || {};

  //       operatorResults.push({
  //         operator: { 
  //           id: numericOperatorId, 
  //           name: operatorName 
  //         },
  //         currentStatus: {
  //           code: latest.status?.code || 0,
  //           name: latest.status?.name || "Unknown",
  //         },
  //         metrics: {
  //           runtime: {
  //             total: performance.runtime.total,
  //             formatted: performance.runtime.formatted
  //           },
  //           performance: {
  //             efficiency: {
  //               value: performance.performance.efficiency.value,
  //               percentage: performance.performance.efficiency.percentage
  //             }
  //           }
  //         },
  //         countByItem
  //       });
  //     }
  
  //     // === Items ===
  //     const items = [];
  //     for (const machineResult of machineResults) {
  //       const machineSerial = machineResult.machine.serial;
  //       const machineStates = await fetchStatesForMachine(db, machineSerial, paddedStart, paddedEnd);
  //       const machineCounts = await getCountsForMachine(db, machineSerial, paddedStart, paddedEnd);
  //       const runCycles = extractAllCyclesFromStates(machineStates, start, end).running;

  //       const machineSummary = {
  //         totalCount: 0,
  //         totalWorkedMs: 0,
  //         itemSummaries: {}
  //       };

  //       for (const cycle of runCycles) {
  //         const cycleStart = new Date(cycle.start);
  //         const cycleEnd = new Date(cycle.end);
  //         const cycleMs = cycleEnd - cycleStart;

  //         const cycleCounts = machineCounts.filter(c => {
  //           const ts = new Date(c.timestamp);
  //           return ts >= cycleStart && ts <= cycleEnd;
  //         });

  //         if (!cycleCounts.length) continue;

  //         const operators = new Set(cycleCounts.map(c => c.operator?.id).filter(Boolean));
  //         const workedTimeMs = cycleMs * Math.max(1, operators.size);

  //         const itemGroups = groupCountsByItem(cycleCounts);

  //         for (const [itemId, group] of Object.entries(itemGroups)) {
  //           const countTotal = group.length;
  //           const standard = group[0].item?.standard > 0 ? group[0].item.standard : 666;
  //           const name = group[0].item?.name || "Unknown";

  //           if (!machineSummary.itemSummaries[itemId]) {
  //             machineSummary.itemSummaries[itemId] = {
  //               count: 0,
  //               standard,
  //               workedTimeMs: 0,
  //               name
  //             };
  //           }

  //           machineSummary.itemSummaries[itemId].count += countTotal;
  //           machineSummary.itemSummaries[itemId].workedTimeMs += workedTimeMs;
  //           machineSummary.totalCount += countTotal;
  //           machineSummary.totalWorkedMs += workedTimeMs;
  //         }
  //       }

  //       // Add per-item formatted metrics
  //       Object.entries(machineSummary.itemSummaries).forEach(([itemId, summary]) => {
  //         const workedTimeFormatted = formatDuration(summary.workedTimeMs);
  //         const totalHours = summary.workedTimeMs / 3600000;
  //         const pph = totalHours > 0 ? summary.count / totalHours : 0;
  //         const efficiency = summary.standard > 0 ? pph / summary.standard : 0;

  //         items.push({
  //           itemName: summary.name,
  //           workedTimeFormatted,
  //           count: summary.count,
  //           pph: Math.round(pph * 100) / 100,
  //           standard: summary.standard,
  //           efficiency: Math.round(efficiency * 10000) / 100
  //         });
  //       });
  //     }
  
  //     res.json({
  //       timeRange: { start, end, total: formatDuration(Date.now() - queryStartTime) },
  //       machineResults,
  //       operatorResults,
  //       items
  //     });
  //   } catch (error) {
  //     logger.error("Error in /analytics/daily-summary-dashboard:", error);
  //     res.status(500).json({ error: "Failed to generate daily summary dashboard" });
  //   }
  // });
  
  // router.get("/analytics/daily-summary-dashboard", async (req, res) => {
  //   try {
  //     const queryStartTime = Date.now();
  //     const { start, end, serial } = parseAndValidateQueryParams(req);
  //     const { paddedStart, paddedEnd } = createPaddedTimeRange(start, end);
  //     const targetSerials = serial ? [parseInt(serial)] : [];
  
  //     // === MACHINE DATA ===
  //     const machineGroupedData = await fetchGroupedAnalyticsData(
  //       db,
  //       paddedStart,
  //       paddedEnd,
  //       "machine",
  //       { targetSerials }
  //     );
  
  //     const machineResults = await Promise.all(
  //       Object.entries(machineGroupedData).map(async ([serial, group]) => {
  //         const machineSerial = parseInt(serial);
  //         const { states, counts } = group;
  
  //         if (!states.length) return null;
  
  //         const performance = await buildMachinePerformance(
  //           states,
  //           counts.valid,
  //           counts.misfeed,
  //           start,
  //           end
  //         );
  //         const itemSummary = buildMachineItemSummary(states, counts.valid, start, end);
  //         const itemHourlyStack = buildItemHourlyStack(counts.valid, start, end);
  //         const faultData = buildFaultData(states, start, end);
  //         const operatorEfficiency = await buildOperatorEfficiency(states, counts.valid, start, end, machineSerial);
  
  //         const latestState = states[states.length - 1];
  //         const machineName = latestState.machine?.name || "Unknown";
  //         const statusCode = latestState.status?.code || 0;
  //         const statusName = latestState.status?.name || "Unknown";
  
  //         return {
  //           machine: { serial: machineSerial, name: machineName },
  //           currentStatus: { code: statusCode, name: statusName },
  //           performance,
  //           itemSummary,
  //           itemHourlyStack,
  //           faultData,
  //           operatorEfficiency
  //         };
  //       })
  //     );
  
  //     // === OPERATOR DATA ===
  //     const operatorGroupedData = await fetchGroupedAnalyticsData(
  //       db,
  //       paddedStart,
  //       paddedEnd,
  //       "operator"
  //     );
  
  //     const operatorResults = await Promise.all(
  //       Object.entries(operatorGroupedData).map(async ([operatorId, group]) => {
  //         const numericOperatorId = parseInt(operatorId);
  //         const { states, counts } = group;
  
  //         if (!states.length && !counts.all.length) return null;
  
  //         const performance = await buildOperatorPerformance(
  //           states,
  //           counts.valid,
  //           counts.misfeed,
  //           start,
  //           end
  //         );
  
  //         const countByItem = await buildOperatorCountByItem(group, start, end);
  
  //         const operatorName =
  //           counts.valid[0]?.operator?.name ||
  //           counts.all[0]?.operator?.name ||
  //           "Unknown";
  
  //         const latest = states[states.length - 1] || {};
  
  //         return {
  //           operator: { id: numericOperatorId, name: operatorName },
  //           currentStatus: {
  //             code: latest.status?.code || 0,
  //             name: latest.status?.name || "Unknown"
  //           },
  //           metrics: {
  //             runtime: {
  //               total: performance.runtime.total,
  //               formatted: performance.runtime.formatted
  //             },
  //             performance: {
  //               efficiency: {
  //                 value: performance.performance.efficiency.value,
  //                 percentage: performance.performance.efficiency.percentage
  //               }
  //             }
  //           },
  //           countByItem
  //         };
  //       })
  //     );
  
  //     // === ITEM DATA ===
  //     const items = [];
  
  //     await Promise.all(
  //       Object.entries(machineGroupedData).map(async ([serial, group]) => {
  //         const machineSerial = parseInt(serial);
  //         const machineStates = group.states;
  //         const machineCounts = group.counts.valid;
  
  //         const runCycles = extractAllCyclesFromStates(machineStates, start, end).running;
  
  //         const machineSummary = {
  //           totalCount: 0,
  //           totalWorkedMs: 0,
  //           itemSummaries: {}
  //         };
  
  //         for (const cycle of runCycles) {
  //           const cycleStart = new Date(cycle.start);
  //           const cycleEnd = new Date(cycle.end);
  //           const cycleMs = cycleEnd - cycleStart;
  
  //           const cycleCounts = machineCounts.filter(c => {
  //             const ts = new Date(c.timestamp);
  //             return ts >= cycleStart && ts <= cycleEnd;
  //           });
  
  //           if (!cycleCounts.length) continue;
  
  //           const operators = new Set(cycleCounts.map(c => c.operator?.id).filter(Boolean));
  //           const workedTimeMs = cycleMs * Math.max(1, operators.size);
  
  //           const itemGroups = groupCountsByItem(cycleCounts);
  
  //           for (const [itemId, group] of Object.entries(itemGroups)) {
  //             const countTotal = group.length;
  //             const standard = group[0].item?.standard > 0 ? group[0].item.standard : 666;
  //             const name = group[0].item?.name || "Unknown";
  
  //             if (!machineSummary.itemSummaries[itemId]) {
  //               machineSummary.itemSummaries[itemId] = {
  //                 count: 0,
  //                 standard,
  //                 workedTimeMs: 0,
  //                 name
  //               };
  //             }
  
  //             machineSummary.itemSummaries[itemId].count += countTotal;
  //             machineSummary.itemSummaries[itemId].workedTimeMs += workedTimeMs;
  //             machineSummary.totalCount += countTotal;
  //             machineSummary.totalWorkedMs += workedTimeMs;
  //           }
  //         }
  
  //         for (const summary of Object.values(machineSummary.itemSummaries)) {
  //           const workedTimeFormatted = formatDuration(summary.workedTimeMs);
  //           const totalHours = summary.workedTimeMs / 3600000;
  //           const pph = totalHours > 0 ? summary.count / totalHours : 0;
  //           const efficiency = summary.standard > 0 ? pph / summary.standard : 0;
  
  //           items.push({
  //             itemName: summary.name,
  //             workedTimeFormatted,
  //             count: summary.count,
  //             pph: Math.round(pph * 100) / 100,
  //             standard: summary.standard,
  //             efficiency: Math.round(efficiency * 10000) / 100
  //           });
  //         }
  //       })
  //     );
  
  //     res.json({
  //       timeRange: { start, end, total: formatDuration(Date.now() - queryStartTime) },
  //       machineResults: machineResults.filter(Boolean),
  //       operatorResults: operatorResults.filter(Boolean),
  //       items
  //     });
  //   } catch (error) {
  //     logger.error("Error in /analytics/daily-summary-dashboard:", error);
  //     res.status(500).json({ error: "Failed to generate daily summary dashboard" });
  //   }
  // });

  //Bookending for daily-summary-dashboard

  router.get("/analytics/daily-summary-dashboard", async (req, res) => {
    try {
      const queryStartTime = Date.now();
      const { start, end, serial } = parseAndValidateQueryParams(req);
      const targetSerials = serial ? [parseInt(serial)] : await db.collection("machine").distinct("serial");
  
      const machineResults = [];
      const items = [];
  
      for (const machineSerial of targetSerials) {
        const bookended = await getBookendedStatesAndTimeRange(db, machineSerial, start, end);
        if (!bookended) continue;
  
        const { sessionStart, sessionEnd, states } = bookended;
        const counts = await getValidCounts(db, machineSerial, sessionStart, sessionEnd);
        const misfeeds = await getMisfeedCounts(db, machineSerial, sessionStart, sessionEnd);
  
        // ========== MACHINE RESULTS ==========
        const performance = await buildMachinePerformance(states, counts, misfeeds, sessionStart, sessionEnd);
        const itemSummary = buildMachineItemSummary(states, counts, sessionStart, sessionEnd);
        const itemHourlyStack = buildItemHourlyStack(counts, sessionStart, sessionEnd);
        const faultData = buildFaultData(states, sessionStart, sessionEnd);
        const operatorEfficiency = await buildOperatorEfficiency(states, counts, sessionStart, sessionEnd, machineSerial);
  
        const latestState = states.at(-1);
        const machineName = latestState?.machine?.name || "Unknown";
        const statusCode = latestState?.status?.code || 0;
        const statusName = latestState?.status?.name || "Unknown";
  
        machineResults.push({
          machine: { serial: machineSerial, name: machineName },
          currentStatus: { code: statusCode, name: statusName },
          performance,
          itemSummary,
          itemHourlyStack,
          faultData,
          operatorEfficiency
        });
  
        // ========== ITEM SUMMARY ==========
        const runCycles = extractAllCyclesFromStates(states, sessionStart, sessionEnd).running;
  
        const machineSummary = {
          totalCount: 0,
          totalWorkedMs: 0,
          itemSummaries: {}
        };
  
        for (const cycle of runCycles) {
          const cycleStart = new Date(cycle.start);
          const cycleEnd = new Date(cycle.end);
          const cycleMs = cycleEnd - cycleStart;
  
          const cycleCounts = counts.filter(c => {
            const ts = new Date(c.timestamp);
            return ts >= cycleStart && ts <= cycleEnd;
          });
          if (!cycleCounts.length) continue;
  
          const operators = new Set(cycleCounts.map(c => c.operator?.id).filter(Boolean));
          const workedTimeMs = cycleMs * Math.max(1, operators.size);
          const itemGroups = groupCountsByItem(cycleCounts);
  
          for (const [itemId, group] of Object.entries(itemGroups)) {
            const countTotal = group.length;
            const standard = group[0].item?.standard > 0 ? group[0].item.standard : 666;
            const name = group[0].item?.name || "Unknown";
  
            if (!machineSummary.itemSummaries[itemId]) {
              machineSummary.itemSummaries[itemId] = {
                count: 0,
                standard,
                workedTimeMs: 0,
                name
              };
            }
  
            machineSummary.itemSummaries[itemId].count += countTotal;
            machineSummary.itemSummaries[itemId].workedTimeMs += workedTimeMs;
            machineSummary.totalCount += countTotal;
            machineSummary.totalWorkedMs += workedTimeMs;
          }
        }
  
        for (const summary of Object.values(machineSummary.itemSummaries)) {
          const workedTimeFormatted = formatDuration(summary.workedTimeMs);
          const totalHours = summary.workedTimeMs / 3600000;
          const pph = totalHours > 0 ? summary.count / totalHours : 0;
          const efficiency = summary.standard > 0 ? pph / summary.standard : 0;
  
          items.push({
            itemName: summary.name,
            workedTimeFormatted,
            count: summary.count,
            pph: Math.round(pph * 100) / 100,
            standard: summary.standard,
            efficiency: Math.round(efficiency * 10000) / 100
          });
        }
      }
  
      // ========== OPERATOR RESULTS ==========
      const operatorGroupedData = await fetchGroupedAnalyticsData(db, start, end, "operator");
      const operatorResults = await Promise.all(
        Object.entries(operatorGroupedData).map(async ([operatorId, group]) => {
          const numericOperatorId = parseInt(operatorId);
          const { states, counts } = group;
  
          if (!states.length && !counts.all.length) return null;
  
          const performance = await buildOperatorPerformance(states, counts.valid, counts.misfeed, start, end);
          const countByItem = await buildOperatorCountByItem(group, start, end);
          const operatorName =
            counts.valid[0]?.operator?.name ||
            counts.all[0]?.operator?.name ||
            "Unknown";
  
          const latest = states.at(-1) || {};
  
          return {
            operator: { id: numericOperatorId, name: operatorName },
            currentStatus: {
              code: latest.status?.code || 0,
              name: latest.status?.name || "Unknown"
            },
            metrics: {
              runtime: {
                total: performance.runtime.total,
                formatted: performance.runtime.formatted
              },
              performance: {
                efficiency: {
                  value: performance.performance.efficiency.value,
                  percentage: performance.performance.efficiency.percentage
                }
              }
            },
            countByItem
          };
        })
      );
  
      res.json({
        timeRange: { start, end, total: formatDuration(Date.now() - queryStartTime) },
        machineResults,
        operatorResults: operatorResults.filter(Boolean),
        items
      });
    } catch (error) {
      logger.error(`Error in ${req.method} ${req.originalUrl}:`, error);
      res.status(500).json({ error: "Failed to generate daily summary dashboard" });
    }
  });

  //Bookending for daily-summary-dashboard end




  

  return router;

}