'use strict';

const debug = require('debug')('app:discordClient');
const Discord = require('discord.js');
const commandHandler = require('./discordCommandHandler');
const feedsModel = require('./models/feeds');

debug('Loading discordClient.js');

const client = new Discord.Client({
  disableEveryone: true,
  disabledEvents: [
    'TYPING_START',
  ],
});

// Discord has disconnected
client.on('disconnect', () => {
  console.warn('discord: disconnected');
});

// Discord general warning
client.on('warn', info => {
  console.warn('discord: warning', info);
});

// Discord is reconnecting
client.on('reconnecting', () => {
  console.info('discord: reconnecting');
});

// Discord has resumed
client.on('resumed', replayed => {
  console.info(`discord: resumed, replayed ${replayed} item(s)`);
});

// Discord has erred
client.on('error', err => {
  console.error('discord: error:', err ? err.stack : '');
});

client.on('ready', () => {
  console.info(`discord: connection success: connected as '${client.user.username}'`);
  console.log(`discord: command prefix: ${process.env.DISCORD_CMD_PREFIX}`);
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
  if (msg.channel.type === 'dm') {
    console.log(`[DM] <${msg.author.tag}>: ${msg.content}`);
  } else {
    console.log(`[${msg.guild.name}] (#${msg.channel.name}) <${msg.author.tag}>: ${msg.content}`);
  }
  msg.prefix = process.env.DISCORD_CMD_PREFIX; // eslint-disable-line no-param-reassign
  debug(msg.prefix, msg.cmd, msg.params);
  commandHandler(msg);
});

module.exports = {
  connect: () => {
    console.log('Attempting to connect to Discord...');
    client.login(process.env.DISCORD_BOT_TOKEN)
      .catch(err => {
        console.error('discord: login error');
        if (err && err.message) console.error(err.message);
        process.exit(1);
      });
  },
  send: (id, str, files) => {
    // Get the record for the current feed
    feedsModel.findOne({ twitter_id: id })
      .then(data => {
        const channels = data.channels
          .map(c => client.channels.get(c.channel_id))
          .filter(c => c && c.permissionsFor(client.user).has('SEND_MESSAGES'))
          .map(c => channelSend(c, str, files));
        promiseSome(channels)
          .then(promiseResults => {
            debug(promiseResults);

          })
          .catch(console.error);
      })
      .catch(console.error);
  },
};

// Similar to Promise.all except it will not reject if one of the promises rejects
// Instead we will get a null result
function promiseSome(array) {
  return new Promise((resolve) => {
    // Create an array of the same length as the promise array to hold results
    const results = Array(array.length);
    let num = 0;
    for (let i = 0; i < array.length; i++) {
      Promise.resolve(array[i]).then(resolvedResults => {
        results[i] = resolvedResults;
        checkIfDone();
      }).catch(() => {
        results[i] = null;
        checkIfDone();
      });
    }

    function checkIfDone() {
      num++;
      if (num >= array.length) resolve(results);
    }
  });
}

function channelSend(channel, str, files) {
  return new Promise((resolve, reject) => {
    channel.send(str, { files })
      .then(message => resolve({ channelId: channel.id, messageId: message.id }))
      .catch(reject);
  });
}
