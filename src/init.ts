import fs from 'fs'
import commandExists from 'command-exists'
import { tempDir } from './directories'

const requiredEnv = [
  'TWITTER_CONSUMER_KEY',
  'TWITTER_CONSUMER_SECRET',
  'TWITTER_ACCESS_TOKEN_KEY',
  'TWITTER_ACCESS_TOKEN_SECRET',
  'MONGO_URI',
  'DISCORD_BOT_TOKEN',
  'DISCORD_BOT_OWNER_ID',
]

export default (): void => {
  requiredEnv.forEach((variable) => {
    if (!process.env[variable]) {
      throw new Error(`Missing the environment variable '${variable}'`)
    }
  })

  try {
    fs.accessSync(tempDir, fs.constants.F_OK)
  } catch (err) {
    throw new Error(`Unable to access the temp directory: ${tempDir}`)
  }

  if (!commandExists.sync('ffmpeg')) {
    throw new Error("'ffmpeg' is not available on the command line")
  }
  if (!commandExists.sync('gm')) {
    throw new Error("'gm' is not available on the command line")
  }
}
