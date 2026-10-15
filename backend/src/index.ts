import { app } from './app.js';
import { getEnv } from './env.js';
import { logger } from './logger.js';
import { prisma } from './db.js';

const server = app.listen(getEnv().PORT, process.env.BACKEND_HOST || '0.0.0.0', () => {
  logger.info('Backend listening');
});
server.requestTimeout = 120000;
server.headersTimeout = 15000;
let stopping = false;
async function shutdown() {
  if (stopping) return;
  stopping = true;
  const deadline = setTimeout(() => process.exit(1), 15000);
  deadline.unref();
  server.close(async () => {
    await prisma.$disconnect();
    clearTimeout(deadline);
    process.exit(0);
  });
  server.closeIdleConnections();
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
