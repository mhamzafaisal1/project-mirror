module.exports = {
    'api': {
        'port': 90
    },
    'sql': {
        'server': 'ChiTracSrv',
        'port': 50799,
        'user': 'ChiTracSrv',
        'password': 'ChiTracSrv@2022',
        'database': 'ChiTrac',
        'requestTimeout': 30000
    },
    'mongo': {
        'url': 'mongodb://212.212.212.215:27017',
    	'db': 'chitrac'
    },
    'mongoLog': {
        url: 'mongodb://212.212.212.215:27017',
        db: 'chitrac-logging'
    }
}