'use strict';

const debug = require('debug')('app:mongodb');
const mongoose = require('mongoose');

debug('Loading mongodb.js');

// Kill the process if the mongodb has a connection error within the first few seconds of launch
// Likely this is a format error with the MONGO_URI
const haltTimer = setTimeout(() => {
}, 1000 * 5);

// When successfully connected
mongoose.connection.on('connected', () => {
  console.log('mongodb: connection success');
  debug('stopping mongodb haltTimer');
  if (haltTimer) clearTimeout(haltTimer);
});

// If the connection throws an error
mongoose.connection.on('error', err => {
  console.error(`mongodb: connection error: ${err}`);
  if (haltTimer) {
    console.error('Error connecting to the mongodb in a timely manor. Please check the \'MONGO_URI\' for format/credential errors');
    process.exit(1);
  }
});

// When the connection is disconnected
mongoose.connection.on('disconnected', () => {
  console.warn('mongodb: connection disconnected');
});

// Connect
console.log('Attempting to connect to the mongodb...');
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  keepAlive: 1,
  connectTimeoutMS: 30000,
});

module.exports = mongoose;
