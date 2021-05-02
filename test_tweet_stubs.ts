import tweets from './src/__stubs__/tweets'
import * as discord from './src/discord'
import * as twitter from './src/twitter'
import manual from './src/twitter/manual'

twitter.init()
discord.connect().then(run)

function run() {
  const keys = Object.keys(tweets)
  for (let i = 0; i < keys.length; i++) {
    const name = keys[i]
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const tweet: Tweet = tweets[name]
    const id = tweet.id_str
    setTimeout(() => {
      manual(id, '838270688883114015')
    }, i * 10000)
  }
}
