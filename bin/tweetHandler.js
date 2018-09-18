const debug = require('debug')('app:tweetHandler');
const channels = require('./models/channels');

// Process tweets
module.exports = (tweet) => {
  debug(JSON.stringify(tweet, null, 2));
};
