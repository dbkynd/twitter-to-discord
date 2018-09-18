const debug = require('debug')('app:commandHandler');
const channelsModel = require('./models/channels');
const twitterAPI = require('./twitterAPI');
const twitterClient = require('./twitterClient');

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

  // If we are adding / removing and have not given a target screen_name show the usage
  if (action !== 'list' && msg.params.length < 2) {
    debug('not enough parameters to continue');
    msg.channel.send(`Usage: \`\`${msg.prefix}${msg.cmd} ${action} <target>\`\``).catch(console.error);
    return;
  }

  // Decide what action to take
  switch (action) {
    case 'add':
      getSingleRecord(target)
        .then(data => addChannel(msg, target, data))
        .catch(console.error);
      break;
    case 'remove':
      getSingleRecord(target)
        .then(data => removeChannel(msg, target, data))
        .catch(console.error);
      break;
    case 'list':
      break;
    default:
      msg.channel.send(`Usage: \`\`${msg.prefix}${msg.cmd} <add | remove | list>\`\``).catch(console.error);
  }
};

function getSingleRecord(screenName) {
  return new Promise((resolve, reject) => {
    const name = new RegExp(`^${screenName}$`, 'i');
    channelsModel.findOne({ screen_name: name })
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
      msg.channel.send(`This channel already receives tweets from **${data.screen_name}**.`)
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
        const entry = channelsModel({
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
            msg.channel.send(`This channel will now receive tweets from **${entry.screen_name}**.`)
              .catch(console.error);
            debug('New user added, flagging twitter reload');
            twitterClient.setReload();
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
        msg.channel.send(`This channel will no longer receive tweets from **${data.screen_name}**.`)
          .catch(console.error);
        if (data.channels.length === 0) {
          debug('Old user removed, flagging reload');
          twitterClient.setReload();
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
