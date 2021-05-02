import { version } from '../package.json'
import * as app from './app'
import logger from './logger'

logger.info(`Starting the twitter-to-discord application v${version}`)

app.start().catch((err) => {
  logger.error(err.message)
  process.exit(1)
})

const signals: NodeJS.Signals[] = ['SIGHUP', 'SIGINT', 'SIGTERM']

signals.forEach((signal) => {
  process.on(signal, () => {
    shutdown(signal)
  })
})

const shutdown = (signal: NodeJS.Signals) => {
  logger.info(`Received a ${signal} signal. Attempting graceful shutdown...`)
  app.stop().finally(() => {
    logger.info(`Shutdown completed. Exiting.`)
    process.exit(0)
  })
}
