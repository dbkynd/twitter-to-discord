'use strict';

// Internal event emitter to avoid cyclic modules
// Used to manually post twitter messages for testing
const EventEmitter = require('events');

class MyEmitter extends EventEmitter {}

const myEmitter = new MyEmitter();

module.exports = myEmitter;
