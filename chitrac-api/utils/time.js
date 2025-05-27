const TIME_CONSTANTS = {
  MINUTES_IN_HOUR: 60,
  MILLISECONDS_IN_MINUTE: 60000,
  MILLISECONDS_IN_HOUR: 3600000,
  DEFAULT_PADDING: 5,
  DATE_FORMATS: {
    ISO: 'yyyy-MM-dd\'T\'HH:mm:ss.SSS\'Z\'',
    DISPLAY: 'MM/dd/yyyy HH:mm:ss',
    MONGO: 'YYYY-MM-DDTHH:mm:ss.SSSZ'  // MongoDB's preferred format
  }
};

/**
 * Validates and parses query parameters for MongoDB date queries
 * @param {Object} req - Express request object
 * @returns {Object} { start, end, serial, operatorId } - Validated dates and IDs
 */
function parseAndValidateQueryParams(req) {
  const { 
    startTime, 
    endTime, 
    machineSerial, 
    start, 
    end, 
    serial,
    operatorId
  } = req.query;
  
  // Use either naming convention for dates
  const startDate = startTime || start;
  const endDate = endTime || end;
  const machineId = machineSerial || serial;
  
  if (!startDate || !endDate) {
    throw new Error('start/startTime and end/endTime are required');
  }
  
  const startDateObj = validateDateString(startDate);
  const endDateObj = validateDateString(endDate);
  const serialNum = machineId ? parseInt(machineId) : null;
  const operatorNum = operatorId ? parseInt(operatorId) : null;
  
  validateTimeRange(startDateObj, endDateObj);
  
  return { 
    start: convertToMongoDate(startDateObj),
    end: convertToMongoDate(endDateObj),
    serial: serialNum,
    operatorId: operatorNum
  };
}

/**
 * Creates a padded time range for MongoDB queries
 * @param {Date} start - Start date
 * @param {Date} end - End date
 * @param {number} paddingMinutes - Minutes to pad (default: 5)
 * @returns {Object} { paddedStart, paddedEnd } - Padded dates in MongoDB format
 */
function createPaddedTimeRange(start, end, paddingMinutes = TIME_CONSTANTS.DEFAULT_PADDING) {
  const paddingMs = paddingMinutes * TIME_CONSTANTS.MILLISECONDS_IN_MINUTE;
  return {
    paddedStart: convertToMongoDate(new Date(start.getTime() - paddingMs)),
    paddedEnd: convertToMongoDate(new Date(end.getTime() + paddingMs))
  };
}

/**
 * Validates that start time is before end time
 * @param {Date} start - Start date
 * @param {Date} end - End date
 * @returns {boolean} true if valid
 */
function validateTimeRange(start, end) {
  if (start > end) {
    throw new Error('Start time must be before end time');
  }
  return true;
}

/**
 * Validates a date string and converts it to a Date object
 * @param {string} dateString - Date string to validate
 * @returns {Date} Validated date object
 */
function validateDateString(dateString) {
  const date = new Date(dateString);
  if (isNaN(date.getTime())) {
    throw new Error('Invalid date string format');
  }
  return date;
}

/**
 * Converts a JavaScript Date to MongoDB's preferred date format
 * @param {Date} date - JavaScript Date object
 * @returns {Date} MongoDB compatible date
 */
function convertToMongoDate(date) {
  return new Date(date.toISOString());
}

/**
 * Creates a MongoDB date query object
 * @param {Date} start - Start date
 * @param {Date} end - End date
 * @returns {Object} MongoDB date query
 */
function createMongoDateQuery(start, end) {
  return {
    $gte: convertToMongoDate(start),
    $lte: convertToMongoDate(end)
  };
}

/**
 * Calculates duration between two dates in milliseconds
 * @param {Date} start - Start date
 * @param {Date} end - End date
 * @returns {number} Duration in milliseconds
 */
function calculateDuration(start, end) {
  return end.getTime() - start.getTime();
}

/**
 * Formats duration into hours and minutes
 * @param {number} milliseconds - Duration in milliseconds
 * @returns {Object} { hours, minutes }
 */
function formatDuration(milliseconds) {
  const hours = Math.floor(milliseconds / TIME_CONSTANTS.MILLISECONDS_IN_HOUR);
  const minutes = Math.floor((milliseconds % TIME_CONSTANTS.MILLISECONDS_IN_HOUR) / TIME_CONSTANTS.MILLISECONDS_IN_MINUTE);
  return { hours, minutes };
}

/**
 * Creates a MongoDB aggregation pipeline for time-based grouping
 * @param {string} dateField - Field name containing the date
 * @param {string} interval - Grouping interval ('hour', 'day', etc.)
 * @returns {Array} MongoDB aggregation pipeline
 */
function createTimeGroupingPipeline(dateField, interval = 'hour') {
  return [
    {
      $group: {
        _id: {
          $dateToString: {
            format: getMongoDateFormat(interval),
            date: `$${dateField}`
          }
        },
        count: { $sum: 1 }
      }
    },
    { $sort: { _id: 1 } }
  ];
}

/**
 * Gets MongoDB date format string based on interval
 * @param {string} interval - Time interval
 * @returns {string} MongoDB date format string
 */
function getMongoDateFormat(interval) {
  const formats = {
    hour: '%Y-%m-%d %H:00:00',
    day: '%Y-%m-%d',
    month: '%Y-%m',
    year: '%Y'
  };
  return formats[interval] || formats.hour;
}

  
function getHourlyIntervals(start, end) {
  const intervals = [];
  let current = new Date(start);
  const endDate = new Date(end);

  while (current < endDate) {
    const nextHour = new Date(current);
    nextHour.setHours(current.getHours() + 1);
    intervals.push({
      start: new Date(current),
      end: nextHour > endDate ? endDate : nextHour
    });
    current = nextHour;
  }

  return intervals;
}


module.exports = {
  TIME_CONSTANTS,
  parseAndValidateQueryParams,
  createPaddedTimeRange,
  validateTimeRange,
  validateDateString,
  convertToMongoDate,
  createMongoDateQuery,
  calculateDuration,
  formatDuration,
  createTimeGroupingPipeline,
  getMongoDateFormat,
  getHourlyIntervals
};
  