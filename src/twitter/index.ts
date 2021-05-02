import Twit from 'twit'
import Twitter from 'twitter-d'
import Feeds from '../database/models/feeds'
import logger from '../logger'
import deleteTweet from './delete'
import tweet from './tweet'

let client: Twit
let stream: Twit.Stream
let _reload = false
let ids: string[] = []

export function init(): void {
  client = new Twit({
    consumer_key: process.env.TWITTER_CONSUMER_KEY,
    consumer_secret: process.env.TWITTER_CONSUMER_SECRET,
    access_token: process.env.TWITTER_ACCESS_TOKEN_KEY,
    access_token_secret: process.env.TWITTER_ACCESS_TOKEN_SECRET,
    timeout_ms: 1000 * 60,
    strictSSL: true,
  })
}

export function start(): void {
  // See if we need to trigger a reload from somebody adding / removing things
  // Checked every 5 minutes
  setInterval(() => {
    if (!_reload) return
    logger.debug('triggering twitter client reconnect due to reload flag')
    connect()
  }, 1000 * 60 * 5)
  connect()
}

export function reload(): void {
  _reload = true
}

export function getIds(): string[] {
  return ids
}

export function stop(): void {
  if (stream) stream.stop()
}

function connect() {
  logger.debug('starting twitter connect')
  _reload = false
  stop()
  // Get all the registered twitter channel ids we need to connect to
  logger.debug('getting channels from the mongodb')
  Feeds.find()
    .then((feeds) => {
      logger.debug(`total # of twitter feeds records: ${feeds.length}`)
      // Store the currently streamed ids
      ids = feeds.map((x) => x.twitter_id)
      if (ids.length === 0) {
        logger.debug(
          'there are no twitterChannels registered in the mongodb. no need to connect to twitter',
        )
        return
      }
      logger.info('twitter: connecting...')
      // Stream tweets
      stream = client
        .stream('statuses/filter', {
          follow: ids,
        })
        .on('connected', connected)
        .on('tweet', tweet)
        .on('delete', deleteTweet)
        .on('error', error)
    })
    .catch((err) => {
      logger.error('error reading from mongodb FeedsModel')
      logger.error(err)
    })
}

function connected() {
  logger.info('twitter: connection success')
}

function error(err: Error) {
  throw err
}

export async function getUser(
  screenName: string,
): Promise<Twitter.FullUser | null> {
  return new Promise((resolve, reject) => {
    if (!client) return reject()
    logger.debug(`lookup user: ${screenName}`)
    client
      .get('users/lookup', { screen_name: screenName })
      .then(({ data }) => {
        const users = data as Twitter.FullUser[]
        resolve(users[0])
      })
      .catch((err) => {
        if (err && err.code === 17) {
          return resolve(null)
        }
        reject()
      })
  })
}

export async function getTweet(id: string): Promise<Tweet> {
  return new Promise((resolve, reject) => {
    logger.debug(`manually looking up tweet: ${id}`)
    client
      .get('statuses/show', { id, tweet_mode: 'extended' })
      .then((response) => {
        const data = response.data as Tweet
        resolve(data)
      })
      .catch((err) => {
        logger.error(err)
        reject(err)
      })
  })
}
