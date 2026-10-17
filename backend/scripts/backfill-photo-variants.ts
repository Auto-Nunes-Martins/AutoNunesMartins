/** Reads vehicle photo identities; writes private derivatives only. Never writes to Prisma. */
import { mkdir, writeFile, rename } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { prisma } from '../src/db.js';
import { getSupabase, getBucketName } from '../src/lib/data/storage.js';
import { ensurePhotoVariants, variantRoot } from '../src/lib/server/photoVariants.js';
import { isVehiclePhotoPath } from '../../shared/vehiclePhotoPrincipal.mjs';

const apply = process.argv.includes('--apply');
const reportIndex = process.argv.indexOf('--report');
const reportPath = resolve(
  reportIndex >= 0 ? process.argv[reportIndex + 1]! : '.cache/photo-variants-backfill.json'
);
const digest = (value: unknown) =>
  createHash('sha256')
    .update(typeof value === 'string' ? value : JSON.stringify(value))
    .digest('hex');
let stopping = false;
process.on('SIGINT', () => {
  stopping = true;
});
process.on('SIGTERM', () => {
  stopping = true;
});
const report = {
  startedAt: new Date().toISOString(),
  finishedAt: null as string | null,
  mode: apply ? 'apply' : 'inspect',
  concurrency: 1,
  privateBucket: false,
  vehicles: 0,
  photos: 0,
  created: 0,
  reused: 0,
  failed: 0,
  skipped: 0,
  vehicleStateUnchanged: null as boolean | null,
  items: [] as Record<string, unknown>[],
};
async function save() {
  await mkdir(dirname(reportPath), { recursive: true });
  await writeFile(reportPath + '.tmp', JSON.stringify(report, null, 2));
  await rename(reportPath + '.tmp', reportPath);
}
try {
  const bucket = getSupabase().storage.from(getBucketName());
  const { data, error } = await getSupabase().storage.getBucket(getBucketName());
  if (error || !data || data.public)
    throw new Error('Cannot verify the configured bucket is private; no writes performed');
  report.privateBucket = true;
  const select = {
    id: true,
    photos: true,
    publicPhotoPaths: true,
    webPublished: true,
    publicSlug: true,
    updatedAt: true,
  } as const;
  const vehicles = await prisma.vehicle.findMany({ select, orderBy: { id: 'asc' } });
  report.vehicles = vehicles.length;
  const before = digest(vehicles);
  const photos = vehicles.flatMap((v) => v.photos.map((path) => ({ id: v.id, path })));
  report.photos = photos.length;
  await save();
  for (const { id, path } of photos) {
    if (stopping) break;
    const key = digest(path).slice(0, 16);
    if (!isVehiclePhotoPath(id, path)) {
      report.skipped++;
      report.items.push({ key, status: 'skipped', reason: 'unsupported owned master path' });
      await save();
      continue;
    }
    // Resolve and validate namespace BEFORE any write. No file can replace its master.
    const destination = variantRoot(path);
    if (!destination.startsWith(id + '/.variants/v1/') || destination === path)
      throw new Error('Unsafe derivative destination');
    if (!apply) {
      report.items.push({ key, status: 'inspect', destination: digest(destination).slice(0, 16) });
      continue;
    }
    try {
      const master = await bucket.download(path);
      if (master.error || !master.data || master.data.size > 20 * 1024 * 1024)
        throw new Error('Master unavailable or oversized');
      const input = Buffer.from(await master.data.arrayBuffer()),
        sourceHash = digest(input.toString('base64'));
      const result = await ensurePhotoVariants(path, input);
      const after = await bucket.download(path);
      if (
        after.error ||
        !after.data ||
        digest(Buffer.from(await after.data.arrayBuffer()).toString('base64')) !== sourceHash
      )
        throw new Error('Master verification failed');
      report.created += result.created;
      if (result.reused) report.reused++;
      report.items.push({
        key,
        status: result.reused ? 'reused' : 'created',
        variants: result.manifest.variants.map((v) => ({
          width: v.width,
          height: v.height,
          bytes: v.bytes,
        })),
        sourceBytes: input.length,
        sourceWidth: result.manifest.width,
        sourceHeight: result.manifest.height,
        masterUnchanged: true,
      });
      console.log(
        JSON.stringify({
          key,
          status: result.reused ? 'reused' : 'created',
          variants: result.created,
        })
      );
    } catch (error) {
      const known = [
        'Master unavailable or oversized',
        'Derivative upload failed',
        'Derivative manifest upload failed',
        'Master verification failed',
        'Unsupported master image',
        'Immutable master content changed',
      ];
      const reason =
        error instanceof Error && known.includes(error.message)
          ? error.message
          : 'Generation/storage failed; safe to rerun';
      report.failed++;
      report.items.push({ key, status: 'failed', reason });
      console.error(JSON.stringify({ key, status: 'failed', reason }));
    }
    await save();
  }
  report.vehicleStateUnchanged =
    digest(await prisma.vehicle.findMany({ select, orderBy: { id: 'asc' } })) === before;
  report.finishedAt = new Date().toISOString();
  await save();
  console.log(
    JSON.stringify({
      report: reportPath,
      photos: report.photos,
      created: report.created,
      reused: report.reused,
      failed: report.failed,
      skipped: report.skipped,
      vehicleStateUnchanged: report.vehicleStateUnchanged,
      stopped: stopping,
    })
  );
  if (report.failed || report.skipped || !report.vehicleStateUnchanged || stopping)
    process.exitCode = 1;
} catch {
  console.error(
    'Backfill stopped: verify environment, private bucket and report; no credentials are logged.'
  );
  process.exitCode = 1;
  await save();
} finally {
  await prisma.$disconnect();
}
