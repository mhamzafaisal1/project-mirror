const {
    extractAllCyclesFromStates,
    extractFaultCycles
  } = require("./state");




async function getActiveOperatorIds(db, start, end) {
    return await db.collection("state").distinct("operators.id", {
      timestamp: { $gte: new Date(start), $lte: new Date(end) },
      "operators.id": { $ne: -1 },
    });
  }
  
  async function getCountsForSessions(db, operatorId, sessions) {
    const orConditions = sessions.map(s => ({
      timestamp: { $gte: new Date(s.start), $lte: new Date(s.end) }
    }));
  
    return await db.collection("count")
      .find({
        $or: orConditions,
        "operator.id": operatorId,
      })
      .project({
        _id: 0,
        timestamp: 1,
        machine: 1,
        program: 1,
        operator: 1,
        item: 1,
        station: 1,
        lane: 1,
        misfeed: 1
      })
      .sort({ timestamp: 1 })
      .toArray();
  }
  
  
  function buildOperatorCyclePie(states, start, end) {
    const { running, paused, fault } = extractAllCyclesFromStates(states, start, end);
  
    const runTime = running.reduce((sum, c) => sum + c.duration, 0);
    const pauseTime = paused.reduce((sum, c) => sum + c.duration, 0);
    const faultTime = fault.reduce((sum, c) => sum + c.duration, 0);
    const total = runTime + pauseTime + faultTime || 1;
  
    return [
      {
        name: "Running",
        value: Math.round((runTime / total) * 100),
      },
      {
        name: "Paused",
        value: Math.round((pauseTime / total) * 100),
      },
      {
        name: "Faulted",
        value: Math.round((faultTime / total) * 100),
      },
    ];
  }

  function buildOptimizedOperatorFaultHistorySingle(operatorId, operatorName, machineSerial, machineName, states, start, end) {
    const { faultCycles, faultSummaries } = extractFaultCycles(states, new Date(start), new Date(end));
  
    const enrichedFaultCycles = faultCycles.map(cycle => ({
      ...cycle,
      machineName,
      machineSerial,
      operatorName,
      operatorId
    }));
  
    const summaryList = faultSummaries.map(summary => {
      const totalSeconds = Math.floor(summary.totalDuration / 1000);
      return {
        ...summary,
        formatted: {
          hours: Math.floor(totalSeconds / 3600),
          minutes: Math.floor((totalSeconds % 3600) / 60),
          seconds: totalSeconds % 60
        }
      };
    });
  
    return {
      faultCycles: enrichedFaultCycles,
      faultSummaries: summaryList
    };
  }
  
  

module.exports = {
    getActiveOperatorIds,
    getCountsForSessions,
    buildOperatorCyclePie,
    buildOptimizedOperatorFaultHistorySingle
};