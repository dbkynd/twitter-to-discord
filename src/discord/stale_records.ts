import moment from 'moment'
import Feeds, { FeedChannel } from '../database/models/feeds'
import client from '../discord'
import logger from '../logger'
import * as twitter from '../twitter'

export default async function (): Promise<void> {
  logger.debug('checking for stale feed records')

  let docs
  try {
    docs = await Feeds.find({})
  } catch (e) {
    logger.error('Database error')
    return
  }
  logger.debug(`${docs.length} total results`)

  let removedRecords = 0
  let removedChannels = 0

  docs.forEach((doc) => {
    // Remove record if there have been no channels registered to it for over 3 days
    if (
      (!doc.channels || !doc.channels.length) &&
      moment(doc.modified_on).add(3, 'd') < moment()
    ) {
      logger.debug(
        `record has no or 0 channels for over 3 days, removing record: ${doc.screen_name}`,
      )
      removedRecords++
      doc
        .remove()
        .then(() => {
          logger.debug(`record removed: ${doc.screen_name}`)
        })
        .catch(logger.error)
      return
    }

    logger.silly(`checking channels for: ${doc.screen_name}`)
    const validChannels: FeedChannel[] = []

    // Loop through the registered channels and ensure they still exist
    // and have send permissions at a minimum
    doc.channels.forEach((x) => {
      if (!client.user) return
      if (moment(x.created_at).add(3, 'd') > moment()) {
        // This record was created within the last 3 days
        // Give them time to get their permissions correctly set
        // Consider valid
        validChannels.push(x)
        return
      }
      const guild = client.guilds.cache.get(x.guild_id)
      if (!guild || !guild.available) {
        logger.debug(`the guild ${x.guild_id} does not exist or is unavailable`)
        return
      }
      const channel = guild.channels.cache.get(x.channel_id)
      if (!channel) {
        logger.debug(
          `the channel ${x.channel_id} does not exist or is unavailable`,
        )
        return
      }
      const perms = channel.permissionsFor(client.user)
      if (!perms || !perms.has('SEND_MESSAGES')) {
        logger.debug(
          `the channel ${x.channel_id} does not have the required permissions`,
        )
        return
      }
      validChannels.push(x)
    })

    if (validChannels.length === 0) {
      // There are no valid channels left
      logger.debug(
        `no channels left for this record after validating accessibility, removing record: ${doc.screen_name}`,
      )
      removedRecords++
      doc
        .remove()
        .then(() => {
          logger.debug(`record removed: ${doc.screen_name}`)
        })
        .catch(logger.error)
      return
    }

    // See if the amount of valid channels has changed
    if (doc.channels.length !== validChannels.length) {
      const diff = doc.channels.length - validChannels.length
      // Update the record with the valid channels
      logger.debug(`updating record - minus ${diff} channels`)
      removedChannels += diff
      doc.channels = validChannels
      doc
        .save()
        .then(() => {
          logger.debug(`record updated: ${doc.screen_name}`)
        })
        .catch(logger.error)
    }
  })

  if (removedRecords === 0 && removedChannels === 0) {
    logger.debug('no stale records')
    return
  }
  logger.info(
    `Removed ${removedRecords} stale record(s) and ${removedChannels} stale channel(s) from the database`,
  )

  twitter.reload()
}
