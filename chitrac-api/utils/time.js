const { DateTime, Duration } = require("luxon");

const SYSTEM_TIMEZONE = "America/Chicago";

const TIME_CONSTANTS = {
  MINUTES_IN_HOUR: 60,
  MILLISECONDS_IN_MINUTE: 60000,
  MILLISECONDS_IN_HOUR: 3600000,
  DEFAULT_PADDING: 5,
  DATE_FORMATS: {
    ISO: "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'",
    DISPLAY: "MM/dd/yyyy HH:mm:ss",
    MONGO: "YYYY-MM-DDTHH:mm:ss.SSSZ",
  },
};

/**
 * Validates and parses query parameters for MongoDB date queries
 */
function parseAndValidateQueryParams(req) {
  const {
    startTime,
    endTime,
    machineSerial,
    start,
    end,
    serial,
    operatorId,
  } = req.query;

  const startDate = startTime || start;
  const endDate = endTime || end;
  const machineId = machineSerial || serial;

  if (!startDate || !endDate) {
    throw new Error("start/startTime and end/endTime are required");
  }

  const startDT = validateDateString(startDate);
  const endDT = validateDateString(endDate);
  validateTimeRange(startDT, endDT);

  return {
    start: convertToMongoDate(startDT),
    end: convertToMongoDate(endDT),
    serial: machineId ? parseInt(machineId) : null,
    operatorId: operatorId ? parseInt(operatorId) : null,
    startLuxon: startDT,
    endLuxon: endDT,
  };
}

/**
 * Creates a padded time range for MongoDB queries
 */
function createPaddedTimeRange(start, end, paddingMinutes = TIME_CONSTANTS.DEFAULT_PADDING) {
  const startDT = DateTime.fromJSDate(start, { zone: SYSTEM_TIMEZONE });
  const endDT = DateTime.fromJSDate(end, { zone: SYSTEM_TIMEZONE });

  return {
    paddedStart: convertToMongoDate(startDT.minus({ minutes: paddingMinutes })),
    paddedEnd: convertToMongoDate(endDT.plus({ minutes: paddingMinutes })),
  };
}

/**
 * Validates that start time is before end time
 */
function validateTimeRange(start, end) {
  if (start > end) {
    throw new Error("Start time must be before end time");
  }
  return true;
}

/**
 * Validates a date string and converts it to a Luxon DateTime
 */
function validateDateString(dateString) {
  const dt = DateTime.fromISO(dateString, { zone: SYSTEM_TIMEZONE });
  if (!dt.isValid) {
    throw new Error("Invalid date string format");
  }
  return dt;
}

/**
 * Converts Luxon DateTime to Mongo-compatible JS Date
 */
function convertToMongoDate(dt) {
  return dt.toJSDate();
}

/**
 * Creates a MongoDB date query object
 */
function createMongoDateQuery(start, end) {
  return {
    $gte: convertToMongoDate(DateTime.fromJSDate(start, { zone: SYSTEM_TIMEZONE })),
    $lte: convertToMongoDate(DateTime.fromJSDate(end, { zone: SYSTEM_TIMEZONE })),
  };
}

/**
 * Calculates duration between two dates in milliseconds
 */
function calculateDuration(start, end) {
  const startDT = DateTime.fromJSDate(start, { zone: SYSTEM_TIMEZONE });
  const endDT = DateTime.fromJSDate(end, { zone: SYSTEM_TIMEZONE });
  return endDT.diff(startDT).as("milliseconds");
}

/**
 * Formats duration into hours and minutes
 */
function formatDuration(milliseconds) {
  const dur = Duration.fromMillis(milliseconds);
  const hours = Math.floor(dur.as("hours"));
  const minutes = Math.floor(dur.minus({ hours }).as("minutes"));
  return { hours, minutes };
}

/**
 * Creates a MongoDB aggregation pipeline for time-based grouping
 */
function createTimeGroupingPipeline(dateField, interval = "hour") {
  return [
    {
      $group: {
        _id: {
          $dateToString: {
            format: getMongoDateFormat(interval),
            date: `$${dateField}`,
          },
        },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ];
}

/**
 * Gets MongoDB date format string based on interval
 */
function getMongoDateFormat(interval) {
  const formats = {
    hour: "%Y-%m-%d %H:00:00",
    day: "%Y-%m-%d",
    month: "%Y-%m",
    year: "%Y",
  };
  return formats[interval] || formats.hour;
}

/**
 * Generates hourly intervals between two timestamps
 */
function getHourlyIntervals(start, end) {
  const startDT = DateTime.fromJSDate(start, { zone: SYSTEM_TIMEZONE }).startOf("hour");
  const endDT = DateTime.fromJSDate(end, { zone: SYSTEM_TIMEZONE }).endOf("hour");

  const intervals = [];
  let cursor = startDT;

  while (cursor < endDT) {
    const next = cursor.plus({ hours: 1 });
    intervals.push({
      start: cursor.toJSDate(),
      end: next > endDT ? endDT.toJSDate() : next.toJSDate(),
    });
    cursor = next;
  }

  return intervals;
}

/**
 * Enforces a minimum time window of N days
 */
function enforceMinimumTimeRange(start, end, minDays = 7) {
  let startDT = DateTime.fromJSDate(start, { zone: SYSTEM_TIMEZONE });
  const endDT = DateTime.fromJSDate(end, { zone: SYSTEM_TIMEZONE });
  const minDuration = Duration.fromObject({ days: minDays });

  if (endDT.diff(startDT) < minDuration) {
    startDT = endDT.minus(minDuration);
  }

  return {
    start: startDT.toISO(),
    end: endDT.toISO(),
  };
}

/**
 * Generates day-by-day intervals between two timestamps
 */
function getDayIntervals(start, end) {
  const startDT = DateTime.fromJSDate(start, { zone: SYSTEM_TIMEZONE }).startOf("day");
  const endDT = DateTime.fromJSDate(end, { zone: SYSTEM_TIMEZONE }).endOf("day");

  const intervals = [];
  let cursor = startDT;

  while (cursor < endDT) {
    const next = cursor.plus({ days: 1 });
    intervals.push({
      start: cursor.toJSDate(),
      end: next.toJSDate(),
    });
    cursor = next;
  }

  return intervals;
}

module.exports = {
  TIME_CONSTANTS,
  SYSTEM_TIMEZONE,
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
  getHourlyIntervals,
  enforceMinimumTimeRange,
  getDayIntervals,
};
