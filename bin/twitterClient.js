'use strict';

const fs = require('fs');
const path = require('path');
const debug = require('debug')('app:twitterClient');
const TwitterStream = require('twitter-stream-api');
const feedsModel = require('./models/feeds');
const tweetHandler = require('./tweetHandler');
const store = require('./store');
const myEvents = require('./events');

debug('Loading twitterClient.js');

const twitter = new TwitterStream({
  consumer_key: process.env.TWITTER_CONSUMER_KEY,
  consumer_secret: process.env.TWITTER_CONSUMER_SECRET,
  token: process.env.TWITTER_ACCESS_TOKEN_KEY,
  token_secret: process.env.TWITTER_ACCESS_TOKEN_SECRET,
});

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
myEvents.on('post', data => {
  tweetHandler(data, true);
});

// See if we need to trigger a reload from somebody adding / removing things
setInterval(() => {
  if (!store.reload) return;
  debug('triggering twitter client reconnect due to reload flag');
  console.log('Scheduled restart of Twitter Client');
  module.exports.connect();
}, 1000 * 60 * 5);

// Remove any stored tweet.json that are older than 1 month
// Checked every 24 hours
setInterval(removeOldFiles, 1000 * 60 * 60 * 24);
// Run shortly after startup
setTimeout(removeOldFiles, 5000);

function close() {
  if (twitter.connection && twitter.connection.request) {
    debug('closing the open twitter connection');
    twitter.close();
  }
}

function removeOldFiles() {
  debug('checking for any old tweet.json files to remove');
  const folder = './tweets';
  fs.readdir(folder, (err, files) => {
    if (err) {
      console.error(err);
      return;
    }
    files.forEach(file => {
      fs.stat(path.join(folder, file), (err2, stat) => {
        if (err2) {
          console.error(err2);
          return;
        }
        const now = new Date().getTime();
        const endTime = new Date(stat.ctime).getTime() + 2419200000;
        if (now > endTime) {
          debug(`removing: ${path.join(folder, file)}`);
          fs.unlink(path.join(folder, file), err3 => {
            if (err3) {
              console.error(err3);
            }
          });
        }
      });
    });
  });
}

module.exports = {
  connect: () => {
    debug('starting twitter connect');
    store.reload = false;
    // Close the connection if already existing
    close();
    // Get all the registered twitter channel ids we need to connect to
    debug('getting channels from the mongodb');
    feedsModel.find()
      .then(results => {
        debug(results);
        const ids = results.map(x => x.twitter_id);
        console.log(`Streaming ${ids.length} twitter feed(s)`);
        store.ids = ids;
        if (ids.length === 0) {
          debug('there are no twitterChannels registered in the mongodb. no need to connect to twitter');
          return;
        }
        console.log('Attempting to connect to the Twitter stream API...');
        // Stream tweets
        twitter.stream('statuses/filter', {
          follow: ids,
          stall_warnings: true,
        });
      })
      .catch(err => {
        console.error('error reading from mongodb', err);
      });
  },
};
