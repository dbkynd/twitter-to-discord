interface Deleted {
  delete: Delete
}

interface Delete {
  status: DeleteStatus
  timestamp_ms: string
}

interface DeleteStatus {
  id: number
  id_str: string
  user_id: number
  user_id_str: string
}

type Status = import('twitter-d').Status
type FullUser = import('twitter-d').FullUser

interface ExtendedTweet {
  full_text: string
  display_text_range: [number, number]
  entities: import('twitter-d').Entities
}

interface Tweet extends Status {
  text: string
  extended_tweet: ExtendedTweet
  user: FullUser
  retweeted_status?: Tweet | null | undefined
}

type Media = { video?: string; image: string }

interface MediaProcessData {
  tempDirectory: string
  framesDirectory: string
  url: string
  videoLocation: string
  framesPath: string
}
