'use strict';

// Establish a connection to the mongodb
require('./mongodb');

// Connect to Discord
const discord = require('./discord');

discord.connect();

// Initial connection to Twitter Stream API on startup
const twitter = require('./twitter');

twitter.connect();
