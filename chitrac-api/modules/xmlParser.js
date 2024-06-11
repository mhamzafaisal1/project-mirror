/** Load xml2js an */
const xml = require('xml2js');
const builder = new xml.Builder({ renderOpts: { 'pretty': false }, explicitRoot: false });

async function xmlArrayBuilder(rootLabel, array, excludeHeader) {
	let arrayBuilder = new xml.Builder({ renderOpts: { 'pretty': false }, headless: true, rootName: rootLabel });
	let returnString;
	let tagCloseString = 's>';
	if (rootLabel.substring(rootLabel.length - 1) == 's') {
		tagCloseString = 'es>';
	}
	if (excludeHeader) {
		returnString = '<' + rootLabel + tagCloseString;
	} else {
		returnString = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><' + rootLabel + tagCloseString;
	}
	if (!(Array.isArray(array))) {
		array = Array.from(array);
	}

	await array.forEach((element) => {
		returnString += arrayBuilder.buildObject(element);
	});
	returnString += '</' + rootLabel + tagCloseString;
	return returnString;
}

async function levelOneMachineBuilder(machinesJSON) {
	let xmlString = '';
	for (const machine of machinesJSON) {
		let operatorXML = await xmlArrayBuilder('operator', machine.operators, true);
		delete machine.operators;
		let taskXML = await xmlArrayBuilder('task', machine.tasks, true);
		delete machine.tasks;

		let machineXMLBuilder = new xml.Builder({ renderOpts: { 'pretty': false }, headless: true, rootName: 'machine' });
		let machineXML = await machineXMLBuilder.buildObject(machine);

		let splitArray = machineXML.split('</machine>');
		let machineString = splitArray[0];
		machineString += operatorXML;
		machineString += taskXML;
		machineString += '</machine>';
		xmlString += machineString;
	}
	return xmlString;
}

async function levelOneBuilder(machinesJSON) {
	let xmlString = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><levelone>';
	xmlString += await levelOneMachineBuilder(machinesJSON);
	xmlString += '</levelone>';

	return xmlString;
}

function xmlMachineStateBuilder(machineObject, callback) {
	machineObject.machine['id'] = machineObject.ID;
	machineObject.machine['name'] = machineObject.MachineName;
	machineObject.machine['lanes'] = machineObject.Lanes;
	delete machineObject.ID;
	delete machineObject.SerialNumb;
	delete machineObject.MachineName;
	delete machineObject.Active;
	delete machineObject.DateAdded;
	delete machineObject.IPAddress;
	delete machineObject.Lanes;
	delete machineObject.timestamp;

	//Deep copy the object arrays for separate parsing
	let lpOperators = machineObject.lpOperators.map((x) => x);
	let spOperators = machineObject.spOperators.map((x) => x);
	let items = machineObject.items.map((x) => x);
	let itemInfo = machineObject.itemInfo.map((x) => x);
	let lpOperatorInfo = machineObject.lpOperatorInfo.map((x) => x);
	let spOperatorInfo = machineObject.spOperatorInfo.map((x) => x);
	let statusInfo = machineObject.statusInfo.map((x) => x);

	//Delete the arrays from the object so we can parse the main object easily
	delete machineObject.lpOperators;
	delete machineObject.spOperators;
	delete machineObject.items;
	delete machineObject.itemInfo;
	delete machineObject.lpOperatorInfo;
	delete machineObject.spOperatorInfo;
	delete machineObject.statusInfo;

	let machineBuilder = new xml.Builder({ renderOpts: { 'pretty': false }, rootName: 'machineState' });
	/*let lpOperatorsBuilder = new xml.Builder({ renderOpts: { 'pretty': false }, headless: true, rootName: 'lpOperators' });
	let spOperatorsBuilder = new xml.Builder({ renderOpts: { 'pretty': false }, headless: true, rootName: 'spOperators' });
	let itemsBuilder = new xml.Builder({ renderOpts: { 'pretty': false }, headless: true, rootName: 'items' });
	let itemInfoBuilder = new xml.Builder({ renderOpts: { 'pretty': false }, headless: true, rootName: 'itemInfo' });
	let lpOperatorInfoBuilder = new xml.Builder({ renderOpts: { 'pretty': false }, headless: true, rootName: 'lpOperatorInfo' });
	let spOperatorInfoBuilder = new xml.Builder({ renderOpts: { 'pretty': false }, headless: true, rootName: 'spOperatorInfo' });
	let statusInfoBuilder = new xml.Builder({ renderOpts: { 'pretty': false }, headless: true, rootName: 'statusInfo' });*/
	let xmlString = machineBuilder.buildObject(machineObject);
	/*let splitArray = xmlString.split('</machineState>');
	xmlString = splitArray[0];
	xmlString += xmlArrayBuilder('lpOperator', lpOperators);
	xmlString += xmlArrayBuilder('spOperator', spOperators);
	xmlString += xmlArrayBuilder('item', items);
	xmlString += xmlArrayBuilder('itemInfo', itemInfo);
	if (lpOperatorInfo.length) { xmlString += xmlArrayBuilder('lpOperatorInfo', lpOperatorInfo); }
	if (spOperatorInfo.lenght) { xmlString += xmlArrayBuilder('spOperatorInfo', spOperatorInfo); }
	xmlString += statusInfoBuilder.buildObject(statusInfo[0]);
	xmlString += '</machineState>';*/
	return callback(xmlString);
} //kept for posterity, may leave behind

exports.xmlArrayBuilder = xmlArrayBuilder;
exports.levelOneBuilder = levelOneBuilder;
exports.xml = xml;