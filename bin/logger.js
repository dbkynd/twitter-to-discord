'use strict';

const { createLogger, format, transports } = require('winston');
const { inspect } = require('util');

const enumerateErrorFormat = format(info => {
  if (info.message instanceof Error) {
    info.message = Object.assign({ // eslint-disable-line no-param-reassign
      message: info.message.message,
      stack: info.message.stack,
    }, info.message);
  }

  if (info instanceof Error) {
    return Object.assign({
      message: info.message,
      stack: info.stack,
    }, info);
  }

  return info;
});

const logFormat = format.combine(
  format.colorize(),
  format.timestamp(),
  enumerateErrorFormat(),
  format.printf(info => {
    if (info.stack) {
      return `${info.timestamp} ${info.level}: ${info.stack}`;
    }
    if (typeof info.message === 'string') {
      return `${info.timestamp} ${info.level}: ${info.message}`;
    }
    return `${info.timestamp} ${info.level}: ${inspect(info.message, false, null, true)}`;
  }),
);

const logger = createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  transports: [
    new transports.Console(),
  ],
});

module.exports = logger;
