/**
 * Fetches and groups state + count data by machine or operator for a given time range.
 *
 * @param {Db} db - MongoDB instance
 * @param {Date} start - Start time
 * @param {Date} end - End time
 * @param {'machine'|'operator'} groupBy - Whether to group by machine serial or operator ID
 * @param {Object} [options] - Optional filters
 * @param {number[]} [options.targetSerials] - Optional list of machine serials to filter
 * @param {number} [options.operatorId] - Optional operator ID to filter count records
 * @returns {Promise<Object>} Grouped analytics data by machine or operator
 */
// async function fetchGroupedAnalyticsData(db, start, end, groupBy = 'machine', options = {}) {
//   const { targetSerials = [], operatorId = null } = options;

//   const countQuery = {
//     timestamp: { $gte: start, $lte: end },
//     "machine.serial": { $type: "int" }
//   };

//   if (groupBy === 'machine' && targetSerials.length > 0) {
//     countQuery["machine.serial"] = { $in: targetSerials };
//   }

//   if (groupBy === 'operator' && operatorId !== null) {
//     countQuery["operator.id"] = operatorId;
//   }

//   const counts = await db.collection("count")
//     .find(countQuery)
//     .project({
//       timestamp: 1,
//       "machine.serial": 1,
//       "operator.id": 1,
//       "operator.name": 1,
//       "item.id": 1,
//       "item.name": 1,
//       "item.standard": 1,
//       misfeed: 1
//     })
//     .sort({ timestamp: 1 })
//     .toArray();

//   const grouped = {};

//   for (const count of counts) {
//     const key = groupBy === 'machine'
//       ? count.machine?.serial
//       : count.operator?.id;

//     const machineSerial = count.machine?.serial;

//     if (key == null || machineSerial == null) continue;

//     if (!grouped[key]) {
//       grouped[key] = {
//         counts: {
//           all: [],
//           valid: [],
//           misfeed: []
//         },
//         machineSerials: new Set()
//       };
//     }

//     grouped[key].counts.all.push(count);
//     grouped[key].machineSerials.add(machineSerial);

//     if (count.misfeed === true) {
//       grouped[key].counts.misfeed.push(count);
//     } else if (count.operator?.id !== -1) {
//       grouped[key].counts.valid.push(count);
//     }
//   }

//   // Gather all unique serials from grouped object (to fetch states only once)
//   const allSerials = new Set();
//   for (const obj of Object.values(grouped)) {
//     for (const serial of obj.machineSerials) {
//       allSerials.add(serial);
//     }
//   }

//   const stateQuery = {
//     timestamp: { $gte: start, $lte: end },
//     "machine.serial": { $in: [...allSerials] }
//   };

//   const states = await db.collection("state")
//     .find(stateQuery)
//     .project({
//       timestamp: 1,
//       "machine.serial": 1,
//       "machine.name": 1,
//       "program.mode": 1,
//       "status.code": 1,
//       "status.name": 1
//     })
//     .sort({ timestamp: 1 })
//     .toArray();

//   // Assign states to each group (operator or machine) based on serials
//   for (const key of Object.keys(grouped)) {
//     const serials = grouped[key].machineSerials;
//     const matchedStates = states.filter(s => serials.has(s.machine?.serial));
  
//     grouped[key].states = matchedStates;
  
//     // Attach machine name map for each group
//     const serialToNameMap = {};
//     for (const s of matchedStates) {
//       if (s.machine?.serial && s.machine?.name) {
//         serialToNameMap[s.machine.serial] = s.machine.name;
//       }
//     }
  
//     grouped[key].machineNames = serialToNameMap;
  
//     delete grouped[key].machineSerials;
//   }
  
//   return grouped;
// }


async function fetchGroupedAnalyticsData(db, start, end, groupBy = 'machine', options = {}) {
    const { targetSerials = [], operatorId = null } = options;
    
    // Construct count query
    const countQuery = {
        timestamp: { $gte: start, $lte: end },
        "machine.serial": { $type: "int" }
    };
    
    if (groupBy === 'machine' && targetSerials.length > 0) {
        countQuery["machine.serial"] = { $in: targetSerials };
    }
    
    if (groupBy === 'operator' && operatorId !== null) {
        countQuery["operator.id"] = operatorId;
    }

    // Fetch counts first if grouping by operator, then fetch only relevant states
    let states = [];
    let counts = await db.collection("count")
        .find(countQuery)
        .project({
            timestamp: 1,
            "machine.serial": 1,
            "operator.id": 1,
            "operator.name": 1,
            "item.id": 1,
            "item.name": 1,
            "item.standard": 1,
            misfeed: 1
        })
        .sort({ timestamp: 1 })
        .toArray();

    if (groupBy === 'operator') {
        // 🔥 Get machine.serials used in count records
        const machineSerialsUsed = Array.from(
            new Set(counts.map(c => c.machine?.serial).filter(Boolean))
        );
        const stateQuery = {
            timestamp: { $gte: start, $lte: end },
            "machine.serial": { $in: machineSerialsUsed }
        };
        states = await db.collection("state")
            .find(stateQuery)
            .project({
                timestamp: 1,
                "machine.serial": 1,
                "machine.name": 1,
                "program.mode": 1,
                "status.code": 1,
                "status.name": 1
            })
            .sort({ timestamp: 1 })
            .toArray();
    } else {
        // Construct state query
        const stateQuery = {
            timestamp: { $gte: start, $lte: end },
            "machine.serial": { $type: "int" }
        };
        if (groupBy === 'machine' && targetSerials.length > 0) {
            stateQuery["machine.serial"] = { $in: targetSerials };
        }
        states = await db.collection("state")
            .find(stateQuery)
            .project({
                timestamp: 1,
                "machine.serial": 1,
                "machine.name": 1,
                "program.mode": 1,
                "status.code": 1,
                "status.name": 1
            })
            .sort({ timestamp: 1 })
            .toArray();
    }

    const grouped = {};
    
    // Create machine name map
    const machineNameMap = {};
    for (const state of states) {
        if (state.machine?.serial && state.machine?.name) {
            machineNameMap[state.machine.serial] = state.machine.name;
        }
    }
    
    // Group states and counts based on groupBy
    if (groupBy === 'machine') {
        // Group states by machine
        for (const state of states) {
            const serial = state.machine?.serial;
            if (serial === undefined || serial === null) continue;
            
            if (!grouped[serial]) {
                grouped[serial] = {
                    states: [],
                    counts: {
                        all: [],
                        valid: [],
                        misfeed: []
                    },
                    machineNames: machineNameMap
                };
            }
            
            grouped[serial].states.push(state);
        }
        
        // Group counts by machine
        for (const count of counts) {
            const serial = count.machine?.serial;
            if (serial === undefined || serial === null) continue;
            
            if (!grouped[serial]) {
                grouped[serial] = {
                    states: [],
                    counts: {
                        all: [],
                        valid: [],
                        misfeed: []
                    },
                    machineNames: machineNameMap
                };
            }
            
            grouped[serial].counts.all.push(count);
            
            if (count.misfeed === true) {
                grouped[serial].counts.misfeed.push(count);
            } else if (count.operator?.id !== -1) {
                grouped[serial].counts.valid.push(count);
            }
        }
    } else if (groupBy === 'operator') {
        // First, create a map of machine serials used by each operator
        const operatorMachineMap = {};
        for (const count of counts) {
            const operatorId = count.operator?.id;
            const machineSerial = count.machine?.serial;
            if (operatorId && machineSerial) {
                if (!operatorMachineMap[operatorId]) {
                    operatorMachineMap[operatorId] = new Set();
                }
                operatorMachineMap[operatorId].add(machineSerial);
            }
        }
        
        // Group counts by operator
        for (const count of counts) {
            const operatorId = count.operator?.id;
            if (operatorId === undefined || operatorId === null) continue;
            
            if (!grouped[operatorId]) {
                grouped[operatorId] = {
                    states: [],
                    counts: {
                        all: [],
                        valid: [],
                        misfeed: []
                    },
                    machineNames: machineNameMap
                };
            }
            
            grouped[operatorId].counts.all.push(count);
            
            if (count.misfeed === true) {
                grouped[operatorId].counts.misfeed.push(count);
            } else if (count.operator?.id !== -1) {
                grouped[operatorId].counts.valid.push(count);
            }
        }
        
        // Assign states to operators based on their machine usage
        for (const [operatorId, machineSerials] of Object.entries(operatorMachineMap)) {
            if (grouped[operatorId]) {
                // Filter states for machines used by this operator
                const operatorStates = states.filter(state => 
                    state.machine?.serial && machineSerials.has(state.machine.serial)
                );
                grouped[operatorId].states = operatorStates;
            }
        }
    }
    
    return grouped;
}



async function fetchGroupedAnalyticsDataForOperator(db, adjustedStart, end, operatorId) {
    const grouped = await fetchGroupedAnalyticsData(
      db,
      new Date(adjustedStart),
      new Date(end),
      'operator',
      { operatorId }
    );
  
    return grouped[operatorId] || {
      states: [],
      counts: {
        all: [],
        valid: [],
        misfeed: []
      },
      machineNames: {}
    };
  }
  
  
  async function fetchGroupedAnalyticsDataForMachine(db, start, end, machineSerial) {
    const grouped = await fetchGroupedAnalyticsData(
      db,
      new Date(start),
      new Date(end),
      'machine',
      { targetSerials: [machineSerial] }
    );
  
    return grouped[machineSerial] || {
      states: [],
      counts: {
        all: [],
        valid: [],
        misfeed: []
      },
      machineNames: {}
    };
  }


  async function fetchGroupedAnalyticsDataWithOperators(db, start, end, groupBy = 'machine', options = {}) {
    const { targetSerials = [], operatorId = null } = options;
  
    const stateQuery = {
      timestamp: { $gte: start, $lte: end },
      "machine.serial": { $type: "int" }
    };
  
    if (groupBy === 'machine' && targetSerials.length > 0) {
      stateQuery["machine.serial"] = { $in: targetSerials };
    }
  
    const countQuery = {
      timestamp: { $gte: start, $lte: end },
      "machine.serial": { $type: "int" }
    };
  
    if (groupBy === 'machine' && targetSerials.length > 0) {
      countQuery["machine.serial"] = { $in: targetSerials };
    }
  
    if (groupBy === 'operator' && operatorId !== null) {
      countQuery["operator.id"] = operatorId;
    }
  
    const [states, counts] = await Promise.all([
      db.collection("state")
        .find(stateQuery)
        .project({
          timestamp: 1,
          "machine.serial": 1,
          "machine.name": 1,
          "program.mode": 1,
          "status.code": 1,
          "status.name": 1,
          operators: 1 // ✅ properly include operator array
        })
        
        .sort({ timestamp: 1 })
        .toArray(),
  
      db.collection("count")
        .find(countQuery)
        .project({
          timestamp: 1,
          "machine.serial": 1,
          "operator.id": 1,
          "operator.name": 1,
          "item.id": 1,
          "item.name": 1,
          "item.standard": 1,
          misfeed: 1
        })
        .sort({ timestamp: 1 })
        .toArray()
    ]);
  
    const grouped = {};
    const machineNameMap = {};
  
    for (const state of states) {
      if (state.machine?.serial && state.machine?.name) {
        machineNameMap[state.machine.serial] = state.machine.name;
      }
    }
  
    if (groupBy === 'machine') {
      for (const state of states) {
        const serial = state.machine?.serial;
        if (serial == null) continue;
  
        if (!grouped[serial]) {
          grouped[serial] = {
            states: [],
            counts: { all: [], valid: [], misfeed: [] },
            machineNames: machineNameMap
          };
        }
  
        grouped[serial].states.push(state);
      }
  
      for (const count of counts) {
        const serial = count.machine?.serial;
        if (serial == null) continue;
  
        if (!grouped[serial]) {
          grouped[serial] = {
            states: [],
            counts: { all: [], valid: [], misfeed: [] },
            machineNames: machineNameMap
          };
        }
  
        grouped[serial].counts.all.push(count);
  
        if (count.misfeed === true) {
          grouped[serial].counts.misfeed.push(count);
        } else if (count.operator?.id !== -1) {
          grouped[serial].counts.valid.push(count);
        }
      }
    } else if (groupBy === 'operator') {
      const operatorMachineMap = {};
  
      for (const count of counts) {
        const operatorId = count.operator?.id;
        const machineSerial = count.machine?.serial;
        if (operatorId && machineSerial) {
          if (!operatorMachineMap[operatorId]) {
            operatorMachineMap[operatorId] = new Set();
          }
          operatorMachineMap[operatorId].add(machineSerial);
        }
      }
  
      for (const count of counts) {
        const operatorId = count.operator?.id;
        if (operatorId == null) continue;
  
        if (!grouped[operatorId]) {
          grouped[operatorId] = {
            states: [],
            counts: { all: [], valid: [], misfeed: [] },
            machineNames: machineNameMap
          };
        }
  
        grouped[operatorId].counts.all.push(count);
  
        if (count.misfeed === true) {
          grouped[operatorId].counts.misfeed.push(count);
        } else if (count.operator?.id !== -1) {
          grouped[operatorId].counts.valid.push(count);
        }
      }
  
      for (const [operatorId, machineSerials] of Object.entries(operatorMachineMap)) {
        if (grouped[operatorId]) {
          const operatorStates = states.filter(state =>
            state.machine?.serial && machineSerials.has(state.machine.serial)
          );
          grouped[operatorId].states = operatorStates;
        }
      }
    }
  
    return grouped;
  }
  
  

  
  module.exports = {
    fetchGroupedAnalyticsData,
    fetchGroupedAnalyticsDataForOperator,
    fetchGroupedAnalyticsDataForMachine,
    fetchGroupedAnalyticsDataWithOperators
  };