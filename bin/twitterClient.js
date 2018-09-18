const debug = require('debug')('app:twitterClient');
const TwitterStream = require('twitter-stream-api');
const channelsModel = require('./models/channels');
const tweetHandler = require('./tweetHandler');

const twitter = new TwitterStream({
  consumer_key: process.env.TWITTER_CONSUMER_KEY,
  consumer_secret: process.env.TWITTER_CONSUMER_SECRET,
  token: process.env.TWITTER_ACCESS_TOKEN_KEY,
  token_secret: process.env.TWITTER_ACCESS_TOKEN_SECRET,
});

let reload = false;

twitter.on('connection success', url => {
  console.log('twitter: connection success');
  debug(url);
});

twitter.on('connection aborted', () => {
  console.warn('twitter: connection aborted');
});

twitter.on('connection error network', error => {
  console.warn('twitter: connection error network', error);
});

twitter.on('connection error stall', () => {
  console.warn('twitter: connection error stall');
});

twitter.on('connection error http', httpStatusCode => {
  if (httpStatusCode === 401) {
    console.error('twitter: 401 Unauthorized. Please check your Twitter application credentials.');
    process.exit(1);
  }
});

twitter.on('connection rate limit', httpStatusCode => {
  console.warn('twitter: connection rate limit', httpStatusCode);
});

twitter.on('connection error unknown', error => {
  console.warn('twitter: connection error unknown', error);
});

twitter.on('data keep-alive', () => {
  debug('twitter: data keep-alive');
});

twitter.on('data error', error => {
  console.error('twitter: data error', error);
});

twitter.on('data', tweetHandler);

// See if we need to trigger a reload from somebody adding / removing things
setInterval(() => {
  if (!reload) return;
  debug('triggering twitter client reconnect due to reload flag');
  console.log('Scheduled restart of Twitter Client');
  module.exports.connect();
}, 1000 * 60 * 5);

module.exports = {
  connect: () => {
    debug('starting twitter connect');
    reload = false;
    // Close the connection if already existing
    module.exports.close();
    // Get all the registered twitter channel ids we need to connect to
    debug('getting channels from the mongodb');
    channelsModel.find()
      .then(results => {
        debug(results);
        if (!results || results.length === 0) {
          debug('there are no twitterChannels registered in the mongodb. no need to connect to twitter');
          return;
        }
        console.log('Attempting to connect to the Twitter stream API...');
        // Stream tweets
        twitter.stream('statuses/filter', {
          follow: results.map(x => x.twitter_id),
          stall_warnings: true,
        });
      })
      .catch(err => {
        console.error('error reading from mongodb', err);
      });
  },
  close: () => {
    if (twitter.connection && twitter.connection.request) {
      debug('closing the open twitter connection');
      twitter.close();
    }
  },
  setReload: () => {
    reload = true;
  },
};
