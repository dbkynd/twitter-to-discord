'use strict';

const mongoose = require('mongoose');
const logger = require('./logger');

logger.debug('Loading mongodb.js');

// Kill the process if the mongodb has a connection error within the first few seconds of launch
// Likely this is a format error with the MONGO_URI
const haltTimer = setTimeout(() => {
}, 1000 * 5);

// When successfully connected
mongoose.connection.on('connected', () => {
  logger.info('mongodb: connection success');
  logger.debug('stopping mongodb haltTimer');
  if (haltTimer) clearTimeout(haltTimer);
});

// If the connection throws an error
mongoose.connection.on('error', err => {
  logger.error('mongodb: connection error');
  logger.error(err);
  if (haltTimer) {
    logger.error('Error connecting to the mongodb in a timely manor. Please check the \'MONGO_URI\' for format/credential errors');
    process.exit(1);
  }
});

// When the connection is disconnected
mongoose.connection.on('disconnected', () => {
  logger.warn('mongodb: connection disconnected');
});

// Connect
logger.info('mongodb: connecting...');
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  keepAlive: 1,
  connectTimeoutMS: 30000,
})
  .catch(logger.error);

module.exports = mongoose;
