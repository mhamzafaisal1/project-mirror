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

  async function getValidCounts(db, serial, start, end) {
    return db.collection('count')
      .find({
        'machine.serial': serial,
        timestamp: { $gte: new Date(start), $lte: new Date(end) },
        'operator.id': { $exists: true, $ne: -1 },
        misfeed: { $ne: true } // Exclude misfeeds
      })
      .sort({ timestamp: 1 })
      .toArray();
  }

  
  async function getMisfeedCounts(db, serial, start, end) {
    return db.collection('count')
      .find({
        'machine.serial': serial,
        timestamp: { $gte: new Date(start), $lte: new Date(end) },
        'operator.id': { $exists: true, $ne: -1 },
        misfeed: true // Only misfeeds
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

  // Count functions for Operator

  // Operator-specific count functions
  async function getValidCountsForOperator(db, operatorId, start, end) {
    return db.collection('count')
      .find({
        'operator.id': operatorId,
        timestamp: { $gte: new Date(start), $lte: new Date(end) },
        misfeed: { $ne: true } // Exclude misfeeds
      })
      .sort({ timestamp: 1 })
      .toArray();
  }

  async function getMisfeedCountsForOperator(db, operatorId, start, end) {
    return db.collection('count')
      .find({
        'operator.id': operatorId,
        timestamp: { $gte: new Date(start), $lte: new Date(end) },
        misfeed: true // Only misfeeds
      })
      .sort({ timestamp: 1 })
      .toArray();
  }

  /**
   * Gets the operator name from the count collection based on operator ID
   * @param {Object} db - MongoDB database instance
   * @param {number} operatorId - Operator ID to look up
   * @returns {Promise<string>} Operator name or 'Unknown' if not found
   */
  async function getOperatorNameFromCount(db, operatorId) {
    if (!operatorId) return 'Unknown';
    
    try {
      // Convert operatorId to number if it's a string
      const numericOperatorId = typeof operatorId === 'string' ? parseInt(operatorId, 10) : operatorId;
      
      const count = await db.collection('count')
        .findOne(
          { 'operator.id': numericOperatorId },
          { projection: { 'operator.name': 1 } }
        );
        
      if (!count || !count.operator || !count.operator.name) {
        console.log(`No operator name found for ID: ${numericOperatorId}`);
        return 'Unknown';
      }
      
      return count.operator.name;
    } catch (error) {
      console.error('Error getting operator name:', error);
      return 'Unknown';
    }
  }

  async function getCountsForOperator(db, operatorId, start, end) {
    return db.collection('count')
      .find({
        'operator.id': operatorId,
        timestamp: { $gte: new Date(start), $lte: new Date(end) }
      })
      .sort({ timestamp: 1 })
      .toArray();
  }

  function extractItemNamesFromCounts(counts) {
    const itemNames = new Set();
    for (const count of counts) {
      const item = count.item;
      if (item && item.name) {
        itemNames.add(item.name);
      }
    }
    return Array.from(itemNames).join(', ');
  }
    
  module.exports = {
    getCountRecords,
    getValidCounts,
    getMisfeedCounts,
    getOperatorItemMapFromCounts,
    getValidCountsForOperator,
    getMisfeedCountsForOperator,
    getOperatorNameFromCount,
    getCountsForOperator,
    extractItemNamesFromCounts
  };
  