'use strict';

const debug = require('debug')('app:tweetHandler');
const fs = require('fs');
const Entities = require('html-entities').AllHtmlEntities;
const store = require('./store');
const discordClient = require('./discordClient');

debug('Loading tweetHandler.js');

const entities = new Entities();

// Process tweets
module.exports = (tweet, manual) => {
  debug(`TWEET: ${tweet.id_str}: https://twitter.com/${tweet.user.screen_name}/status/${tweet.id_str}`);

  // Exit if tweet is not authored by a registered user we are currently streaming
  // This covers most re-tweets and replies unless from  another registered user
  if (!store.ids.includes(tweet.user.id_str)) {
    debug(`TWEET: ${tweet.id_str}: Authored by an unregistered user. Exiting.`);
    return;
  }

  // Store the tweet for reference / tests
  // These are flushed after a months time daily
  fs.writeFileSync(`./tweets/${tweet.user.screen_name}-${tweet.id_str}${manual ? '-man' : ''}.json`,
    JSON.stringify(tweet, null, 2), { encoding: 'utf8' });

  // Exit if tweet is a reply not from the same user. ie in a thread
  if (tweet.in_reply_to_user_id_str && tweet.in_reply_to_user_id_str !== tweet.user.id_str) {
    debug(`TWEET: ${tweet.id_str}: Non-self reply. Exiting.`);
    return;
  }

  // Handle Tweet Deletions
  if (tweet.delete) {
    debug(`TWEET: ${tweet.id_str}: DELETED`);
    deleteTweet(tweet);
    return;
  }

  // Get the proper tweet context
  // The tweet or the re-tweeted tweet if it exists
  const context = tweet.retweeted_status || tweet;
  let text;
  let extendedEntities;
  if (context.extended_tweet && context.extended_tweet.full_text) {
    // Decode html entities in the twitter text string so they appear correctly (&amp)
    text = entities.decode(context.extended_tweet.full_text);
    extendedEntities = context.extended_tweet.extended_entities;
  } else {
    // Decode html entities in the twitter text string so they appear correctly (&amp)
    text = entities.decode(context.full_text || context.text);
    extendedEntities = context.extended_entities;
  }

  discordClient.send(tweet.user.id_str, `https://twitter.com/${tweet.user.screen_name}/status/${tweet.id_str}`);
};

function deleteTweet(tweet) {
  debug(`TWEET: ${tweet.id_str}: Processing deletion...`);
  /* client.mongo.tweetMessages.findOne({ tweet_id: tweet.delete.status.id_str })
     .then(result => {
       if (result && result.messages) {
         result.messages.forEach(msg => {
           const uri = `https://discordapp.com/api/channels/${msg.channelId}/messages/${msg.messageId}`;
           debug(uri);
           request.delete(uri)
             .set({ Authorization: `Bot ${config.bot_token}` })
             .then(() => {
               debug('Twitter message deleted OK');
             })
             .catch(err => {
               logger.error('Error deleting twitter message', err);
             });
         });
       }
     })
     .catch(logger.error);*/
}
