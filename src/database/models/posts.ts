import { Document, Schema, model } from 'mongoose'

const schema = new Schema({
  tweet_id: String,
  messages: [
    {
      channel_id: String,
      message_id: String,
    },
  ],
})

export interface PostDoc extends Document {
  tweet_id: string
  messages: [
    {
      channel_id: string
      message_id: string
    },
  ]
}

export default model<PostDoc>('twitter_posts', schema)
