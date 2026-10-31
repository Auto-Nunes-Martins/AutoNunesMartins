import { app } from './app.js';
import { getEnv } from './env.js';
import { logger } from './logger.js';
import { prisma } from './db.js';
import { installDiagnosticStore, flushDiagnosticEvents } from './lib/server/diagnosticStore.js';
import { registerDiagnosticProvider } from '../../shared/nativeDiagnostics.mjs';
import { diagnosticStoreStatus } from './lib/server/diagnosticStore.js';
import sharp from 'sharp';
installDiagnosticStore(prisma);
registerDiagnosticProvider('persistence', () => ({ ...diagnosticStoreStatus }));
registerDiagnosticProvider('sharp', () => {
  const cache = sharp.cache(),
    counters = sharp.counters();
  return {
    queue: counters.queue,
    processing: counters.process,
    concurrency: sharp.concurrency(),
    trackedApproxBytes: cache.memory.current * 1048576,
    trackedHighApproxBytes: cache.memory.high * 1048576,
    cacheMaxApproxBytes: cache.memory.max * 1048576,
    cacheItems: cache.items.current,
    cacheFiles: cache.files.current,
    version: sharp.versions.sharp.split('.').map(Number),
    vipsVersion: sharp.versions.vips.split('.').map(Number),
  };
});
import { getProcessDiagnostics } from '../../shared/runtimeDiagnostics.mjs';
const diagnostics = getProcessDiagnostics();

const server = app.listen(getEnv().PORT, process.env.BACKEND_HOST || '0.0.0.0', () => {
  logger.info('Backend listening');
});
server.requestTimeout = 120000;
server.headersTimeout = 15000;
let stopping = false;
async function shutdown() {
  if (stopping) return;
  stopping = true;
  diagnostics.marker('shutdown_requested');
  const deadline = setTimeout(() => {
    diagnostics.stop();
    process.exit(1);
  }, 15000);
  deadline.unref();
  server.close(async () => {
    diagnostics.stop();
    await flushDiagnosticEvents();
    await prisma.$disconnect();
    clearTimeout(deadline);
    process.exit(0);
  });
  server.closeIdleConnections();
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
