#ChiTrac API

The ChiTrac API is a Web Service and Application Programming Interface (API) for providing current, configuration, and historical information about networked Chicago Dryer (CD) equipment. Data is available in JSON format from all routes.

If a route specification ends with "?xml", that route has data also available via XML/DataFusion format.

---

##Available Routes

[/api/softrol/levelone/all](#apisoftrolleveloneall)

[/api/softrol/levelone/all/xml](#apisoftrolleveloneallxml)

[/api/machine/status/:serialNumber/?xml](#apimachinestatusserialnumberxml)

[/api/machines/config/?xml](#apimachinesconfigxml)

[/api/operators/config/?xml](#apioperatorsconfigxml)

[/api/items/config/?xml](#itemsconfigxml)

[/api/machine/leveltwo/:serialNumber/xml](#apimachineleveltwoserialnumberxml)

##Machine Routes

###/api/softrol/levelone/all/

Data Format:
```
"machineInfo":
{
	"serial":63520,					Machine serial number
	"name":"Flipper 1"				Machine name
},
"fault":							Fault will only display if the current status is a fault, otherwise will be empty
{
	"code":3,						Unique ID code for fault type
	"name":"Stop"					Name for the current fault type
},
"status":
{
	"code":3,						Unique ID code for status type
	"name":"Stop"					Name for the current status type
},
"timeOnTask":360,					Time on task in seconds for machine
"totalCount":216,					Total piece count for machine
"efficiency":86.52,					Efficiency across all operators
"operators":[
{
	"id":117811,					Operator ID
	"name":"Shaun White",			Operator full name
	"pace":600,						Operator pace in pieces per hour
	"timeOnTask":360,				Time on task in seconds for operator
	"count":60,						Total piece count
	"efficiency":96,				Operator efficiency in percent | efficiency = pace / standard
	"station":1,					Current station for operator
	"tasks": [{						Current item(s) operator is running
		"name":"Pool Towel",		
		"standard":625
	}]
}, {
	"id":118347,
	"name":"Hannah Teter",
	"pace":613,
	"timeOnTask":360,
	"count":61,
	"efficiency":98.08,
	"station":2,
	"tasks": [{						
		"name":"Bath Towel",		
		"standard":625
	}]
}, {
	"id":119277,
	"name":"Torah Bright",
	"pace":407,
	"timeOnTask":360,
	"count":41,
	"efficiency":65.12,
	"station":3,
	"tasks": [{						
		"name":"Pool Towel",		
		"standard":625
	}]
}, {
	"id":159375,
	"name":"Jeremy Jones",
	"pace":543,
	"timeOnTask":360,
	"count":54,
	"efficiency":86.88,
	"station":4,
	"tasks": [{						
		"name":"Bath Towel",		
		"standard":625
	}]
}],
"tasks":[
{
	"id":4,							Item/task unique ID
	"name":"Pool Towel",			Item/task name
	"standard":625,					Item/task pace standard in pieces per hour
	"count":600						Item count
}, {
	"id":5,
	"name":"Bath Towel",
	"standard":625,
	"count":61
}, {
	"id":4,
	"name":"Pool Towel",
	"standard":625,
	"count":41
}, {
	"id":5,
	"name":"Bath Towel",
	"standard":625,
	"count":54
}]
```

###/api/softrol/levelone/all/xml

Data Format:
```
<levelone>
	<machine>
		<machineInfo>
			<serial>63520</serial> 						Machine serial number
			<name>Flipper 1</name> 						Machine name
		</machineInfo>
		<fault>
			<code>3</code>								Unique ID code for fault type
			<name>Stop</name>							Name for the current fault type
		</fault>										Fault will only display if the current status is a fault, otherwise will be empty
		<status>
			<code>3</code>								Unique ID code for status type
			<name>Stop</name>							Name for the current status type
		</status>
		<timeOnTask>360</timeOnTask>					Time on task in seconds for machine
		<totalCount>216</totalCount>					Total piece count for machine
		<efficiency>86.52</efficiency>					Efficiency across all operators
		<operators>
			<operator>
				<id>117811</id>							Operator ID
				<name>Shaun White</name>				Operator full name
				<pace>600</pace>						Operator pace in pieces per hour
				<timeOnTask>360</timeOnTask>			Time on task in seconds
				<count>60</count>						Total piece count
				<efficiency>96</efficiency>				Operator efficiency in percent | efficiency = pace / standard
				<station>1</station>					Current Station for operator
				<tasks>
					<task>								Current item(s) operator is running
						<name>Pool Towel</name>
						<standard>625</standard>
					</task>
				</tasks>
			</operator>
			<operator>
				<id>118347</id>
				<name>Hannah Teter</name>
				<pace>613</pace>
				<timeOnTask>360</timeOnTask>
				<count>61</count>
				<efficiency>98.08</efficiency>
				<station>2</station>
				<tasks>
					<task>
						<name>Pool Towel</name>
						<standard>625</standard>
					</task>
				</tasks>
			</operator>
			<operator>
				<id>119277</id>
				<name>Torah Bright</name>
				<pace>407</pace>
				<timeOnTask>360</timeOnTask>
				<count>41</count>
				<efficiency>65.12</efficiency>
				<station>3</station>
				<tasks>
					<task>
						<name>Pool Towel</name>
						<standard>625</standard>
					</task>
				</tasks>
			</operator>
			<operator>
				<id>159375</id>
				<name>Jeremy Jones</name>
				<pace>543</pace>
				<timeOnTask>360</timeOnTask>
				<count>54</count>
				<efficiency>86.88</efficiency>
				<station>4</station>
				<tasks>
					<task>
						<name>Pool Towel</name>
						<standard>625</standard>
					</task>
				</tasks>
			</operator>
		</operators>
		<tasks>
			<task>
				<id>4</id>								Item/task unique ID
				<name>Pool Towel</name>					Item/task name
				<standard>625</standard>				Item/task pace standard in pieces per hour
				<count>60</count>						Item count
			</task>
			<task>
				<id>5</id>
				<name>Bath Towel</name>
				<standard>625</standard>
				<count>61</count>
			</task>
			<task>
				<id>4</id>
				<name>Pool Towel</name>
				<standard>625</standard>
				<count>41</count>
			</task>
			<task>
				<id>5</id>
				<name>Bath Towel</name>
				<standard>625</standard>
				<count>54</count>
			</task>
		</tasks>
	</machine>
</levelone>
```

###/api/machine/status/:serialNumber/?xml

This route provides live status information for a machine.

|  | Input Parameters |  |
| --- | --- | --- |
| Label | Definition | Required |
| serialNumber | Serial Number of Desired Machine | Yes |
| xml | Include xml parameter if xml output is desired | No |

####Example Machine Status

```
<machineState>
	<machine>
		<serial>63520</serial>
		<type>9000</type>
		<location>1</location>
		<line>5</line>
		<model>3</model>
		<ipAddress>192.168.0.31</ipAddress>
		<id>14</id>
		<name>Flipper 1</name>
		<lanes>1</lanes>
	</machine>
	<status>0</status>
	<timers>
		<onTime>87</onTime>
		<runTime>0</runTime>
		<readyTime>87</readyTime>
		<brokeTime>0</brokeTime>
		<emptyTime>0</emptyTime>
		<onDuration>00:01:27</onDuration>
	</timers>
	<energy>
		<electric>0</electric>
		<pneumatic>0</pneumatic>
		fuel>0</fuel>
		<fuelType>0</fuelType>
	</energy>
	<program>
		<programNumber>3</programNumber>
		<batchNumber>24</batchNumber>
		<accountNumber>0</accountNumber>
		<speed>160</speed>
		<stations>1</stations>
	</program>
	<totals>
		<oneLane>0</oneLane>
		<twoLane>0</twoLane>
		<sp>0</sp>
		<drape>0</drape>
	</totals>
	<rejects>
		<stain>0</stain>
		<tear>0</tear>
		<shape>0</shape>
		<lowQuality>0</lowQuality>
	</rejects>
	<fCounts>
		<fi1>0</fi1>
		<fo1>0</fo1>
		<fm1>0</fm1>
		<fi2>0</fi2>
		<fo2>0</fo2>
		<fm2>0</fm2>
		<fi3>0</fi3>
		<fo3>0</fo3>
		<fm3>0</fm3>
		<fi4>0</fi4>
		<fo4>0</fo4>
		<fm4>0</fm4>
	</fCounts>
	<lCounts>
		<liC>0</liC>
		<lpC>0</lpC>
		<xiC>0</xiC>
		<xoC>0</xoC>
		<soC>0</soC>
		<li1>0</li1>
		<lp1>0</lp1>
		<xi1>0</xi1>
		<xo1>0</xo1>
		<so1>0</so1>
		<li2>0</li2>
		<lp2>0</lp2>
		<xi2>0</xi2>
		<xo2>0</xo2>
		<so2>0</so2>
	</lCounts>
	<sCounts>
		<si1>0</si1>
		<sp1>0</sp1>
		<sa1>0</sa1>
		<si2>0</si2>
		<sp2>0</sp2>
		<sa2>0</sa2>
		<si3>0</si3>
		<sp3>0</sp3>
		<sa3>0</sa3>
		<si4>0</si4>
		<sp4>0</sp4>
		<sa4>0</sa4>
		<si5>0</si5>
		<sp5>0</sp5>
		<sa5>0</sa5>
		<si6>0</si6>
		<sp6>0</sp6>
		<sa6>0</sa6>
		<si7>0</si7>
		<sp7>0</sp7>
		<sa7>0</sa7>
		<si8>0</si8>
		<sp8>0</sp8>
		<sa8>0</sa8>
	</sCounts>
	<lpOperators>
		<lpOperator>
			<id>0</id>
			<lane>1</lane>
		</lpOperator>
		<lpOperator>
			<id>-1</id>
			<lane>2</lane>
		</lpOperator>
		<lpOperator>
			<id>-1</id>
			<lane>3</lane>
		</lpOperator>
		<lpOperator>
			<id>-1</id>
			<lane>4</lane>
		</lpOperator>
	</lpOperators>
	<spOperators>
		<spOperator>
			<id>-1</id>
			<lane>1</lane>
		</spOperator>
		<spOperator>
			<id>-1</id>
			<lane>2</lane>
		</spOperator>
		<spOperator>
			<id>-1</id>
			<lane>3</lane>
		</spOperator>
		<spOperator>
			<id>-1</id>
			<lane>4</lane>
		</spOperator>
		<spOperator>
			<id>-1</id>
			<lane>5</lane>
		</spOperator>
		<spOperator>
			<id>-1</id>
			<lane>6</lane>
		</spOperator>
		<spOperator>
			<id>-1</id>
			<lane>7</lane>
		</spOperator>
		<spOperator>
			<id>-1</id>
			<lane>8</lane>
		</spOperator>
	</spOperators>
	<items>
		<item>
			<id>24</id>
			<count>0</count>
		</item>
		<item>
			<id>0</id>
			<count>0</count>
		</item>
		<item>
			<id>0</id>
			<count>0</count>
		</item>
		<item>
			<id>0</id>
			<count>0</count>
		</item>
		<item>
			<id>0</id>
			<count>0</count>
		</item>
		<item>
			<id>0</id>
			<count>0</count>
		</item>
		<item>
			<id>0</id>
			<count>0</count>
		</item>
		<item>
			<id>0</id>
			<count>0</count>
		</item>
	</items>
</machineState>
```

###/api/machines/config/?xml

This route provides configuration definition for all CD machines in the system, as stored in the database

|  | Input Parameters |  |
| --- | --- | --- |
| Label | Definition | Required |
| xml | Include xml parameter if xml output is desired | No |

```
<machines>
	<machine>
		<serial>63520</serial>
		<name>Flipper 1</name>
		<ipAddress>192.168.0.31</ipAddress>
		<lanes>1</lanes>
	</machine>
</machines>
```

###/api/operators/config/?xml

This route provides configuration definition for all operators in the system, as stored in the database

|  | Input Parameters |  |
| --- | --- | --- |
| Label | Definition | Required |
| xml | Include xml parameter if xml output is desired | No |

```
<operators>
	<operator>
		<code>117811</code> //Operator ID number
		<name>Brian Iguchi</name>
	</operator>
</operators>
```

###/api/items/config/?xml

This route provides configuration definition for all items in the system, as stored in the database

|  | Input Parameters |  |
| --- | --- | --- |
| Label | Definition | Required |
| xml | Include xml parameter if xml output is desired | No |

```
<items>
	<item>
		<number>1</number>
		<name>Incontinent Pad</name>
		<pace>720</pace>
		<area>1</area>
		<department>Towels</department>
		<weight/>
	</item>
</items>
```

###/api/machine/levelone/:serialNumber/xml

|  | Input Parameters |  |
| --- | --- | --- |
| Label | Definition | Required |
| serialNumber | Serial Number of Desired Machine | Yes |

Single Lane:
```
<levelOne>
	<operator>
		<id/>
		<name>None Entered</name>
	</operator>
	<task>
		<id>24</id>s
		<name>BarMop</name>
	</task>
	<pace>
		<standard>1380</standard>
		<current>0</current>
	</pace>
	<timeOnTask>0</timeOnTask>
	<totalCount>0</totalCount>
	<efficiency>0</efficiency>
	<fault>
		<code>3</code>
		<name>Stop</name>
	</fault>
</levelOne>
```

Multi-Lane:
```
<levelOne>
	<lanes>
		<lane>
			<number>1</number>
			<operator>
				<id>1<id/>
				<name>Jeremy Jones</name>
			</operator>
			<task>
				<id>24</id>
				<name>BarMop</name>
			</task>
			<pace>
				<standard>1380</standard>
				<current>0</current>
			</pace>
			<timeOnTask>0</timeOnTask>
			<totalCount>0</totalCount>
			<efficiency>0</efficiency>
		</lane>
		<lane>
			<number>2</number>
			<operator>
				<id>2<id/>
				<name>Brian Iguchi</name>
			</operator>
			<task>
				<id>24</id>
				<name>BarMop</name>
			</task>
			<pace>
				<standard>1380</standard>
				<current>0</current>
			</pace>
			<timeOnTask>0</timeOnTask>
			<totalCount>0</totalCount>
			<efficiency>0</efficiency>
		</lane>
		<lane>
			<number>3</number>
			<operator>
				<id>3<id/>
				<name>Jeremy Jones</name>
			</operator>
			<task>
				<id>24</id>
				<name>BarMop</name>
			</task>
			<pace>
				<standard>1380</standard>
				<current>0</current>
			</pace>
			<timeOnTask>0</timeOnTask>
			<totalCount>0</totalCount>
			<efficiency>0</efficiency>
		</lane>
		<lane>
			<number>4</number>
			<operator>
				<id>4<id/>
				<name>Travis Rice</name>
			</operator>
			<task>
				<id>24</id>
				<name>BarMop</name>
			</task>
			<pace>
				<standard>1380</standard>
				<current>0</current>
			</pace>
			<timeOnTask>0</timeOnTask>
			<totalCount>0</totalCount>
			<efficiency>0</efficiency>
		</lane>
	</lanes>
	<fault>
		<code>3</code>
		<name>Stop</name>
	</fault>
</levelOne>
```

###/api/machine/leveltwo/:serialNumber/xml

|  | Input Parameters |  |
| --- | --- | --- |
| Label | Definition | Required |
| serialNumber | Serial Number of Desired Machine | Yes |

```
<levelTwo>
	<timers>
		<run>63</run>
		<down>0</down>
		<total>63</total>
	</timers>
	<programNumber>2</programNumber>
	<item>
		<id>1</id>
		<name>Incontinent Pad</name>
	</item>
	<current>
		<pace>640</pace>
		<count>284</count>
	</current>
	<totals>
		<in>2493</in>
		<out>2384</out>
		<thru>95.63</thru>
		<faults>3</faults>
		<jams>14</jams>
	</totals>
	<availability>86.55</availability>
	<oee>68.47</oee>
	<operatorEfficiency>68.47</operatorEfficiency>
</levelTwo>
```