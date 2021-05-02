import tweetStubs from '../../__stubs__/tweets'
import * as twitter from '../index'
import tweet from '../tweet'

jest.spyOn(twitter, 'getIds').mockImplementation(() => {
  return ['3512096904']
})

describe('tweet handler', () => {
  describe('text only', () => {
    it('does a thing', async () => {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      tweet(tweetStubs.text_only)
    })
  })
})
