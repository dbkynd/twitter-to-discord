import { Document, Schema, model } from 'mongoose'

const schema = new Schema({
  screen_name: String,
  twitter_id: String,
  channels: [
    {
      guild_id: String,
      channel_id: String,
      created_at: { type: Date, default: Date.now },
    },
  ],
  modified_on: { type: Date, default: Date.now },
})

export interface FeedChannel {
  guild_id: string
  channel_id: string
  created_at?: Date
}

export interface FeedDoc extends Document {
  screen_name: string
  twitter_id: string
  channels: FeedChannel[]
  modified_on?: Date
}

export default model<FeedDoc>('twitter_feeds', schema)
