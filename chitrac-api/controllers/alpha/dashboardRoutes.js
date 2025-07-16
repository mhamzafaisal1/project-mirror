const express = require("express");

module.exports = function (server) {
  const router = express.Router();
  const db = server.db;
  const logger = server.logger;

  // Utility imports
  const { parseAndValidateQueryParams, formatDuration } = require("../../utils/time");

  const {
    getBookendedStatesAndTimeRange,
  } = require("../../utils/bookendingBuilder");

  const { extractAllCyclesFromStates } = require("../../utils/state");

  const {
    buildMachinePerformance,
    buildMachineItemSummary,
    buildItemHourlyStack,
    buildFaultData,
    buildOperatorEfficiency,
  } = require("../../utils/machineDashboardBuilder");

  const {
    calculateDowntime,
    calculateAvailability,
    calculateEfficiency,
    calculateOEE,
    calculateThroughput,
    calculateTotalCount,
    calculateOperatorTimes,
    calculateMisfeeds,
  } = require("../../utils/analytics");

  const { getActiveMachineSerials, extractAllCyclesFromStatesForDashboard, formatItemSummaryFromAggregation, formatItemHourlyStackFromAggregation } = require("../../utils/machineFunctions");


  
//   router.get("/analytics/machine-dashboard-sessions", async (req, res) => {
//     try {
//       const { start, end } = parseAndValidateQueryParams(req);
//       const activeSerials = await getActiveMachineSerials(db, start, end);

//       const results = await Promise.all(
//         activeSerials.map(async (serial) => {
//           const bookended = await getBookendedStatesAndTimeRange(
//             db,
//             serial,
//             start,
//             end
//           );
//           if (!bookended) return null;

//           const { states, sessionStart, sessionEnd } = bookended;
//           const runSessions = extractAllCyclesFromStatesForDashboard(
//             states,
//             sessionStart,
//             sessionEnd
//           ).running;

//           if (!runSessions.length) return null;

//           const machineName = states.at(-1)?.machine?.name || "Unknown";
//           const statusCode = states.at(-1)?.status?.code || 0;
//           const statusName = states.at(-1)?.status?.name || "Unknown";

//           const sessionResults = await Promise.all(
//             runSessions.map(async (session) => {
//               const counts = await db
//                 .collection("count")
//                 .find({
//                   "machine.serial": serial,
//                   timestamp: { $gte: session.start, $lte: session.end },
//                 })
//                 .project({
//                   timestamp: 1,
//                   "machine.serial": 1,
//                   "operator.id": 1,
//                   "operator.name": 1,
//                   "item.id": 1,
//                   "item.name": 1,
//                   "item.standard": 1,
//                   misfeed: 1,
//                 })
//                 .sort({ timestamp: 1 })
//                 .toArray();

//               const valid = counts.filter(
//                 (c) => !c.misfeed && c.operator?.id !== -1
//               );
//               const misfeed = counts.filter((c) => c.misfeed === true);

//               const [
//                 performance,
//                 itemSummary,
//                 itemHourlyStack,
//                 faultData,
//                 operatorEfficiency,
//               ] = await Promise.all([
//                 buildMachinePerformance(
//                   states,
//                   valid,
//                   misfeed,
//                   session.start,
//                   session.end
//                 ),
//                 buildMachineItemSummary(
//                   states,
//                   valid,
//                   session.start,
//                   session.end
//                 ),
//                 buildItemHourlyStack(valid, session.start, session.end),
//                 buildFaultData(states, session.start, session.end),
//                 buildOperatorEfficiency(
//                   states,
//                   valid,
//                   session.start,
//                   session.end,
//                   serial
//                 ),
//               ]);

//               return {
//                 sessionStart: session.start,
//                 sessionEnd: session.end,
//                 performance,
//                 itemSummary,
//                 itemHourlyStack,
//                 faultData,
//                 operatorEfficiency,
//               };
//             })
//           );

//           return {
//             machine: {
//               serial,
//               name: machineName,
//             },
//             currentStatus: {
//               code: statusCode,
//               name: statusName,
//             },
//             sessions: sessionResults.filter(Boolean),
//           };
//         })
//       );

//         res.json(results.filter(Boolean));
//     //   res.json(activeSerials);
//     } catch (err) {
//       logger.error(`Error in ${req.method} ${req.originalUrl}:`, err);
//       res
//         .status(500)
//         .json({
//           error: "Failed to fetch session-based machine dashboard data",
//         });
//     }
//   });

// Route for machine dashboard sessions for entire time range

router.get("/analytics/machine-dashboard-sessions", async (req, res) => {
    try {
      const { start, end } = parseAndValidateQueryParams(req);
      const activeSerials = await getActiveMachineSerials(db, start, end);
      const results = await Promise.all(
        activeSerials.map(async (serial) => {
          const bookended = await getBookendedStatesAndTimeRange(
            db,
            serial,
            start,
            end
          );
          if (!bookended) return null;

          const { states, sessionStart, sessionEnd } = bookended;
          const machineName = states.at(-1)?.machine?.name || "Unknown";
          const statusCode = states.at(-1)?.status?.code || 0;
          const statusName = states.at(-1)?.status?.name || "Unknown";

          // Aggregate analytics for the entire time range (not per session)
          const [aggResult] = await db.collection("count").aggregate([
            { $match: {
                "machine.serial": serial,
                timestamp: { $gte: sessionStart, $lte: sessionEnd }
            }},
            { $facet: {
                performance: [
                  { $match: { misfeed: { $ne: true }, "operator.id": { $ne: -1 } } },
                  { $count: "totalCount" }
                ],
                misfeeds: [
                  { $match: { misfeed: true } },
                  { $count: "misfeedCount" }
                ],
                itemSummary: [
                  { $match: { misfeed: { $ne: true }, "operator.id": { $ne: -1 } } },
                  { $group: {
                      _id: "$item.id",
                      name: { $first: "$item.name" },
                      standard: { $first: "$item.standard" },
                      count: { $sum: 1 }
                  }}
                ],
                hourlyStack: [
                  { $match: { misfeed: { $ne: true }, "operator.id": { $ne: -1 } } },
                  { $project: {
                      hour: { $hour: "$timestamp" },
                      itemId: "$item.id"
                  }},
                  { $group: {
                      _id: { hour: "$hour", itemId: "$itemId" },
                      count: { $sum: 1 }
                  }},
                  { $project: {
                      hour: "$_id.hour",
                      itemId: "$_id.itemId",
                      count: 1,
                      _id: 0
                  }}
                ],
                timeCredit: [
                  { $match: { misfeed: { $ne: true }, "operator.id": { $ne: -1 } } },
                  { $group: {
                      _id: { id: "$item.id", name: "$item.name" },
                      standard: { $first: "$item.standard" },
                      count: { $sum: 1 }
                  }},
                  { $addFields: {
                      standardPerHour: {
                        $cond: [
                          { $lt: ["$standard", 60] },
                          { $multiply: ["$standard", 60] },
                          "$standard"
                        ]
                      }
                  }},
                  { $addFields: {
                      timeCredit: {
                        $cond: [
                          { $gt: ["$standardPerHour", 0] },
                          { $divide: ["$count", { $divide: ["$standardPerHour", 3600] }] },
                          0
                        ]
                      }
                  }},
                  { $group: {
                      _id: null,
                      totalTimeCredit: { $sum: "$timeCredit" }
                  }}
                ]
            }}
          ]).toArray();

          const totalCount = aggResult.performance?.[0]?.totalCount || 0;
          const misfeedCount = aggResult.misfeeds?.[0]?.misfeedCount || 0;
          const totalTimeCredit = aggResult.timeCredit?.[0]?.totalTimeCredit || 0;
          const runtimeMs = extractAllCyclesFromStates(states, sessionStart, sessionEnd).running
            .reduce((sum, c) => sum + c.duration, 0);
          const totalQueryMs = new Date(sessionEnd) - new Date(sessionStart);
          const downtimeMs = totalQueryMs - runtimeMs;
          const runtimeSeconds = runtimeMs / 1000;

          const availability = calculateAvailability(runtimeMs, downtimeMs, totalQueryMs);
          const throughput = calculateThroughput(totalCount, misfeedCount);
          const efficiency = runtimeSeconds > 0 ? totalTimeCredit / runtimeSeconds : 0;
          const oee = calculateOEE(availability, efficiency, throughput);

          const performance = {
            runtime: { total: runtimeMs, formatted: formatDuration(runtimeMs) },
            downtime: { total: downtimeMs, formatted: formatDuration(downtimeMs) },
            output: { totalCount, misfeedCount },
            performance: {
              availability: { value: availability, percentage: (availability * 100).toFixed(2) + "%" },
              throughput: { value: throughput, percentage: (throughput * 100).toFixed(2) + "%" },
              efficiency: { value: efficiency, percentage: (efficiency * 100).toFixed(2) + "%" },
              oee: { value: oee, percentage: (oee * 100).toFixed(2) + "%" }
            }
          };

          const itemSummary = formatItemSummaryFromAggregation(aggResult.itemSummary || []);
          const itemHourlyStack = formatItemHourlyStackFromAggregation(aggResult.hourlyStack || []);

          const faultData = buildFaultData(states, sessionStart, sessionEnd); // still JS-based
          const operatorEfficiency = await buildOperatorEfficiency(states, [], sessionStart, sessionEnd, serial);

          return {
            machine: {
              serial,
              name: machineName
            },
            currentStatus: {
              code: statusCode,
              name: statusName
            },
            performance,
            itemSummary,
            itemHourlyStack,
            faultData,
            operatorEfficiency
          };
        })
      );

      res.json(results.filter(Boolean));
    } catch (err) {
      logger.error(`Error in ${req.method} ${req.originalUrl}:`, err);
      res
        .status(500)
        .json({
          error: "Failed to fetch session-based machine dashboard data",
        });
    }
  });

// Route for machine dashboard sessions for each session

// router.get("/analytics/machine-dashboard-sessions", async (req, res) => {
//     try {

//       const { start, end } = parseAndValidateQueryParams(req);
//       const activeSerials = await getActiveMachineSerials(db, start, end);
//       const results = await Promise.all(
//         activeSerials.map(async (serial) => {
//           const bookended = await getBookendedStatesAndTimeRange(
//             db,
//             serial,
//             start,
//             end
//           );
//           if (!bookended) return null;

//           const { states, sessionStart, sessionEnd } = bookended;
//           const runSessions = extractAllCyclesFromStatesForDashboard(
//             states,
//             sessionStart,
//             sessionEnd
//           ).running;

//           if (!runSessions.length) return null;

//           const machineName = states.at(-1)?.machine?.name || "Unknown";
//           const statusCode = states.at(-1)?.status?.code || 0;
//           const statusName = states.at(-1)?.status?.name || "Unknown";

//           const sessionResults = await Promise.all(
//             runSessions.map(async (session) => {
//               const [aggResult] = await db.collection("count").aggregate([
//                 { $match: {
//                     "machine.serial": serial,
//                     timestamp: { $gte: session.start, $lte: session.end }
//                 }},
//                 { $facet: {
//                     performance: [
//                       { $match: { misfeed: { $ne: true }, "operator.id": { $ne: -1 } } },
//                       { $count: "totalCount" }
//                     ],
//                     misfeeds: [
//                       { $match: { misfeed: true } },
//                       { $count: "misfeedCount" }
//                     ],
//                     itemSummary: [
//                       { $match: { misfeed: { $ne: true }, "operator.id": { $ne: -1 } } },
//                       { $group: {
//                           _id: "$item.id",
//                           name: { $first: "$item.name" },
//                           standard: { $first: "$item.standard" },
//                           count: { $sum: 1 }
//                       }}
//                     ],
//                     hourlyStack: [
//                       { $match: { misfeed: { $ne: true }, "operator.id": { $ne: -1 } } },
//                       { $project: {
//                           hour: { $hour: "$timestamp" },
//                           itemId: "$item.id"
//                       }},
//                       { $group: {
//                           _id: { hour: "$hour", itemId: "$itemId" },
//                           count: { $sum: 1 }
//                       }},
//                       { $project: {
//                           hour: "$_id.hour",
//                           itemId: "$_id.itemId",
//                           count: 1,
//                           _id: 0
//                       }}
//                     ],
//                     timeCredit: [
//                       { $match: { misfeed: { $ne: true }, "operator.id": { $ne: -1 } } },
//                       { $group: {
//                           _id: { id: "$item.id", name: "$item.name" },
//                           standard: { $first: "$item.standard" },
//                           count: { $sum: 1 }
//                       }},
//                       { $addFields: {
//                           standardPerHour: {
//                             $cond: [
//                               { $lt: ["$standard", 60] },
//                               { $multiply: ["$standard", 60] },
//                               "$standard"
//                             ]
//                           }
//                       }},
//                       { $addFields: {
//                           timeCredit: {
//                             $cond: [
//                               { $gt: ["$standardPerHour", 0] },
//                               { $divide: ["$count", { $divide: ["$standardPerHour", 3600] }] },
//                               0
//                             ]
//                           }
//                       }},
//                       { $group: {
//                           _id: null,
//                           totalTimeCredit: { $sum: "$timeCredit" }
//                       }}
//                     ]
//                 }}
//               ]).toArray();
  
//               const totalCount = aggResult.performance?.[0]?.totalCount || 0;
//               const misfeedCount = aggResult.misfeeds?.[0]?.misfeedCount || 0;
//               const totalTimeCredit = aggResult.timeCredit?.[0]?.totalTimeCredit || 0;
//               const runtimeMs = extractAllCyclesFromStates(states, session.start, session.end).running
//                 .reduce((sum, c) => sum + c.duration, 0);
//               const totalQueryMs = new Date(session.end) - new Date(session.start);
//               const downtimeMs = totalQueryMs - runtimeMs;
//               const runtimeSeconds = runtimeMs / 1000;
  
//               const availability = calculateAvailability(runtimeMs, downtimeMs, totalQueryMs);
//               const throughput = calculateThroughput(totalCount, misfeedCount);
//               const efficiency = runtimeSeconds > 0 ? totalTimeCredit / runtimeSeconds : 0;
//               const oee = calculateOEE(availability, efficiency, throughput);
  
//               const performance = {
//                 runtime: { total: runtimeMs, formatted: formatDuration(runtimeMs) },
//                 downtime: { total: downtimeMs, formatted: formatDuration(downtimeMs) },
//                 output: { totalCount, misfeedCount },
//                 performance: {
//                   availability: { value: availability, percentage: (availability * 100).toFixed(2) + "%" },
//                   throughput: { value: throughput, percentage: (throughput * 100).toFixed(2) + "%" },
//                   efficiency: { value: efficiency, percentage: (efficiency * 100).toFixed(2) + "%" },
//                   oee: { value: oee, percentage: (oee * 100).toFixed(2) + "%" }
//                 }
//               };
  
//               const itemSummary = formatItemSummaryFromAggregation(aggResult.itemSummary || []);
//               const itemHourlyStack = formatItemHourlyStackFromAggregation(aggResult.hourlyStack || []);
  
//               const faultData = buildFaultData(states, session.start, session.end); // still JS-based
//               const operatorEfficiency = await buildOperatorEfficiency(states, [], session.start, session.end, serial);
  
//               return {
//                 performance,
//                 itemSummary,
//                 itemHourlyStack,
//                 faultData,
//                 operatorEfficiency
//               };
//             })
//           );

//           // Aggregate all sessionResults into a single summary
//           const summary = sessionResults.reduce((acc, curr) => {
//             // Sum performance fields
//             if (!acc.performance) acc.performance = { ...curr.performance };
//             else {
//               acc.performance.runtime.total += curr.performance.runtime.total;
//               acc.performance.downtime.total += curr.performance.downtime.total;
//               acc.performance.output.totalCount += curr.performance.output.totalCount;
//               acc.performance.output.misfeedCount += curr.performance.output.misfeedCount;
//               // For percentages, you may want to recalculate after summing
//             }
//             // Merge itemSummary
//             if (!acc.itemSummary) acc.itemSummary = { ...curr.itemSummary };
//             else {
//               for (const key in curr.itemSummary) {
//                 if (!acc.itemSummary[key]) acc.itemSummary[key] = { ...curr.itemSummary[key] };
//                 else {
//                   acc.itemSummary[key].countTotal += curr.itemSummary[key].countTotal;
//                 }
//               }
//             }
//             // Merge itemHourlyStack (append data)
//             if (!acc.itemHourlyStack) acc.itemHourlyStack = Array.isArray(curr.itemHourlyStack) ? [...curr.itemHourlyStack] : curr.itemHourlyStack;
//             else if (Array.isArray(acc.itemHourlyStack) && Array.isArray(curr.itemHourlyStack)) {
//               acc.itemHourlyStack = acc.itemHourlyStack.concat(curr.itemHourlyStack);
//             }
//             // Merge faultData (object with arrays inside)
//             if (!acc.faultData) acc.faultData = { ...curr.faultData };
//             else {
//               // Merge faultCycles
//               acc.faultData.faultCycles = [
//                 ...(acc.faultData.faultCycles || []),
//                 ...(curr.faultData.faultCycles || [])
//               ];
//               // Merge faultSummaries by faultCode and faultType
//               const summaryMap = {};
//               for (const s of [...(acc.faultData.faultSummaries || []), ...(curr.faultData.faultSummaries || [])]) {
//                 const key = `${s.faultCode}_${s.faultType}`;
//                 if (!summaryMap[key]) summaryMap[key] = { ...s };
//                 else {
//                   summaryMap[key].totalDuration += s.totalDuration;
//                   summaryMap[key].count += s.count;
//                   // Optionally merge formatted, etc.
//                 }
//               }
//               acc.faultData.faultSummaries = Object.values(summaryMap);
//             }
//             // Merge operatorEfficiency
//             if (!acc.operatorEfficiency) acc.operatorEfficiency = { ...curr.operatorEfficiency };
//             else {
//               for (const key in curr.operatorEfficiency) {
//                 if (!acc.operatorEfficiency[key]) acc.operatorEfficiency[key] = { ...curr.operatorEfficiency[key] };
//                 else {
//                   acc.operatorEfficiency[key].count += curr.operatorEfficiency[key].count;
//                 }
//               }
//             }
//             return acc;
//           }, {});

//           // Limit the faultCycles array in the merged faultData to the first 100 records per machine in the final API response.
//           if (summary.faultData && Array.isArray(summary.faultData.faultCycles)) {
//             summary.faultData.faultCycles = summary.faultData.faultCycles.slice(0, 100);
//           }

//           return {
//             machine: {
//               serial,
//               name: machineName
//             },
//             currentStatus: {
//               code: statusCode,
//               name: statusName
//             },
//             ...summary
//           };
//         })
//       );
  
//       res.json(results.filter(Boolean));
//     //   res.json(activeSerials);
//     } catch (err) {
//       logger.error(`Error in ${req.method} ${req.originalUrl}:`, err);
//       res
//         .status(500)
//         .json({
//           error: `Failed to fetch machine dashboard data for ${req.url}`,
//         });
//     }
//   });


  return router;
};
