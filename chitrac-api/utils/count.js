async function getCountRecords(db, serial, start, end) {
    return db.collection('count')
      .find({
        'machine.serial': serial,
        timestamp: { $gte: new Date(start), $lte: new Date(end) },
        'operator.id': { $exists: true, $ne: -1 }
      })
      .sort({ timestamp: 1 })
      .toArray();
  }
  
  function getOperatorItemMapFromCounts(countRecords) {
    const operatorMap = {};
  
    for (const record of countRecords) {
      const operatorId = record.operator?.id;
      const operatorName = record.operator?.name;
      const item = record.item;
  
      if (!operatorId || operatorId === -1 || !item) continue;
  
      if (!operatorMap[operatorId]) {
        operatorMap[operatorId] = {
          name: operatorName || 'Unknown',
          items: {}
        };
      }
  
      const itemIdKey = item?.id ?? 'unknown';
      if (!operatorMap[operatorId].items[itemIdKey]) {
        operatorMap[operatorId].items[itemIdKey] = [];
      }
  
      operatorMap[operatorId].items[itemIdKey].push(item);
    }
  
    for (const opId of Object.keys(operatorMap)) {
      if (!operatorMap[opId].name || operatorMap[opId].name === 'Unknown') {
        const match = countRecords.find(rec => rec.operator?.id === parseInt(opId) && rec.operator?.name);
        if (match) {
          operatorMap[opId].name = match.operator.name;
        }
      }
    }
  
    return operatorMap;
  }
  module.exports = { getCountRecords, getOperatorItemMapFromCounts };
  