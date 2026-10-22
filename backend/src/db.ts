import { PrismaClient } from '@prisma/client';
import { getEnv } from './env.js';
import { recordDatabaseTiming } from './middleware/requestTiming.js';

const env = getEnv();
// Numeric diagnostics only; never expose the connection URL or credentials.
export const runtimeDatabasePoolLimit = Number(new URL(env.DATABASE_URL).searchParams.get('connection_limit')) || null;

export const prisma = new PrismaClient({
  log: env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});

if (env.NODE_ENV === 'development') prisma.$use(async (params, next) => {
  const start = performance.now();
  try { return await next(params); }
  finally { recordDatabaseTiming(performance.now() - start); }
});
