'use strict';

const debug = require('debug')('app:tweetHandler');
const fs = require('fs');
const Entities = require('html-entities').AllHtmlEntities;
const fetch = require('node-fetch');
const store = require('./store');
const discordClient = require('./discordClient');
const TweetsModel = require('./models/tweets');

debug('Loading tweetHandler.js');

const htmlEntities = new Entities();
const recentTweets = [];

// Process tweets
module.exports = (tweet, manual) => {
  // Handle tweet deletions first
  // The JSON structure is completely different on a deletion
  if (tweet.delete) {
    debug(tweet);
    debug(`TWEET: ${tweet.delete.status.id_str}: DELETED`);
    deleteTweet(tweet);
    return;
  }

  debug(`TWEET: ${tweet.id_str}: https://twitter.com/${tweet.user.screen_name}/status/${tweet.id_str}`);

  // Exit if tweet is not authored by a registered user we are currently streaming
  // This covers most re-tweets and replies unless from  another registered user
  if (!store.ids.includes(tweet.user.id_str)) {
    debug(`TWEET: ${tweet.id_str}: Authored by an unregistered user. Exiting.`);
    return;
  }

  // Ensure no duplicate tweets get posted
  // Keeps last 20 tweet ids in memory
  // Manual posts bypass this check
  if (!manual) {
    if (recentTweets.includes(tweet.id_str)) {
      debug(`TWEET: ${tweet.id_str}: Was recently processed. Duplicate? Exiting.`);
      return;
    }
    recentTweets.push(tweet.id_str);
    if (recentTweets.length > 20) {
      recentTweets.shift();
    }
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

  // Get the proper tweet context
  // The tweet or the re-tweeted tweet if it exists
  const context = tweet.retweeted_status || tweet;
  let text;
  let extendedEntities;
  // Use the extended tweet data if the tweet was truncated. ie over 140 chars
  if (tweet.truncated) {
    text = context.extended_tweet.full_text;
    extendedEntities = context.extended_tweet.extended_entities;
  } else {
    text = context.text; // eslint-disable-line prefer-destructuring
    extendedEntities = context.extended_entities;
  }
  // Decode html entities in the twitter text string so they appear correctly (&amp)
  text = htmlEntities.decode(text);
  debug(text);
  debug(extendedEntities);

  discordClient.send(tweet, `https://twitter.com/${tweet.user.screen_name}/status/${tweet.id_str}`);
};

function deleteTweet(tweet) {
  if (!tweet || !tweet.delete || !tweet.delete.status) return;
  debug(`TWEET: ${tweet.delete.status.id_str}: Processing deletion...`);
  // Find a matching record for the tweet id
  TweetsModel.findOne({ tweet_id: tweet.delete.status.id_str })
    .then(result => {
      debug(result);
      // Exit if no match or the messages property does not exist for some reason
      if (!result || !result.messages) return;
      result.messages
        .forEach(msg => {
          // Send a DELETE request to Discord api directly for each message we want to delete
          const uri = `https://discordapp.com/api/channels/${msg.channel_id}/messages/${msg.message_id}`;
          debug(uri);
          fetch(uri, {
            method: 'DELETE',
            headers: {
              Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
            },
          })
            .then(() => {
              debug('Twitter message deleted OK');
            })
            .catch(console.error);
        });
    })
    .catch(console.error);
}
