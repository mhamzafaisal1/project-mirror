module.exports = {
    'api': {
        'port': 90
    },
    'sql': {
        'server': 'DevSrv',
        'port': 50799,
        'user': 'EBChiTracUser',
        'password': 'EBChiTracUser#2200@2017',
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