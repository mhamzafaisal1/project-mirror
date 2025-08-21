# ChiTrac API

The ChiTrac API is a Web Service and Application Programming Interface (API) for providing current, configuration, and historical information about networked Chicago Dryer (CD) equipment. Data is available in JSON format from all routes.

---

## Available Routes
Machine Analytics Routes
/api/alpha/analytics/machines-summary?start=ISOtimestamp&end=ISOtimestamp

This route returns an OEE-style summary for active machines over a requested time window. Sessions are clamped to the window; open sessions are closed at end for calculation. If a machine has no sessions in-window, a zeroed row is still returned.

	Input Parameters	
Label	Definition	Required
start	Start timestamp of the query window (ISO 8601)	Yes
end	End timestamp of the query window (ISO 8601). If in the future, it is clamped to now	Yes

Data Format:

[
  {
    "machine": {
      "serial": 63520,                                  Integer serial number of machine
      "name": "Flipper 1"                               String name of machine
    },
    "currentStatus": {
      "code": 3,                                        Integer unique status/fault code
      "name": "Stop"                                    String status/fault name
    },
    "metrics": {
      "runtime": {
        "total": 5400000,                               Integer runtime in milliseconds (clamped to window)
        "formatted": "01:30:00"                         String human-readable duration (HH:MM:SS)
      },
      "downtime": {
        "total": 3600000,                               Integer downtime in milliseconds (window - runtime)
        "formatted": "01:00:00"                         String human-readable duration (HH:MM:SS)
      },
      "output": {
        "totalCount": 216,                              Integer total pieces produced in-window
        "misfeedCount": 4                               Integer total misfeeds in-window
      },
      "performance": {
        "availability": {
          "value": 0.60,                                Float availability ratio = runtime/window
          "percentage": "60.00"                         String percentage with 2 decimals
        },
        "throughput": {
          "value": 0.9819,                              Float throughput = totalCount/(totalCount+misfeedCount)
          "percentage": "98.19"                         String percentage with 2 decimals
        },
        "efficiency": {
          "value": 0.92,                                Float efficiency = totalTimeCredit/workTimeSec
          "percentage": "92.00"                         String percentage with 2 decimals
        },
        "oee": {
          "value": 0.5427,                              Float OEE = availability*throughput*efficiency
          "percentage": "54.27"                         String percentage with 2 decimals
        }
      }
    },
    "timeRange": {
      "start": "2025-08-20T00:00:00.000Z",              String ISO start of window (echoed)
      "end": "2025-08-20T03:00:00.000Z"                 String ISO end of window (echoed; may be clamped to now)
    }
  }
]


Computation Notes (for clarity of fields above):

Sessions overlapping the window are truncated to [start, end]. Counts/misfeeds are filtered to the clamped window.

workTimeSec = runtime (sec) × number of active stations (operators with id !== -1).

totalTimeCredit = sum of per-item time credits using each item’s standard (converted to PPH; if <60, it is multiplied by 60) and actual item counts within the window.