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

  if (!doc)
    return `**${user.screen_name}** is not registered to post tweets in any channels.`

  const index = doc.channels.findIndex(
    (x) => x.channel_id === channel && x.guild_id === guild.id,
  )

  if (index === -1)
    return `**${user.screen_name}** is not registered to receive tweets in this channel.`

  doc.channels.splice(index, 1)

  try {
    if (doc.channels.length) await doc.save()
    else await doc.remove()
  } catch (e) {
    return 'Database error. Please try again.'
  }

  if (!doc.channels.length) twitter.reload()

  return `This channel will no longer receive tweets from **${user.screen_name}**`
}
