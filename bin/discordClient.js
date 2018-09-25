'use strict';

const Discord = require('discord.js');
const rimraf = require('rimraf');
const path = require('path');
const moment = require('moment');
const logger = require('./logger');
const commandHandler = require('./discordCommandHandler');
const FeedsModel = require('./models/feeds');
const PostsModel = require('./models/posts');
const utils = require('./utils');
const myEvents = require('./events');

logger.debug('Loading discordClient.js');

const client = new Discord.Client({
  disableEveryone: true,
  disabledEvents: [
    'TYPING_START',
  ],
});

// Discord has disconnected
client.on('disconnect', () => {
  logger.warn('discord: disconnected');
});

// Discord general warning
client.on('warn', info => {
  logger.warn('discord: warning');
  logger.warn(info);
});

// Discord is reconnecting
client.on('reconnecting', () => {
  logger.info('discord: reconnecting');
});

// Discord has resumed
client.on('resumed', replayed => {
  logger.info(`discord: resumed, replayed ${replayed} item(s)`);
});

// Discord has erred
client.on('error', err => {
  logger.error('discord: error:');
  logger.error(err);
});

client.on('ready', () => {
  logger.info('discord: connection success');
  logger.info(`discord: connected as '${client.user.username}'`);
  logger.info(`discord: command prefix: ${process.env.DISCORD_CMD_PREFIX}`);
});

// Only run the first time the discord client is ready
client.once('ready', () => {
  // Create a timer to check for stale records every hour
  setInterval(checkForStaleRecords, 1000 * 60 * 60);
  // Check for stale records 10 seconds after startup
  setTimeout(checkForStaleRecords, 1000 * 10);
});

client.on('message', msg => {
  // Don't listen to other bots
  if (msg.author.bot) return;
  // Exit if the message does not start with the prefix set
  if (!msg.content.startsWith(process.env.DISCORD_CMD_PREFIX)) return;
  // Exit if the author of the message is not the bot's owner or the guild's owner
  if (msg.author.id !== process.env.DISCORD_BOT_OWNER_ID
    && msg.author.id !== msg.guild.owner.id) return;
  // Split message into an array on any number of spaces
  msg.params = msg.content.split(/ +/g).map(x => x.toLowerCase()); // eslint-disable-line no-param-reassign
  // Pull first index and remove prefix
  msg.cmd = msg.params.shift() // eslint-disable-line no-param-reassign
    .slice(process.env.DISCORD_CMD_PREFIX.length).toLowerCase();
  // Exit if no command was given (prefix only)
  if (!msg.cmd) return;
  // We only want to focus on 'twitter' commands
  if (msg.cmd !== 'twitter') return;
  // These commands need to be run in a guild text channel to associate the guild id and channel id
  if (msg.channel.type === 'dm') {
    msg.author.send('This command does not work via DMs. Please run it in a guild\'s text channel.')
      .catch(logger.error);
    return;
  }
  logger.debug(`DISCORD: [${msg.guild.name}] (#${msg.channel.name}) <${msg.author.tag}>: ${msg.content}`);
  msg.prefix = process.env.DISCORD_CMD_PREFIX; // eslint-disable-line no-param-reassign
  commandHandler(msg);
});

module.exports = {
  connect: () => {
    logger.info('discord: connecting...');
    client.login(process.env.DISCORD_BOT_TOKEN)
      .catch(err => {
        logger.error('discord: login error');
        logger.error(err);
        process.exit(1);
      });
  },

  send: (tweet, str, files) => {
    // Get the record for the current feed
    FeedsModel.findOne({ twitter_id: tweet.user.id_str })
      .then(data => {
        // Get channels that exist and we have send message permissions in
        // Mapped into an array of promises
        const channels = data.channels
          .map(c => client.channels.get(c.channel_id))
          .filter(c => c && c.permissionsFor(client.user).has('SEND_MESSAGES'))
          .map(c => channelSend(c, str, files));
        if (channels.length === 0) {
          logger.info(`TWEET: ${tweet.id_str}: No valid Discord channel(s) found to post to. ${data.channels.length} registered`);
          return;
        }
        // Send to Discord channels
        utils.promiseSome(channels)
          .then(promiseResults => {
            logger.info(`TWEET: ${tweet.id_str}: Posted to ${promiseResults.filter(x => x).length}/${data.channels.length} Discord channel(s)`);
            const entry = new PostsModel({
              tweet_id: tweet.id_str,
              messages: promiseResults,
            });
            entry.save().catch(logger.error);
            // Remove the temp directory we made for converting gifs if it exists
            rimraf(path.join(process.env.TEMP, `tweet-${tweet.id_str}`), () => {
            });
          })
          .catch(logger.error);
      })
      .catch(logger.error);
  },
};

function channelSend(channel, str, files) {
  return new Promise((resolve, reject) => {
    channel.send(str, { files })
      .then(message => resolve({ channel_id: channel.id, message_id: message.id }))
      .catch(reject);
  });
}

myEvents.on('notify_discord', () => {
  while (utils.notify.length > 0) {
    // Shift the next notification entry out of the array
    const entry = utils.notify.shift();
    // Ensure that this entry is in the list of currently streamed ids
    if (utils.ids.includes(entry.twitter_id)) {
      // Get the discord cached data now in case something was changed between being added and now
      const user = client.users.get(entry.user_id);
      const channel = client.channels.get(entry.channel_id);
      // Ensure we have a user and a channel to post to
      if (user && channel) {
        channel.send(`${user}, The twitter feed for **${entry.screen_name}** has synced and will now be posted to this channel.`).catch(logger.error);
      }
    }
  }
});

function checkForStaleRecords() {
  logger.debug('checking for stale feed records');
  FeedsModel.find()
    .then(records => {
      logger.debug(`${records.length} total results`);
      records.forEach(record => {
        if (!record.channels && moment(record.modified_on) < moment().subtract(3, 'd')) {

        }
      });
    })
    .catch(logger.error);
}
