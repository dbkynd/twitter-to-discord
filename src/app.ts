import * as database from './database'
import * as discord from './discord'
import init from './init'
import * as twitter from './twitter'

export async function start(): Promise<void> {
  init()
  await database.connect()
  await discord.connect()
  twitter.init()
  twitter.start()
}

export async function stop(): Promise<void> {
  twitter.stop()
  await discord.disconnect()
  await database.disconnect()
}
