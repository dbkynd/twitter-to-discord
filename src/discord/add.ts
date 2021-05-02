import Discord from 'discord.js'
import Twitter from 'twitter-d'
import Feeds from '../database/models/feeds'
import * as twitter from '../twitter'

export default async function (
  name: string,
  channel: string,
  guild: Discord.Guild,
): Promise<string> {
  let user: Twitter.FullUser | null
  try {
    user = await twitter.getUser(name)
  } catch (e) {
    return 'Twitter API error. Please try again.'
  }

  if (!user) return `**${name}** is not a registered twitter account.`

  let doc
  try {
    doc = await Feeds.findOne({ twitter_id: user.id_str })
  } catch (e) {
    return 'Database error. Please try again.'
  }

  if (doc) {
    const addThisChannel = !doc.channels.find(
      (x) => x.guild_id === guild.id && x.channel_id === channel,
    )
    if (addThisChannel) {
      doc.channels.push({
        guild_id: guild.id,
        channel_id: channel,
      })
      doc.modified_on = new Date()

      try {
        await doc.save()
      } catch (e) {
        return 'Database error. Please try again.'
      }

      return `This channel will now receive tweets from **${user.screen_name}**.`
    } else {
      return `This channel already receives tweets from **${user.screen_name}**`
    }
  } else {
    const entry = new Feeds({
      screen_name: user.screen_name,
      twitter_id: user.id_str,
      channels: [
        {
          guild_id: guild.id,
          channel_id: channel,
        },
      ],
    })

    try {
      await entry.save()
    } catch (e) {
      return 'Database error. Please try again.'
    }

    twitter.reload()
    return `This channel will now receive tweets from **${user.screen_name}**\n\nWe are not yet streaming that twitter feed. Please allow up to 5 minutes to sync.`
  }
}
