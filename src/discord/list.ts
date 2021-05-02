import Discord, { Util } from 'discord.js'
import Feeds from '../database/models/feeds'
import client from './index'

export default async function (
  guild: Discord.Guild,
  all: boolean,
): Promise<string> {
  let docs
  try {
    docs = await Feeds.find({})
  } catch (e) {
    return 'Database error. Please try again.'
  }

  if (!docs.length)
    return 'No twitter accounts are currently posting tweets to any channels.'

  let str = ''

  if (all) {
    docs
      .sort((a, b) => {
        const c = a.screen_name.toLowerCase()
        const d = b.screen_name.toLowerCase()
        if (c < d) return -1
        if (c > d) return 1
        return 0
      })
      .forEach((doc) => {
        const channels: Discord.GuildChannel[] = []
        doc.channels.forEach((c) => {
          const guild = client.guilds.cache.get(c.guild_id)
          if (!guild) return
          const channel = guild.channels.cache.get(c.channel_id)
          if (channel) channels.push(channel)
        })
        if (channels.length) {
          str += `**${Util.escapeMarkdown(
            makePossessive(doc.screen_name),
          )}** tweets are posted to:\n`
          str += channels
            .sort((a, b) => {
              const c = a.name.toLowerCase()
              const d = b.name.toLowerCase()
              if (c < d) return -1
              if (c > d) return 1
              return 0
            })
            .map(
              (x) =>
                `${Util.escapeMarkdown(
                  x.guild.name,
                )} - **#${Util.escapeMarkdown(x.name)}**`,
            )
            .join('\n')
          str += '\n\n'
        }
      })
  } else {
    docs
      .filter((doc) => doc.channels.find((c) => c.guild_id === guild.id))
      .sort((a, b) => {
        const c = a.screen_name.toLowerCase()
        const d = b.screen_name.toLowerCase()
        if (c < d) return -1
        if (c > d) return 1
        return 0
      })
      .forEach((doc) => {
        const channels: Discord.GuildChannel[] = []
        doc.channels.forEach((c) => {
          const guild = client.guilds.cache.get(c.guild_id)
          if (!guild) return
          const channel = guild.channels.cache.get(c.channel_id)
          if (channel) channels.push(channel)
        })
        if (channels.length) {
          str += `**${Util.escapeMarkdown(
            makePossessive(doc.screen_name),
          )}** tweets are posted to:\n`
          str += channels
            .sort((a, b) => {
              const c = a.name.toLowerCase()
              const d = b.name.toLowerCase()
              if (c < d) return -1
              if (c > d) return 1
              return 0
            })
            .join('\n')
          str += '\n\n'
        }
      })
  }

  if (!str)
    return 'No twitter accounts are currently posting tweets to any channels.'

  return str
}

function makePossessive(name: string): string {
  return `${name}'${name.endsWith('s') ? '' : 's'}`
}
