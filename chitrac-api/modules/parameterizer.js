module.exports = function() {
	return constructor();
}

function constructor() {
	/** Get any process arguments as params */
	const params = process.argv;

	/** Import defaults */
	const defaults = {
		'machines': require('../defaults/machine').machines,
		'items': require('../defaults/item').items
	};

	let config;

	/** Handle run parameters */
	params.forEach((param, i) => {
		switch (param) {
			case 'development':
				process.env.NODE_ENV = 'development';
				config = require('../configuration/dev');
				config.inDev = true;
				break;
			case 'production':
				process.env.NODE_ENV = 'production';
				config = require('../configuration/default');
				break;
			case 'testing':
				process.env.NODE_ENV = 'testing';
				config = require('../configuration/default');
				break;
			default:
				process.env.NODE_ENV = 'default';
				config = require('../configuration/default');
				break;
		}
	});

	return config;
}