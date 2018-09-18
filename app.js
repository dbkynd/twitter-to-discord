const debug = require('debug')('app:app');

console.log('Starting the twitter-to-discord application');

// Extract all the env variables we will be using
const {
  TWITTER_CONSUMER_KEY,
  TWITTER_CONSUMER_SECRET,
  TWITTER_ACCESS_TOKEN_KEY,
  TWITTER_ACCESS_TOKEN_SECRET,
  MONGO_URI,
  DISCORD_BOT_TOKEN,
  DISCORD_CMD_PREFIX,
  DISCORD_BOT_OWNER_ID,
} = process.env;

// Exit if the env variable was not set or passed. None can be empty
function envTest(value, name) {
  debug(name, value);
  if (!value) {
    console.error(`Missing the environment variable '${name}'`);
    process.exit(1);
  }
}

debug('checking that all the env variables are set');
envTest(TWITTER_CONSUMER_KEY, 'TWITTER_CONSUMER_KEY');
envTest(TWITTER_CONSUMER_SECRET, 'TWITTER_CONSUMER_SECRET');
envTest(TWITTER_ACCESS_TOKEN_KEY, 'TWITTER_ACCESS_TOKEN_KEY');
envTest(TWITTER_ACCESS_TOKEN_SECRET, 'TWITTER_ACCESS_TOKEN_SECRET');
envTest(MONGO_URI, 'MONGO_URI');
envTest(DISCORD_BOT_TOKEN, 'DISCORD_BOT_TOKEN');
envTest(DISCORD_CMD_PREFIX, 'DISCORD_CMD_PREFIX');
envTest(DISCORD_BOT_OWNER_ID, 'DISCORD_BOT_OWNER_ID');

// Establish a connection to the mongodb
require('./bin/mongodb');
// Connect to Discord
require('./bin/discordClient');

// Twitter client
const twitterClient = require('./bin/twitterClient');

// Initial connection to Twitter Stream API on startup
twitterClient.connect();
