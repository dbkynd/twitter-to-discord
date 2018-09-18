const debug = require('debug')('app:twitterAPI');
const Twitter = require('twitter');

const twitter = new Twitter({
  consumer_key: process.env.TWITTER_CONSUMER_KEY,
  consumer_secret: process.env.TWITTER_CONSUMER_SECRET,
  access_token_key: process.env.TWITTER_ACCESS_TOKEN_KEY,
  access_token_secret: process.env.TWITTER_ACCESS_TOKEN_SECRET,
});

module.exports = {
  getUser: screenName => new Promise((resolve, reject) => {
    debug(`lookup user: ${screenName}`);
    twitter.get('users/lookup', { screen_name: screenName }, (err, body, res) => {
      if (err || res.statusCode !== 200) {
        debug(err);
        if (err[0] || err[0].code === 17) {
          resolve(false);
        } else {
          reject(err || res.statusCode);
        }
      } else {
        debug(body[0]);
        resolve(body[0]);
      }
    });
  }),
};
