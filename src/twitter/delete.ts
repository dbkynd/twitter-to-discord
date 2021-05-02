import fs from 'fs'
import path from 'path'
import axios from 'axios'
import Posts from '../database/models/posts'
import { tweetDir } from '../directories'
import logger from '../logger'

export default async (tweet: Deleted): Promise<void> => {
  // Store the tweet for reference / tests
  if (process.env.NODE_ENV === 'development') {
    const filepath = path.join(
      tweetDir,
      `deleted-${tweet.delete.status.id_str}.json`,
    )
    logger.debug(`storing tweet JSON to: ${filepath}`)
    fs.writeFileSync(filepath, JSON.stringify(tweet, null, 2), {
      encoding: 'utf8',
    })
  }

  logger.info(`TWEET: ${tweet.delete.status.id_str}: DELETED`)

  let docs
  try {
    docs = await Posts.find({ tweet_id: tweet.delete.status.id_str })
  } catch (e) {
    logger.error('Database error')
    logger.error(e)
    return
  }

  docs.forEach((doc) => {
    // Exit if the messages property does not exist for some reason
    if (!doc.messages) return
    doc.messages.forEach(async (msg) => {
      // Send a DELETE request to Discord api directly for each message we want to delete
      const url = `https://discordapp.com/api/channels/${msg.channel_id}/messages/${msg.message_id}`
      logger.debug(url)
      await axios
        .delete(url, {
          headers: {
            Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
          },
        })
        .then(() => {
          logger.debug(
            `discord twitter post message delete OK ${msg.channel_id}-${msg.message_id}`,
          )
        })
        .catch((err) => {
          logger.debug(
            `discord twitter post message delete failure ${msg.channel_id}-${msg.message_id}`,
          )
          logger.error(err)
        })
    })
  })
}
