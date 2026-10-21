import pino from 'pino';
import { getEnv } from './env.js';

const env = getEnv();

export const logger = pino({
  level: env.LOG_LEVEL,
  // pino-http serializes request headers, including Clerk bearer tokens.
  redact: {
    paths: ['req.headers.authorization', 'req.headers.cookie', 'res.headers["set-cookie"]'],
    censor: '[REDACTED]',
  },
  ...(env.NODE_ENV === 'development'
    ? {
        transport: {
          target: 'pino-pretty',
          options: { colorize: true, translateTime: 'HH:MM:ss' },
        },
      }
    : {}),
});
