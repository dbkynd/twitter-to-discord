'use strict';

const fetch = require('node-fetch');
const PostsModel = require('./models/posts');
const logger = require('./logger');

module.exports = tweet => {
  logger.info(`TWEET: ${tweet.delete.status.id_str}: DELETED`);
  if (!tweet || !tweet.delete || !tweet.delete.status) return;
  logger.debug(`TWEET: ${tweet.delete.status.id_str}: Processing deletion...`);
  // Find a matching record for the tweet id
  PostsModel.find({ tweet_id: tweet.delete.status.id_str })
    .then(results => {
      results.forEach(result => {
        // Exit if no match or the messages property does not exist for some reason
        if (!result || !result.messages) return;
        result.messages
          .forEach(msg => {
            // Send a DELETE request to Discord api directly for each message we want to delete
            const uri = `https://discordapp.com/api/channels/${msg.channel_id}/messages/${msg.message_id}`;
            logger.debug(uri);
            fetch(uri, {
              method: 'DELETE',
              headers: {
                Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
              },
            })
              .then(() => {
                logger.debug('discord twitter post message delete OK');
              })
              .catch(logger.error);
          });
      });
    })
    .catch(logger.error);
};
