'use strict';

const fs = require('fs');
const path = require('path');
const Entities = require('html-entities').AllHtmlEntities;
const fetch = require('node-fetch');
const { exec } = require('child_process');
const logger = require('./logger');
const utils = require('./utils');
const discordClient = require('./discordClient');
const PostsModel = require('./models/posts');

logger.debug('Loading tweetHandler.js');

const htmlEntities = new Entities();
const recentTweets = [];

// Process tweets
module.exports = (tweet, manual) => {
  // Handle tweet deletions first
  // The JSON structure is completely different on a deletion
  if (tweet.delete) {
    logger.info(`TWEET: ${tweet.delete.status.id_str}: DELETED`);
    deleteTweet(tweet);
    return;
  }

  logger.debug(`TWEET: ${tweet.id_str}: https://twitter.com/${tweet.user.screen_name}/status/${tweet.id_str}`);

  // Exit if tweet is not authored by a registered user we are currently streaming
  // This covers most re-tweets and replies unless from  another registered user
  if (!utils.ids.includes(tweet.user.id_str)) {
    logger.debug(`TWEET: ${tweet.id_str}: Authored by an unregistered user. Exiting.`);
    return;
  }

  // Ensure no duplicate tweets get posted
  // Keeps last 20 tweet ids in memory
  // Manual posts bypass this check
  if (!manual) {
    if (recentTweets.includes(tweet.id_str)) {
      logger.debug(`TWEET: ${tweet.id_str}: Was recently processed. Duplicate? Exiting.`);
      return;
    }
    recentTweets.push(tweet.id_str);
    if (recentTweets.length > 20) {
      recentTweets.shift();
    }
  }

  // Store the tweet for reference / tests
  // These are flushed after a months time daily
  if (process.env.NODE_ENV === 'development') {
    const filepath = `./tweets/${tweet.user.screen_name}-${tweet.id_str}${manual ? '-man' : ''}.json`;
    logger.debug(`storing tweet JSON to: ${filepath}`);
    fs.writeFileSync(filepath, JSON.stringify(tweet, null, 2), { encoding: 'utf8' });
  }

  // Exit if tweet is a reply not from the same user. ie in a thread
  if (tweet.in_reply_to_user_id_str && tweet.in_reply_to_user_id_str !== tweet.user.id_str) {
    logger.debug(`TWEET: ${tweet.id_str}: Non-self reply. Exiting.`);
    return;
  }

  logger.info(`TWEET: ${tweet.id_str}: https://twitter.com/${tweet.user.screen_name}/status/${tweet.id_str}`);

  // Get the proper tweet context
  // The tweet or the re-tweeted tweet if it exists
  const context = tweet.retweeted_status || tweet;
  let text;
  let extendedEntities;
  // The json object we get back from a manual tweet is slightly different from a streamed tweet
  if (manual) {
    text = context.full_text;
    extendedEntities = context.extended_entities;
  } else if (tweet.truncated) {
    // Use the extended tweet data if the tweet was truncated. ie over 140 chars
    text = context.extended_tweet.full_text;
    extendedEntities = context.extended_tweet.extended_entities;
  } else {
    // Use the standard tweet data
    text = context.text; // eslint-disable-line prefer-destructuring
    extendedEntities = context.extended_entities;
  }

  // Decode html entities in the twitter text string so they appear correctly (&amp)
  let modifiedText = htmlEntities.decode(text);

  // Array to hold picture and gif urls we will extract from extended_entities
  const mediaUrls = [];
  // Array of urls we have escaped to avoid escaping more than once
  const escapedUrls = [];

  if (extendedEntities) {
    // Extract photos
    extendedEntities.media.filter(media => media.type === 'photo')
      .forEach(media => {
        // Add image to media list
        mediaUrls.push({ image: media.media_url_https });
        // Escape the media url so it does not auto-embed in discord
        // Wrapped in <>
        // Only escape once
        if (!escapedUrls.includes(media.url)) {
          escapedUrls.push(media.url);
          modifiedText = modifiedText.replace(media.url, `<${media.url}>`);
        }
      });

    // Extract gifs
    extendedEntities.media.filter(media => media.type === 'animated_gif')
      .forEach(media => {
        // Get the mp4 data object
        const video = media.video_info.variants[0].url;
        // Use the media image as backup if conversion fails
        const image = media.media_url_https;
        // Add media data to list
        mediaUrls.push({ video, image });
        // Escape the media url so it does not auto-embed in discord
        // Wrapped in <>
        // Only escape once
        if (!escapedUrls.includes(media.url)) {
          escapedUrls.push(media.url);
          modifiedText = modifiedText.replace(media.url, `<${media.url}>`);
        }
      });
  }

  // Trim any whitespace left from replacing strings in the modifiedText string
  modifiedText = modifiedText.trim();

  // Create a new string to send to Discord
  let str = `\`\`\`qml\nNew Tweet from ${tweet.user.screen_name}:\`\`\``
    + `<https://twitter.com/${tweet.user.screen_name}/status/${tweet.id_str}>\n`;
  if (modifiedText) {
    let nameRT;
    if (tweet.retweeted_status) nameRT = tweet.retweeted_status.user.screen_name;
    str += `\n${nameRT ? `RT @${nameRT}: ` : ''}${modifiedText}\n`;
  }

  // Process the media entries
  utils.promiseSome(mediaUrls.map(urls => processMediaEntry(urls, tweet.id_str)))
    .then(media => {
      // There are no files to attach
      if (media.length === 0) {
        // Send to the Discord Client
        discordClient.send(tweet, str);
        return;
      }
      // Attach files to discord message
      let num = media.length;
      // Map the object as discord.js expects it
      // Decremental filename to do our best to sort the same as twitter did
      const files = media.map(file => {
        const p = path.parse(file);
        return { attachment: file, name: `${num--}${p.ext}` };
      });
      discordClient.send(tweet, str, files);
    })
    .catch(err => {
      logger.error(err);
      // Send the string to the Discord Client regardless that the media promise failed
      // This should not occur if a single media element fails but due to a greater internal concern
      // as promiseSome does not reject on a single promise rejection unlike Promise.All
      discordClient.send(tweet, str);
    });
};

function processMediaEntry(media, id) {
  return new Promise((resolve, reject) => {
    // If there is only an image we don't have to do anything
    if (!media.video && media.image) {
      resolve(media.image);
      return;
    }
    // Create a data object to pass through all the promises
    // It will mutate along the way
    const data = {
      tempDirectory: path.join(process.env.TEMP, `tweet-${id}`),
      framesDirectory: path.join(process.env.TEMP, `tweet-${id}`, 'frames'),
      url: media.video,
    };
    // Promise chain to transform mp4 into gif
    utils.createDir(data.tempDirectory)
      .then(() => saveVideo(data))
      .then(videoLocation => {
        data.videoLocation = videoLocation;
        return utils.createDir(data.framesDirectory);
      })
      .then(() => createFrames(data))
      .then(framesPath => {
        data.framesPath = framesPath;
        return createGIF(data);
      })
      .then(gifLocation => resolve(gifLocation))
      .catch(reject);
  });
}

// Save MP4 to temp tweet folder
function saveVideo(data) {
  return new Promise((resolve, reject) => {
    const location = path.join(data.tempDirectory, 'video.mp4');
    fetch(data.url)
      .then(res => {
        const dest = fs.createWriteStream(location);
        res.body.pipe(dest);
        res.body.on('error', err => {
          reject(err);
        });
        dest.on('finish', () => {
          resolve(location);
        });
        dest.on('error', err => {
          reject(err);
        });
      });
  });
}

// Use ffmpeg to get images of the movie at intervals and save them to the frames dir
function createFrames(data) {
  return new Promise((resolve, reject) => {
    const location = path.join(data.framesDirectory, '/ffout%03d.png');
    exec(`ffmpeg -i "${data.videoLocation}" -vf scale=250:-1:flags=lanczos,fps=10 "${location}"`,
      (err) => {
        if (err) {
          reject(err);
        } else {
          resolve(location);
        }
      });
  });
}

// Use GraphicsMagik to convert frames into a gif
function createGIF(data) {
  return new Promise((resolve, reject) => {
    const frames = data.framesPath.replace('ffout%03d.png', 'ffout*.png');
    const location = path.join(data.tempDirectory, 'video.gif');
    exec(`gm convert -loop 0 "${frames}" "${location}"`,
      (err) => {
        if (err) {
          reject(err);
        } else {
          resolve(location);
        }
      });
  });
}

function deleteTweet(tweet) {
  if (!tweet || !tweet.delete || !tweet.delete.status) return;
  logger.debug(`TWEET: ${tweet.delete.status.id_str}: Processing deletion...`);
  // Find a matching record for the tweet id
  PostsModel.find({ tweet_id: tweet.delete.status.id_str })
    .then(results => {
      results.forEach(result => {
        // Exit if no match or the messages property does not exist for some reason
        if (!result || !result.messages) return;
        result.messages
          .forEach(msg => {
            // Send a DELETE request to Discord api directly for each message we want to delete
            const uri = `https://discordapp.com/api/channels/${msg.channel_id}/messages/${msg.message_id}`;
            logger.debug(uri);
            fetch(uri, {
              method: 'DELETE',
              headers: {
                Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
              },
            })
              .then(() => {
                logger.debug('discord twitter post message delete OK');
              })
              .catch(logger.error);
          });
      });
    })
    .catch(logger.error);
}
