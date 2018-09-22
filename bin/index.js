'use strict';

// Establish a connection to the mongodb
require('./mongodb');

// Connect to Discord
const discordClient = require('./discordClient');

discordClient.connect();

// Initial connection to Twitter Stream API on startup
const twitterClient = require('./twitterClient');

twitterClient.connect();
