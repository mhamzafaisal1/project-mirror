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

	let config;

	/** Handle run parameters */
	params.forEach((param, i) => {
		switch (param) {
			case 'development':
				process.env.NODE_ENV = 'development';
				config = reqlib('/configuration/dev');
				config.inDev = true;
				break;
			case 'production':
				process.env.NODE_ENV = 'production';
				config = reqlib('/configuration/default');
				break;
			case 'testing':
				process.env.NODE_ENV = 'testing';
				config = reqlib('/configuration/default');
				break;
			default:
				process.env.NODE_ENV = 'default';
				config = reqlib('/configuration/default');
				break;
		}
	});

	return config;
}