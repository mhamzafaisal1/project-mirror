module.exports = function() {
	return constructor();
}

function constructor() {
	/** Get any process arguments as params */
	const params = process.argv;

	/** Import defaults */
	const defaults = {
		'machines': reqlib('/defaults/machines').machines,
		'items': reqlib('/defaults/items').items
	};

	var config;

	/** Handle run parameters */
	params.forEach((param, i) => {
		switch (param) {
			case 'devevlopment':
				config = reqlib('/config/dev');
				config.inDev = true;
				break;
			default:
				config = reqlib('/config/default');
				break;
		}
	});

	return config;
}