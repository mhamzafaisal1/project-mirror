




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
  

module.exports = {
    getActiveOperatorIds,
    getCountsForSessions
};