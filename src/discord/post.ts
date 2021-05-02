import path from 'path'
import Discord from 'discord.js'
import rimraf from 'rimraf'
import Feeds from '../database/models/feeds'
import Posts from '../database/models/posts'
import logger from '../logger'
import { clearId, getId } from '../twitter/manual'
import * as utilities from '../utilities'
import client from './index'

export default function (
  tweet: Tweet,
  text: string,
  files?: Discord.FileOptions[],
): void {
  if (getId()) return manualPost(tweet, text, files)

  // Get the record for the current feed
  Feeds.findOne({ twitter_id: tweet.user.id_str })
    .then((data) => {
      if (!data || !data.channels) return
      // Get channels that exist and we have send message permissions in
      // Mapped into an array of promises
      const channels: Discord.GuildChannel[] = []
      data.channels.forEach((channel) => {
        if (!client.user) return
        const guild = client.guilds.cache.get(channel.guild_id)
        if (!guild) return
        const chan = guild.channels.cache.get(channel.channel_id)
        if (!chan) return
        if (!chan.isText()) return
        const perms = chan.permissionsFor(client.user)
        if (!perms || !perms.has('SEND_MESSAGES')) return
        channels.push(chan)
      })
      const channelsPromise = channels.map((c) => channelSend(c, text, files))
      if (channelsPromise.length === 0) {
        logger.info(
          `TWEET: ${tweet.id_str}: No valid Discord channel(s) found to post to. ${data.channels.length} registered`,
        )
        return
      }
      // Send to Discord channels
      utilities
        .promiseSome(channelsPromise)
        .then((promiseResults: Discord.Message[]) => {
          logger.info(
            `TWEET: ${tweet.id_str}: Posted to ${
              promiseResults.filter((x) => x).length
            }/${data.channels.length} Discord channel(s)`,
          )
          const entry = new Posts({
            tweet_id: tweet.id_str,
            messages: promiseResults,
          })
          entry.save().catch(logger.error)
          // Remove the temp directory we made for converting gifs if it exists
          rimraf(path.join(process.env.TEMP, `tweet-${tweet.id_str}`), () => {
            // Do Nothing
          })
        })
        .catch(logger.error)
    })
    .catch(logger.error)
}

function channelSend(
  channel: Discord.GuildChannel,
  text: string,
  files?: Discord.FileOptions[],
): Promise<{ channel_id: string; message_id: string }> {
  return new Promise((resolve, reject) => {
    if (!channel.isText()) return reject()
    channel
      .send(text, { files })
      .then((message: Discord.Message) =>
        resolve({ channel_id: channel.id, message_id: message.id }),
      )
      .catch(reject)
  })
}

function manualPost(tweet: Tweet, text: string, files?: Discord.FileOptions[]) {
  const channelId = getId()
  logger.debug(`manual post to: ${channelId}`)
  if (!channelId) return
  client.channels
    .fetch(channelId)
    .then((channel) => {
      if (!channel) return
      if (!channel.isText()) return
      if (channel.type === 'dm') return
      channelSend(channel as Discord.GuildChannel, text, files)
        .catch(() => {
          // Do Nothing
        })
        .finally(() => {
          rimraf(path.join(process.env.TEMP, `tweet-${tweet.id_str}`), () => {
            // Do Nothing
          })
        })
    })
    .catch((err) => {
      logger.error(err)
    })
    .finally(() => {
      clearId()
    })
}
