import * as app from '../app'
import * as database from '../database'
import * as discord from '../discord'
import init from '../init'
import * as twitter from '../twitter'

jest.mock('../init')
jest.mock('../database')
jest.mock('../discord')
jest.mock('../twitter')

describe('app module', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('start method', () => {
    beforeEach(async () => {
      await app.start()
    })

    it('calls the init method', () => {
      expect(init).toHaveBeenCalledTimes(1)
    })

    it('connects to the database', () => {
      expect(database.connect).toHaveBeenCalledTimes(1)
    })

    it('connects to discord', () => {
      expect(discord.connect).toHaveBeenCalledTimes(1)
    })

    it('inits the twitter client', () => {
      expect(twitter.init).toHaveBeenCalledTimes(1)
    })
  })

  describe('stop method', () => {
    beforeEach(async () => {
      await app.stop()
    })

    it('stops the twitter stream', () => {
      expect(twitter.stop).toHaveBeenCalledTimes(1)
    })

    it('disconnects to discord', () => {
      expect(discord.disconnect).toHaveBeenCalledTimes(1)
    })

    it('disconnects from the database', () => {
      expect(database.disconnect).toHaveBeenCalledTimes(1)
    })
  })
})
