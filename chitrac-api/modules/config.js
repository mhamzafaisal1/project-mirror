require('dotenv').config();

module.exports = {
  nodeEnv: process.env.NODE_ENV,
  port: parseInt(process.env.PORT, 10) || 3000,

  // MongoDB (Main App)
  mongo: {
    url: process.env.MONGO_URI,
    db: process.env.MONGO_URI.split('/').pop() || 'chitrac'
  },

  // MongoDB (Winston Logging)
  mongoLog: {
    url: process.env.MONGO_LOG_URI,
    db: process.env.MONGO_LOG_DB
  },

  // Collection names
  operatorSessionCollectionName: 'operator-session',

  jwtSecret: process.env.JWT_SECRET,
  logLevel: process.env.LOG_LEVEL || 'info',
  inDev: process.env.NODE_ENV === 'development'
};
