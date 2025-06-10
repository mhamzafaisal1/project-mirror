# ChiTrac API

The ChiTrac API is a Web Service and Application Programming Interface (API) for providing current, configuration, and historical information about networked Chicago Dryer (CD) equipment. Data is available in JSON format from all routes.

---

## Available Routes

[/api/softrol/historic-data?start=ISOtimestamp&?end=ISOtimestamp](#apisoftrolhistoric-datastartisotimestampendisotimestamp)

[/api/softrol/levelone/all](#apisoftrolleveloneall)

[/api/softrol/leveltwo?serial=integer](#apisoftrolleveltwoserialinteger)

[/api/history/machine/faults?start=ISOtimestamp&end=ISOtimestamp&serial=integer](#apihistorymachinefaultsstartisotimestampendisotimestampserialinteger)

[/api/machines/config/](#apimachinesconfig)

[/api/operator/config/](#apioperatorconfig)

[/api/items/config/](#itemsconfig)

## Softrol Routes

### /api/softrol/historic-data?start=ISOtimestamp&end=ISOtimestamp

This route provides historic record of completed operator sessions on Chicago equipment. A start timestamp is required, if no end timestamp is provided, the end of the query window will default to now.

The intention of this route is to query it on a regular basis (could be once per minute, or every six seconds, really any preferred timeframe) while providing the start timestamp of the most recent record LOIS has recieved as the start timestamp input to this API route. By doing this, the route will provide any records which are more recent than the last record stored, ensuring that all session records are transferred while also ensuring no duplicate records are transferred.

|  | Input Parameters |  |
| --- | --- | --- |
| Label | Definition | Required |
| start | Start timestamp of the query window | Yes |
| end | End timestamp of the query window | No |

Data Format:
```
[{
    "operatorId": 135797,								Operator ID
    "machineSerial": 67798,								Serial Number of machine operator ran on
    "startTimestamp": "2025-04-08T12:27:28.806Z",		Start timestamp of session
    "endTimestamp": "2025-04-08T12:34:22.409Z",			End timestamp of session
    "totalCount": 51,									Total count of pieces properly fed
    "task": "None Entered",								Task (items run)
    "standard": 444										Pace standard for session (prorated for items run)
  },
  {...}]
```

### /api/softrol/levelone/all/

Data Format:
```
"machineInfo":
{
	"serial":63520,					Integer serial number of machine
	"name":"Flipper 1"				String name of machine
},
"fault":							Fault will only display if the current status is a fault, otherwise will be empty
{
	"code":3,						Integer unique ID code for fault type
	"name":"Stop"					String name for the current fault type
},
"status":
{
	"code":3,						Integer unique ID code for status type
	"name":"Stop"					String name for the current status type
	"color":"Red"					String color for Softrol to use for displaying this status
},
"timeOnTask":360,					Integer time on task in seconds for machine, this current session
"onTime": 712,						Integer time machine has been powered on, this current session
"totalCount":216,					Integer total piece count for machine, this current session
"operators":[
{
	"id":117811,					Integer operator ID
	"name":"Shaun White",			String operator full name
	"pace":600,						Integer operator pace in pieces per hour
	"timeOnTask":360,				Integer time on task in seconds for operator
	"count":60,						Integer total piece count
	"efficiency":96,				Integer operator efficiency in percent | efficiency = pace / standard
	"station":1,					Integer current station for operator
	"tasks": [{						Current item(s) operator is running
		"name":"Pool Towel",		String item name
		"standard":625				Integer item standard
	}]
}, { ... }
]
"items":[
{
	"id":4,							Integer item/task unique ID
	"count":600						Integer item count
}, { ... }
]
```

### /api/softrol/leveltwo?serial=integer

|  | Input Parameters |  |
| --- | --- | --- |
| Label | Definition | Required |
| serial | serialNumber of machine we want Level Two data for | yes |

Data Format:
```
"timers": {
	"run": 63,											Integer run time all day in seconds
	"down": 17,											Integer down time all day in seconds
},
"totals": {
	"input": 2493,										Integer total items input all day
	"out": 2384,										Integer total items output all day (input - misfeed)
	"faults": 15,										Integer total fault count all day
	"jams": 9											Integer total jam count all day
},
"availability": 86.55,									Float (rounded to 2 decimal places) availability percentage of the machine all day
"oee": 68.47,											Float (rounded to 2 decimal places) Overall Equipment Efficiency percentage of the machine all day
"operatorEfficiency": 78.61								Floay (rounded to 2 decimal places) averaged operator efficiecy across all operators on this machine all day
```

## History Routes

### /api/history/machine/faults?start=ISOtimestamp&end=ISOtimestamp&serial=integer

|  | Input Parameters |  |
| --- | --- | --- |
| Label | Definition | Required |
| start | Start timestamp of the query window | Yes |
| end | End timestamp of the query window | Yes |
| serial | serialNumber of machine we want Level Two data for | yes |

```
{
    "faultCycles": [													Array of objects describing each fault session which occurred during the query timeframe
        {
            "faultType": "Feeder Right Inlet Jam",						String name of the fault
			"faultCode": 24,											Integer Fault code
            "start": "2025-05-01T12:56:38.199Z",						String timestamp in ISO Standard UTC format of when fault session began
            "states": [													Array of all fault state objects which occurred during this session
                {
                    "timestamp": "2025-05-01T12:56:38.199Z",			String timestamp in ISO Standard UTC format of when this state change was recorded
                    "machine": {
                        "serial": 67802,								Integer serial number of machine
                        "name": "Blanket2"								String name of machine
                    },
                    "program": {
                        "mode": "largePiece"							String name of program mode on machine
                    },
                    "operators": [										Array of operators currently logged into machine
                        {
                            "id": 135799,								Integer operator ID (-1 indicates an inactive station, ID beginning in 9 indicates no logged in operator)
                            "station": 1								Integer station number
                        },
                        { ... }
                    ],
                    "status": {
                        "code": 141,									Integer fault code
                        "name": "Feeder Right Inlet Jam"				String fault name
                    }
                },
                { ... }
            ],
            "end": "2025-05-01T12:56:58.797Z",							String timestamp in ISO Standard UTC format of when fault session ended
            "duration": 20598											Integer duration of the fault session in milliseconds
        },
        { ... }
    ],
    "faultSummaries": [													Array of objects representing a summary of faults which occurred during the query timeframe
        {
            "faultType": "Feeder Right Inlet Jam",						String name of fault
			"faultCode": 24,											Integer Fault code
            "totalDuration": 44619,										Integer duration of all fault sessions of this type during the query timeframe
            "count": 3													Integer number of fault sessions of this type during the query timeframe
        },
        { ... }
    ]
}
```

## Config Routes

### /api/machines/config/

This route provides configuration definition for all CD machines in the system, as stored in the database

```
[
  {
    "_id": "67081ac3b9110cfaf740493a",					String internal uid for each machine, can be omitted
    "serial": 67808,									Integer serial number unique to each machine
    "name": "SPF1",										String name of machine as defined by laundry
    "active": true,										Boolean indicating if machine is currently active in system
    "ipAddress": "192.168.0.1",							String IP address of machine on network
    "lanes": 1											Integer number of lanes machine can run on
  },
  { ... }
]
```

### /api/operator/config/

This route provides configuration definition for all operators in the system, as stored in the database

```
[
  {
    "_id": "67d45a607e769f0a526732aa",					String internal uid for each operator, can be omitted
    "code": 135790,										Integer unique id code for each operator
    "name": "Lilliana Ashca",							String full name of each operator
    "active": true										Boolean indicating if operator is currently active in system
  }
]
```

### /api/items/config/

This route provides configuration definition for all items in the system, as stored in the database

```
[
  {
    "_id": "67041dd6165122adbb4e1ff6",					String internal uid for each item, can be omitted
    "number": 1,										Integer unique id number for each item
    "name": "Sheets",									String item name
    "standard": 350,									Integer of standard (in PPH) for item
    "area": 0,											Integer id of item area, currently unused
    "department": "sheets",								String name of item department
    "weight": null,										Floating weight of each piece, currently unused
    "active": true										Boolean indicating if item is currently active in system
  }
]
```