import type { Prisma } from '@prisma/client';
import { prisma } from '../../db.js';
import { logger } from '../../logger.js';
import { deleteObjects } from '../data/storage.js';
import { createPhotoLifecycle, type PhotoConnection } from './photoLifecycle.js';
export { PhotoLifecycleError } from './photoLifecycle.js';
const connection = (tx: Pick<Prisma.TransactionClient, '$queryRawUnsafe'>): PhotoConnection => ({
  query: (sql, values = []) => tx.$queryRawUnsafe(sql, ...values),
});
const lifecycle = createPhotoLifecycle({
  db: {
    ...connection(prisma),
    transaction: (work) =>
      prisma.$transaction(
        async (tx) => {
          await tx.$executeRawUnsafe("SET LOCAL lock_timeout='1500'");
          await tx.$executeRawUnsafe("SET LOCAL statement_timeout='4000'");
          return work(connection(tx));
        },
        { maxWait: 2000, timeout: 15000 },
      ),
  },
  remove: (paths) => deleteObjects(paths, true),
  report: () => logger.error('Photo cleanup pending; durable retry scheduled'),
});
export const beginPhotoUpload = lifecycle.beginUpload;
export const checkPhotoUpload = lifecycle.checkUpload;
export const finishPhotoUpload = lifecycle.finishUpload;
export const failPhotoUpload = lifecycle.failUpload;
export const retainStagedPhotos = lifecycle.retain;
export const discardStagedPhotos = lifecycle.discard;
export const processPhotoJob = lifecycle.process;
export const assertStagedPhotos = (tx: Prisma.TransactionClient, id: string, paths: string[]) =>
  lifecycle.assertStaged(connection(tx), id, paths);
export const forgetAttachedPhotos = (tx: Prisma.TransactionClient, paths: string[]) =>
  lifecycle.attached(connection(tx), paths);
export const queuePhotoRemovals = (tx: Prisma.TransactionClient, id: string, paths: string[]) =>
  lifecycle.queueRemoved(connection(tx), id, paths);
export function startPhotoLifecycleCleanup() {
  let stopped = false,
    running: Promise<void> | undefined;
  const tick = () => {
    if (stopped || running) return;
    running = lifecycle
      .sweep(() => stopped)
      .catch(() => logger.error('Photo lifecycle queue unavailable; retrying later'))
      .finally(() => {
        running = undefined;
      });
  };
  const timer = setInterval(tick, 30_000);
  timer.unref();
  tick();
  return async () => {
    stopped = true;
    clearInterval(timer);
    await running;
  };
}
