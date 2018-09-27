'use strict';

const TwitterStream = require('twitter-stream-api');
const logger = require('./logger');
const tweetHandler = require('./tweetHandler');
const FeedsModel = require('./models/feeds');
const utils = require('./utils');
const myEvents = require('./events');

logger.debug('Loading twitterClient.js');

const twitter = new TwitterStream({
  consumer_key: process.env.TWITTER_CONSUMER_KEY,
  consumer_secret: process.env.TWITTER_CONSUMER_SECRET,
  token: process.env.TWITTER_ACCESS_TOKEN_KEY,
  token_secret: process.env.TWITTER_ACCESS_TOKEN_SECRET,
});

// Emitted when a successful connection to the Twitter Stream API is established.
twitter.on('connection success', url => {
  logger.info('twitter: connection success');
  logger.info(`twitter: streaming ${utils.ids.length} twitter feed(s)`);
  logger.debug(url);
  myEvents.emit('notify_discord');
});

// Emitted when a the connection to the Twitter Stream API is taken down / closed.
twitter.on('connection aborted', () => {
  logger.warn('twitter: connection aborted');
  // Clear the currently streamed ids array
  utils.ids = [];
});

// Emitted when the connection to the Twitter Stream API have TCP/IP level network errors.
// This event is normally emitted if there are network level errors during the connection process.
// When this event is emitted a linear reconnect will start.
// The reconnect will attempt a reconnect after 250 milliseconds
// and increase the reconnect attempts linearly up to 16 seconds.
twitter.on('connection error network', error => {
  logger.warn('twitter: connection error network');
  logger.warn(error);
});

// Emitted when the connection to the Twitter Stream API have been flagged as stall.
// A stall connection is a connection which have not received any new data
// or keep alive messages from the Twitter Stream API during a period of 90 seconds.
// This error event are normally emitted when a connection have been established
// but there has been a drop in it after a while.
// When this event is emitted a linear reconnect will start.
// The reconnect will attempt a reconnect after 250 milliseconds
// and increase the reconnect attempts linearly up to 16 seconds.
twitter.on('connection error stall', () => {
  logger.warn('twitter: connection error stall');
});

// Emitted when the connection to the Twitter Stream API return an HTTP error code.
// This error event is normally emitted if there are HTTP errors during the connection process.
// When this event is emitted a exponentially reconnect will start.
// The reconnect will attempt a reconnect after 5 seconds
// and increase the reconnect attempts exponentially up to 320 seconds.
twitter.on('connection error http', httpStatusCode => {
  if (httpStatusCode === 401) {
    logger.error('twitter: 401 Unauthorized. Please check your Twitter application credentials.');
    process.exit(1);
  }
});

// Emitted when the connection to the Twitter Stream API are being rate limited.
// Twitter does only allow one connection for each application to its Stream API.
// Multiple connections or to rapid reconnects will cause a rate limiting to happen.
// When this event is emitted a exponentially reconnect will start.
// The reconnect will attempt a reconnect after 1 minute
// and double the reconnect attempts exponentially.
twitter.on('connection rate limit', httpStatusCode => {
  logger.warn(`twitter: connection rate limit: ${httpStatusCode}`);
});

// Emitted when the connection to the Twitter Stream API throw an unexpected error
// which are not within the errors defined by the Twitter Stream API documentation.
// When this event is emitted the client will, if it can,
// keep the connection to the Twitter Stream API and not attempt to reconnect.
// Closing the connection and handling a possible reconnect
// must be handled by the consumer of the client.
twitter.on('connection error unknown', error => {
  logger.error('twitter: connection error unknown', error);
  logger.error(error);
  // Connect to twitter again
  // This will terminate the previous connection if it still exists
  connect();
});

// Emitted when the client receives a keep alive message from the Twitter Stream API.
// The Twitter Stream API sends a keep alive message every 30 seconds
// if no messages have been sent to ensure that the connection are kept open.
// These keep alive messages are mostly being used under the hood
// to detect stalled connections and other connection issues.
twitter.on('data keep-alive', () => {
  logger.verbose('twitter: data keep-alive');
});

// Emitted if the client received an message from the Twitter Stream API
// which the client could not parse into an object or handle in some other way.
twitter.on('data error', error => {
  logger.error('twitter: data error');
  logger.error(error);
});

// Emitted when a Tweet occurs in the stream.
twitter.on('data', tweetHandler);

// Internal event send from the discordCommandHandler
// This is used for the bot owner to manually post tweets for testing
myEvents.on('post', data => {
  tweetHandler(data, true);
});

// See if we need to trigger a reload from somebody adding / removing things
// Checked every 5 minutes
setInterval(() => {
  if (!utils.reload) return;
  logger.debug('triggering twitter client reconnect due to reload flag');
  logger.info('Scheduled restart of Twitter Client');
  module.exports.connect();
}, 1000 * 60 * 5);

function connect() {
  logger.debug('starting twitter connect');
  utils.reload = false;
  // Close the connection if already existing
  close();
  // Get all the registered twitter channel ids we need to connect to
  logger.debug('getting channels from the mongodb');
  FeedsModel.find()
    .then(results => {
      logger.debug(results.length);
      const ids = results.map(x => x.twitter_id);
      utils.ids = ids;
      if (ids.length === 0) {
        logger.debug('there are no twitterChannels registered in the mongodb. no need to connect to twitter');
        return;
      }
      logger.info('twitter: connecting...');
      // Stream tweets
      twitter.stream('statuses/filter', {
        follow: ids,
      });
    })
    .catch(err => {
      logger.error('error reading from mongodb');
      logger.error(err);
    });
}

function close() {
  if (twitter.connection && twitter.connection.request) {
    logger.debug('closing the open twitter connection');
    twitter.close();
  }
}

module.exports = {
  connect,
};
