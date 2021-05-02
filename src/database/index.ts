import mongoose from 'mongoose'
import logger from '../logger'

const options: mongoose.ConnectOptions = {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  keepAlive: true,
  connectTimeoutMS: 30000,
}

export async function connect(): Promise<void> {
  await mongoose
    .connect(process.env.MONGO_URI, options)
    .then(() => {
      logger.info('Connected to the MongoDB')
    })
    .catch((err) => {
      logger.error(err)
      throw new Error('Unable to connect to the MongoDB')
    })
}

export async function disconnect(): Promise<void> {
  await mongoose
    .disconnect()
    .then(() => {
      logger.info('Disconnected from the MongoDB')
    })
    .catch(() => {
      // Do Nothing
    })
}
