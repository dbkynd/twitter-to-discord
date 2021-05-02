import fs from 'fs'
import path from 'path'

export const tempDir = path.join(process.cwd(), 'temp')
export const tweetDir = path.join(process.cwd(), '.tweets')

if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir)

if (process.env.NODE_ENV === 'development') {
  if (!fs.existsSync(tweetDir)) fs.mkdirSync(tweetDir)
}
