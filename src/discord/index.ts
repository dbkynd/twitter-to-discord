import Discord, { Intents } from 'discord.js'
import logger from '../logger'
import manual from '../twitter/manual'
import * as commands from './commands'
import staleRecords from './stale_records'

const client = new Discord.Client({
  allowedMentions: {
    roles: [],
    repliedUser: true,
  },
  intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES],
})

client.on('disconnect', () => {
  logger.warn('Discord disconnected')
})

client.on('warn', (info) => {
  logger.warn('Discord warning')
  logger.warn(info)
})

client.on('reconnecting', () => {
  logger.info('Discord reconnecting')
})

client.on('resumed', () => {
  logger.info('Discord resumed')
})

client.on('error', (err) => {
  logger.error('Discord error')
  logger.error(err)
})

client.once('ready', () => {
  if (client.user) logger.info(`Discord connected as '${client.user.username}'`)
  else logger.info('Connected to Discord')
  setInterval(staleRecords, 1000 * 60 * 60)
  setTimeout(staleRecords, 1000 * 10)
  commands.register(client)
})

const r = new RegExp(`^${process.env.DISCORD_CMD_PREFIX}twitter manual (\\d+)`)

client.on('message', async (message) => {
  if (message.author.bot) return
  if (!process.env.DISCORD_CMD_PREFIX) return
  if (r.test(message.content)) {
    const match = message.content.match(r) || []
    if (!match.length) return
    manual(match[1], message.channel.id)
    return
  }
  if (message.content.startsWith(`${process.env.DISCORD_CMD_PREFIX}twitter`)) {
    await message.reply(
      'Now using slash commands for channel management. Please type ``/twitter`` to see options.',
    )
  }
})

client.on('interaction', async (interaction) => {
  try {
    await commands.handler(interaction)
  } catch (e) {
    logger.error(e)
  }
})

export async function connect(): Promise<void> {
  client.login(process.env.DISCORD_BOT_TOKEN).catch((err: Error) => {
    logger.error('Discord login error')
    throw err
  })
}

export async function disconnect(): Promise<void> {
  client.destroy()
  logger.info('Disconnected from Discord')
}

export default client
