import tweet from './tweet'
import { getTweet } from './index'

export default (id: string, discordChannelId: string): void => {
  getTweet(id).then((data) => {
    setId(discordChannelId)
    tweet(data)
  })
}

let channelId: string | null = null

export function setId(id: string): void {
  channelId = id
}

export function getId(): string | null {
  return channelId
}

export function clearId(): void {
  channelId = null
}
