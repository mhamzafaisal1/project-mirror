// Softrol Route start (WORKS !!)

  router.get("/softrol/get-softrol-data", async (req, res) => {
    try {
      // Step 1: Validate start parameter
      const start = req.query.start;
      if (!start) {
        return res.status(400).json({ error: "Start time parameter is required" });
      }
      
      // Validate start is a valid ISO date string
      const startDate = new Date(start);
      if (isNaN(startDate.getTime())) {
        return res.status(400).json({ error: "Invalid start time format. Please use ISO date string" });
      }

      // Step 2: Handle end parameter
      let endDate;
      if (req.query.end) {
        // If end parameter is provided, validate it
        endDate = new Date(req.query.end);
        if (isNaN(endDate.getTime())) {
          return res.status(400).json({ error: "Invalid end time format. Please use ISO date string" });
        }
      }

      // Step 3: Get latest state and create time range in parallel
      const [latestState] = await Promise.all([
        db.collection('state')
        .find()
        .sort({ timestamp: -1 })
        .limit(1)
          .toArray(),
        // Add any other independent operations here
      ]);
      
      // Use provided end date or default to latest state/current time
      const end = endDate ? endDate.toISOString() : (latestState?.timestamp || new Date().toISOString());
      const { paddedStart, paddedEnd } = createPaddedTimeRange(startDate, new Date(end));

      // Step 4: Fetch states and process cycles in parallel
      const [allStates] = await Promise.all([
        fetchStatesForOperator(db, null, paddedStart, paddedEnd),
        // Add any other independent operations here
      ]);

      const groupedStates = groupStatesByOperatorAndSerial(allStates);

      // Process completed cycles for each operator-machine group
      const completedCyclesByGroup = {};
      for (const [key, group] of Object.entries(groupedStates)) {
        const completedCycles = getCompletedCyclesForOperator(group.states);
        if (completedCycles.length > 0) {
          completedCyclesByGroup[key] = {
            ...group,
            completedCycles
          };
        }
      }

      // Get all operator IDs and machine serials
      const operatorMachinePairs = Object.keys(completedCyclesByGroup).map(key => {
        const [operatorId, machineSerial] = key.split("-");
        return {
          operatorId: parseInt(operatorId),
          machineSerial: parseInt(machineSerial)
        };
      });

      // Step 5: Get counts and process results in parallel
      const [allCounts] = await Promise.all([
        getCountsForOperatorMachinePairs(db, operatorMachinePairs, start, end),
        // Add any other independent operations here
      ]);

      // Group the counts by operator and machine for easier processing
      const groupedCounts = groupCountsByOperatorAndMachine(allCounts);

      // Step 6: Process each group in parallel
      const results = await Promise.all(
        Object.entries(completedCyclesByGroup).map(async ([key, group]) => {
        const [operatorId, machineSerial] = key.split("-");
        const states = group.states;
          if (!states.length) return null;

        // Get the first and last completed cycles for this operator-machine pair
        const firstCycle = group.completedCycles[0];
        const lastCycle = group.completedCycles[group.completedCycles.length - 1];
        
        // Use the actual cycle timestamps
        const cycleStart = firstCycle.start;
        const cycleEnd = lastCycle.end;

          // Get counts for this operator-machine pair
          const countGroup = groupedCounts[`${operatorId}-${machineSerial}`];
          if (!countGroup) return null;

          // Process count statistics using the new utility function
          const stats = processCountStatistics(countGroup.counts);

        const { runtime: runtimeMs } = calculateOperatorTimes(states, cycleStart, cycleEnd);
          const piecesPerHour = calculatePiecesPerHour(stats.total, runtimeMs);
          const efficiency = calculateEfficiency(runtimeMs, stats.total, countGroup.validCounts);

          // Get item names using the existing utility function
          const itemNames = extractItemNamesFromCounts(countGroup.counts);

          return {
          operatorId: parseInt(operatorId),
          machineSerial: parseInt(machineSerial),
          startTimestamp: cycleStart.toISOString(),
          endTimestamp: cycleEnd.toISOString(),
            totalCount: stats.total,
          task: itemNames,
            standard: Math.round(piecesPerHour * efficiency),      
          };
        })
      );

      // Filter out null results and send response
      res.json(results.filter(result => result !== null));
    } catch (error) {
      logger.error("Error in softrol data processing:", error);
      res.status(500).json({ error: "Failed to process softrol data" });
    }
  });
  // Softrol Route end