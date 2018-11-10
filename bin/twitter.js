'use strict';

const Twitter = require('twitter-lite');
const logger = require('./logger');
const state = require('./state');
const FeedsModel = require('./models/feeds');
const tweetHandler = require('./tweet');
const myEvents = require('./events');

const client = new Twitter({
  consumer_key: process.env.TWITTER_CONSUMER_KEY,
  consumer_secret: process.env.TWITTER_CONSUMER_SECRET,
  access_token_key: process.env.TWITTER_ACCESS_TOKEN_KEY,
  access_token_secret: process.env.TWITTER_ACCESS_TOKEN_SECRET,
});

// See if we need to trigger a reload from somebody adding / removing things
// Checked every 5 minutes
setInterval(() => {
  if (!state.reload) return;
  logger.debug('triggering twitter client reconnect due to reload flag');
  logger.info('Scheduled restart of Twitter Client');
  connect();
}, 1000 * 60 * 5);

// Connect and start streaming from the Twitter Stream API
function connect() {
  logger.debug('starting twitter connect');
  // Reset the reload state to false as we are connecting / reconnecting
  state.reload = false;
  // Destroy any existing stream before creating a new one
  if (client && client.stream && client.stream.destroy) client.stream.destroy();
  // Get all the registered twitter channel ids we need to connect to
  logger.debug('getting channels from the mongodb');
  FeedsModel.find()
    .then(feeds => {
      logger.debug(`total # of twitter feeds records: ${feeds.length}`);
      // Store the currently streamed ids
      state.ids = feeds.map(x => x.twitter_id);
      if (state.ids.length === 0) {
        logger.debug('there are no twitterChannels registered in the mongodb. no need to connect to twitter');
        return;
      }
      logger.info('twitter: connecting...');
      // Stream tweets
      client.stream('statuses/filter', {
        follow: state.ids,
      })
        .on('start', start)
        .on('data', data)
        .on('ping', ping)
        .on('error', error)
        .on('end', end);
    })
    .catch(err => {
      logger.error('error reading from mongodb FeedsModel');
      logger.error(err);
    });
}

function start() {
  myEvents.emit('discord_notify');
}

function data(tweet) {
  tweetHandler(tweet);
}

myEvents.on('manual_post', tweet => {
  tweetHandler(tweet, true);
});

function ping() {
  logger.silly('ping');
}

function error(err) {
  console.error(err);
}

function end() {
  connect();
}

module.exports = {
  connect,
  getUser: screenName => new Promise((resolve, reject) => {
    logger.debug(`lookup user: ${screenName}`);
    client.get('users/lookup', { screen_name: screenName })
      .then(res => {
        resolve(res[0]);
      })
      .catch(err => {
        if (err && err.errors && err.errors[0]) {
          if (err.errors[0].code && err.errors[0].code === 17) {
            resolve(false);
            return;
          }
        }
        reject(err);
      });
  }),

  getTweet: id => new Promise((resolve, reject) => {
    logger.debug(`manually looking up tweet: ${id}`);
    client.get('statuses/show', { id, tweet_mode: 'extended' })
      .then(resolve)
      .catch(reject);
  }),
};
