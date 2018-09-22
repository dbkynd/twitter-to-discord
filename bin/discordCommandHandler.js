'use strict';

const debug = require('debug')('app:commandHandler');
const Discord = require('discord.js');
const FeedsModel = require('./models/feeds');
const twitterAPI = require('./twitterAPI');
const store = require('./store');
const myEvents = require('./events');

debug('Loading discordCommandHandler.js');

module.exports = msg => {
  // These commands need to be run in a guild text channel to associate the guild id and channel id
  if (msg.channel.type === 'dm') {
    debug('message was ran in a DM channel');
    msg.author.send('This command does not work via DMs. Please run it in a guild\'s text channel.')
      .catch(console.error);
    return;
  }

  // If only the command was run with no parameters show the root usage message
  if (msg.params.length === 0) {
    debug('not enough parameters to continue');
    msg.channel.send(`Usage: \`\`${msg.prefix}${msg.cmd} <add | remove | list>\`\``).catch(console.error);
    return;
  }

  // Get the command action - add | remove | list
  const action = msg.params[0];
  // Get the command target. For add and remove this will be a twitter screen name
  const target = msg.params[1];
  debug(action, target);

  // Decide what action to take
  switch (action) {
    case 'add':
      if (!hasTarget()) return;
      getSingleRecord(target)
        .then(data => addChannel(msg, target, data))
        .catch(console.error);
      break;
    case 'remove':
      if (!hasTarget()) return;
      getSingleRecord(target)
        .then(data => removeChannel(msg, target, data))
        .catch(console.error);
      break;
    case 'list':
      getAllRecords()
        .then(data => listChannels(msg, target, data))
        .catch(console.error);
      break;
    case 'post':
      // Only the bot owner can manually post tweets
      // Used to test the application
      if (msg.author.id !== process.env.DISCORD_BOT_OWNER_ID) return;
      if (!hasTarget()) return;
      if (!/^\d+$/.test(target)) {
        msg.channel.send(`**${target}** is not a valid tweet ID.`).catch(console.error);
        return;
      }
      twitterAPI.getTweet(target)
        .then(data => {
          myEvents.emit('post', data);
        })
        .catch(err => {
          if (err && err[0] && err[0].code === 8) {
            msg.channel.send(err[0].message).catch(console.error);
          } else {
            console.error(err);
          }
        });
      break;
    default:
      msg.channel.send(`Usage: \`\`${msg.prefix}${msg.cmd} <add | remove | list>\`\``).catch(console.error);
  }

  function hasTarget() {
    if (!target) {
      debug('no target. unable to continue');
      msg.channel.send(`Usage: \`\`${msg.prefix}${msg.cmd} ${action} <target>\`\``).catch(console.error);
      return false;
    }
    return true;
  }
};

function getSingleRecord(screenName) {
  return new Promise((resolve, reject) => {
    const name = new RegExp(`^${screenName}$`, 'i');
    FeedsModel.findOne({ screen_name: name })
      .then(resolve)
      .catch(reject);
  });
}

function getAllRecords() {
  return new Promise((resolve, reject) => {
    FeedsModel.find()
      .then(resolve)
      .catch(reject);
  });
}

function addChannel(msg, target, data) {
  debug('addChannel', data);
  // We have data about this twitter user
  if (data) {
    // See if this channel is already registered or if we need to add this channel
    const addThisChannel = !data.channels
      .find(x => x.guild_id === msg.guild.id && x.channel_id === msg.channel.id);
    debug(addThisChannel);
    if (addThisChannel) {
      // Add this channel / guild to the array of channels
      data.channels.push({
        guild_id: msg.guild.id,
        channel_id: msg.channel.id,
      });
      // Save the modified record back to the database
      data.save({ upsert: true })
        .then(() => {
          msg.channel.send(`This channel will now receive tweets from **${data.screen_name}**.`)
            .catch(console.error);
        })
        .catch(err => {
          console.error(err);
          msg.channel.send('There was an issue communicating with the database. Please try again later.')
            .catch(console.error);
        });
    } else {
      // Don't add this channel because it is already added
      msg.channel.send(`This channel already receives tweets from **${data.screen_name}**`)
        .catch(console.error);
    }
  } else {
    // We do not have any data for this twitter screen_name
    twitterAPI.getUser(target)
      .then(userData => {
        // Exit if the target screen_name is not a registered twitter user
        if (userData === false) {
          msg.channel.send(`**${target}** is not a registered twitter account.`).catch(console.error);
          return;
        }
        // Create the record to save
        const entry = FeedsModel({
          screen_name: userData.screen_name,
          twitter_id: userData.id_str,
          channels: [{
            guild_id: msg.guild.id,
            channel_id: msg.channel.id,
          }],
        });
        debug(entry);
        // Save the new record
        entry.save()
          .then(() => {
            msg.channel.send(`This channel will now receive tweets from **${entry.screen_name}**`)
              .catch(console.error);
            debug('New user added, flagging twitter reload');
            store.reload = true;
          })
          .catch(err => {
            console.error(err);
            msg.channel.send('There was an issue communicating with the database. Please try again later.')
              .catch(console.error);
          });
      })
      .catch(console.error);
  }
}

function removeChannel(msg, target, data) {
  debug('removeChannel', data);
  // We have data for this twitter screen_name
  if (data) {
    // Get the channel index of the channel we ran this command in
    let index = -1;
    for (let i = 0; i < data.channels.length; i++) {
      if (data.channels[i].channel_id === msg.channel.id
        && data.channels[i].guild_id === msg.guild.id) {
        index = i;
        break;
      }
    }
    // The channel we are in is currently registered
    debug('channel index:', index);
    if (index === -1) {
      // The channel we are in is not currently registered
      msg.channel.send(`**${data.screen_name}** is not registered to receive tweets in this channel.`)
        .catch(console.error);
    } else {
      // Splice this channel out of the channels array
      data.channels.splice(index, 1);
      debug('post splice channels length:', data.channels.length);
      let databaseAction;
      if (data.channels.length > 0) {
        debug('removing channel from record');
        databaseAction = data.save({ upsert: true });
      } else {
        debug('removing entire record');
        databaseAction = data.remove();
      }
      databaseAction.then(() => {
        msg.channel.send(`This channel will no longer receive tweets from **${data.screen_name}**`)
          .catch(console.error);
        if (data.channels.length === 0) {
          debug('Old user removed, flagging reload');
          store.reload = true;
        }
      })
        .catch(err => {
          console.error(err);
          msg.channel.send('There was an issue communicating with the database. Please try again later.')
            .catch(console.error);
        });
    }
  } else {
    // We do not have any data for this twitter screen_name
    // Determine if the name was entered incorrectly
    twitterAPI.getUser(target)
      .then(userData => {
        // Exit if the target screen_name is not a registered twitter user
        if (userData === false) {
          msg.channel.send(`**${target}** is not a registered twitter account.`).catch(console.error);
          return;
        }
        msg.channel.send(`**${userData.screen_name}** is not registered to post tweets in any channels.`)
          .catch(console.error);
      })
      .catch(console.error);
  }
}

function listChannels(msg, target, data) {
  debug('listChannel', data.length);
  // Tell the user if we have 0 records
  // The database is empty
  if (data.length === 0) {
    msg.channel.send('No twitter accounts are currently posting tweets to any channels.').catch(console.error);
    return;
  }
  // Build a string to post to Discord
  let str = '';
  // Only the bot owner can request to see what is happening in all the guilds
  if (target === 'all' && msg.author.id === process.env.DISCORD_BOT_OWNER_ID) {
    debug('listing twitter feeds for all guilds');
    data.forEach(result => {
      // Get channels that currently exist
      // It's possible to have a channel registered that was later deleted
      // Remove null entries
      // Map the string for each item
      const channels = result.channels.map(c => msg.client.channels.get(c.channel_id))
        .filter(x => x)
        .map(x => `${Discord.escapeMarkdown(x.guild.name)} - **#${Discord.escapeMarkdown(x.name)}**`);
      // Only add to string if we have channels
      if (channels.length > 0) {
        str += `**${Discord.escapeMarkdown(makePossessive(result.screen_name))}** tweets are posted to:\n`;
        str += channels.join('\n');
        str += '\n\n';
      }
    });
  } else {
    debug('listing twitter feeds for this guild only');
    // Get only feeds that post to any channel in this guild
    data.filter(x => x.channels.find(c => c.guild_id === msg.guild.id))
      .forEach(x => {
        // Only get the specific channels that are posted to in each guild
        const channels = x.channels.filter(c => c.guild_id === msg.guild.id)
          .map(c => msg.client.channels.get(c.channel_id))
          .filter(y => y);
        if (channels.length > 0) {
          str += `**${Discord.escapeMarkdown(makePossessive(x.screen_name))}** tweets are posted to:\n`;
          str += channels.join('\n');
          str += '\n\n';
        }
      });
  }
  if (!str) {
    msg.channel.send('No twitter accounts are currently posting tweets to any channels.').catch(console.error);
    return;
  }
  msg.channel.send(str, { split: { maxLength: 1800 } }).catch(console.error);
}

function makePossessive(name) {
  return `${name}'${name.endsWith('s') ? '' : 's'}`;
}
