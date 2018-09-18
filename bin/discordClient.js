const debug = require('debug')('app:discordClient');
const Discord = require('discord.js');
const commandHandler = require('./discordCommandHandler');

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
  const params = msg.content.split(/ +/g);
  // Pull first index and remove prefix
  const cmd = params.shift().slice(process.env.DISCORD_CMD_PREFIX.length).toLowerCase();
  // Exit if no command was given (prefix only)
  if (!cmd) return;
  // We only want to focus on 'twitter' commands
  if (cmd !== 'twitter') return;
  if (msg.channel.type === 'dm') {
    console.log(`[DM] <${msg.author.tag}>: ${msg.content}`);
  } else {
    console.log(`[${msg.guild.name}] (#${msg.channel.name}) <${msg.author.tag}>: ${msg.content}`);
  }
  msg.prefix = process.env.DISCORD_CMD_PREFIX; // eslint-disable-line no-param-reassign
  msg.cmd = cmd; // eslint-disable-line no-param-reassign
  msg.params = params.map(p => p.toLowerCase()); // eslint-disable-line no-param-reassign
  debug(msg.prefix, msg.cmd, msg.params);
  commandHandler(msg);
});

console.log('Attempting to connect to Discord...');
client.login(process.env.DISCORD_BOT_TOKEN)
  .catch(err => {
    console.error('discord: login error');
    if (err && err.message) console.error(err.message);
    process.exit(1);
  });
