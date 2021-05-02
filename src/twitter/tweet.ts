import { exec } from 'child_process'
import fs from 'fs'
import path from 'path'
import axios from 'axios'
import Discord from 'discord.js'
import { decode as htmlDecode } from 'html-entities'
import { tempDir, tweetDir } from '../directories'
import post from '../discord/post'
import logger from '../logger'
import * as utilities from '../utilities'
import { getId } from './manual'
import { getIds } from './index'

const recentTweets: string[] = []

export default (tweet: Tweet): void => {
  logger.debug(
    `TWEET: ${tweet.id_str}: https://twitter.com/${tweet.user.screen_name}/status/${tweet.id_str}`,
  )

  // Store the tweet for reference / tests
  if (process.env.NODE_ENV === 'development') {
    const filepath = path.join(
      tweetDir,
      `${tweet.user.screen_name}-${tweet.id_str}.json`,
    )
    logger.debug(`storing tweet JSON to: ${filepath}`)
    fs.writeFileSync(filepath, JSON.stringify(tweet, null, 2), {
      encoding: 'utf8',
    })
  }

  if (!getId()) {
    // Exit if tweet is not authored by a registered user we are currently streaming
    // This covers most re-tweets and replies unless from another registered user
    if (!getIds().includes(tweet.user.id_str)) {
      logger.debug(
        `TWEET: ${tweet.id_str}: Authored by an unregistered user. Exiting.`,
      )
      return
    }

    // Ensure no duplicate tweets get posted
    // Keeps last 20 tweet ids in memory
    if (recentTweets.includes(tweet.id_str)) {
      logger.debug(
        `TWEET: ${tweet.id_str}: Was recently processed. Duplicate? Exiting.`,
      )
      return
    }
    recentTweets.push(tweet.id_str)
    if (recentTweets.length > 20) recentTweets.shift()

    // Exit if tweet is in a thread but not from the thread author
    if (
      tweet.in_reply_to_user_id_str &&
      tweet.in_reply_to_user_id_str !== tweet.user.id_str
    ) {
      logger.debug(`TWEET: ${tweet.id_str}: Non-self reply. Exiting.`)
      return
    }
  }

  // Get the proper tweet context
  // The tweet or the re-tweeted tweet if it exists
  const context = tweet.retweeted_status || tweet
  let text: string
  const extendedEntities = context.extended_entities
  // The json object we get back from a manual tweet is slightly different from a streamed tweet
  if (getId()) {
    text = tweet.full_text
  } else if (tweet.truncated) {
    // Use the extended tweet data if the tweet was truncated. ie over 140 chars
    text = context.extended_tweet.full_text
    // extendedEntities = context.extended_tweet.extended_entities
  } else {
    // Use the standard tweet data
    text = context.text
    // extendedEntities = context.extended_entities
  }

  if (text.startsWith('@')) {
    logger.debug(`TWEET: ${tweet.id_str}: @ reply. Exiting.`)
    return
  }

  logger.info(
    `TWEET: ${tweet.id_str}: https://twitter.com/${tweet.user.screen_name}/status/${tweet.id_str}`,
  )

  // Decode html entities in the twitter text string so they appear correctly (&amp)
  let modifiedText = htmlDecode(text)

  // Array to hold picture and gif urls we will extract from extended_entities
  const mediaUrls: Media[] = []
  // Array of urls we have escaped to avoid escaping more than once
  const escapedUrls: string[] = []

  if (extendedEntities && extendedEntities.media) {
    // Extract photos
    extendedEntities.media
      .filter((media) => media.type === 'photo')
      .forEach((media) => {
        // Add image to media list
        mediaUrls.push({ image: media.media_url_https })
        // Escape the media url so it does not auto-embed in discord
        // Wrapped in <>
        // Only escape once
        if (!escapedUrls.includes(media.url)) {
          escapedUrls.push(media.url)
          // modifiedText = modifiedText.replace(media.url, `<${media.url}>`)
          modifiedText = modifiedText.replace(media.url, '')
        }
      })

    // Extract gifs
    extendedEntities.media
      .filter((media) => media.type === 'animated_gif')
      .forEach((media) => {
        // Get the mp4 data object
        const video = media.video_info?.variants?.[0]?.url
        // Use the media image as backup if conversion fails
        const image = media.media_url_https
        // Add media data to list
        mediaUrls.push({ video, image })
        // Escape the media url so it does not auto-embed in discord
        // Wrapped in <>
        // Only escape once
        if (!escapedUrls.includes(media.url)) {
          escapedUrls.push(media.url)
          // modifiedText = modifiedText.replace(media.url, `<${media.url}>`)
          modifiedText = modifiedText.replace(media.url, '')
        }
      })
  }

  // Trim any whitespace left from replacing strings in the modifiedText string
  // Remove any t.co links from the text
  // replace(/<?https:\/\/t\.co\/(\w+)>?/g, '')
  modifiedText = modifiedText.trim()

  // Create a new string to send to Discord
  let str =
    `\`\`\`qml\nNew Tweet from ${tweet.user.screen_name}:\`\`\`` +
    `<https://twitter.com/${tweet.user.screen_name}/status/${tweet.id_str}>\n`
  if (modifiedText) {
    let nameRT
    if (tweet.retweeted_status) nameRT = tweet.retweeted_status.user.screen_name
    str += `\n${nameRT ? `RT @${nameRT}: ` : ''}${modifiedText}\n`
  }

  // Process the media entries
  utilities
    .promiseSome(mediaUrls.map((urls) => processMediaEntry(urls, tweet.id_str)))
    .then((media) => {
      // There are no files to attach
      if (media.length === 0) {
        // Send to the Discord Client
        post(tweet, str)
        return
      }
      // Attach files to discord message
      let num = media.length
      // Map the object as discord.js expects it
      // Decremental filename to do our best to sort the same as twitter did
      const files: Discord.FileOptions[] = media.map((file: string) => {
        const p = path.parse(file)
        return { attachment: file, name: `${num--}${p.ext}` }
      })
      post(tweet, str, files)
    })
    .catch((err) => {
      logger.error(err)
      // Send the string to the Discord Client regardless that the media promise failed
      // This should not occur if a single media element fails but due to a greater internal concern
      // as promiseSome does not reject on a single promise rejection unlike Promise.All
      post(tweet, str)
    })
}

function processMediaEntry(media: Media, id: string) {
  return new Promise((resolve, reject) => {
    // If there is only an image we don't have to do anything
    if (!media.video) {
      resolve(media.image)
      return
    }
    // Create a data object to pass through all the promises
    // It will mutate along the way
    const data: MediaProcessData = {
      tempDirectory: path.join(tempDir, `tweet-${id}`),
      framesDirectory: path.join(tempDir, `tweet-${id}`, 'frames'),
      url: media.video,
      videoLocation: '',
      framesPath: '',
    }
    // Promise chain to transform mp4 into gif
    utilities
      .createDir(data.tempDirectory)
      .then(() => saveVideo(data))
      .then((videoLocation) => {
        data.videoLocation = videoLocation
        return utilities.createDir(data.framesDirectory)
      })
      .then(() => createFrames(data))
      .then((framesPath) => {
        data.framesPath = framesPath
        return createGIF(data)
      })
      .then((gifLocation) => resolve(gifLocation))
      .catch(reject)
  })
}

// Save MP4 to temp tweet folder
function saveVideo(data: MediaProcessData): Promise<string> {
  return new Promise((resolve, reject) => {
    const location = path.join(data.tempDirectory, 'video.mp4')
    axios
      .get(data.url, { responseType: 'arraybuffer' })
      .then(({ data }) => {
        fs.writeFile(location, data, (err) => {
          if (err) return reject(err)
          resolve(location)
        })
      })
      .catch(reject)
  })
}

// Use ffmpeg to get images of the movie at intervals and save them to the frames dir
function createFrames(data: MediaProcessData): Promise<string> {
  return new Promise((resolve, reject) => {
    const location = path.join(data.framesDirectory, '/ffout%03d.png')
    exec(
      `ffmpeg -i "${data.videoLocation}" -vf scale=250:-1:flags=lanczos,fps=10 "${location}"`,
      (err) => {
        if (err) {
          reject(err)
        } else {
          resolve(location)
        }
      },
    )
  })
}

// Use GraphicsMagik to convert frames into a gif
function createGIF(data: MediaProcessData): Promise<string> {
  return new Promise((resolve, reject) => {
    const frames = data.framesPath.replace('ffout%03d.png', 'ffout*.png')
    const location = path.join(data.tempDirectory, 'video.gif')
    exec(`gm convert -loop 0 "${frames}" "${location}"`, (err) => {
      if (err) {
        reject(err)
      } else {
        resolve(location)
      }
    })
  })
}
