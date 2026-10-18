/** Conservative evidence only: currently public unsold listings, never an unpublished slug. */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { prisma } from '../src/db.js';
import { publicVehicleWhere } from '../src/lib/data/publicVehicle.js';
import { prepareVehicleArchive, syncPublishedArchive } from '../src/lib/server/publicArchive.js';
const apply = process.argv.includes('--apply');
const index = process.argv.indexOf('--report');
const reportPath = resolve(
  index >= 0 ? process.argv[index + 1]! : '.cache/public-archive-backfill.json',
);
const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const select = {
  id: true,
  brand: true,
  model: true,
  year: true,
  publicSlug: true,
  photos: true,
  publicPhotoPaths: true,
} as const;
const stateSelect = {
  ...select,
  webPublished: true,
  status: true,
  soldDate: true,
  updatedAt: true,
} as const;
const report = {
  mode: apply ? 'apply' : 'inspect',
  startedAt: new Date().toISOString(),
  finishedAt: null as string | null,
  evidence: 'currently-public-unsold-only',
  concurrency: 1,
  eligible: 0,
  captured: 0,
  skipped: 0,
  failed: 0,
  vehicleStateUnchanged: false,
  items: [] as { key: string; status: string }[],
};
try {
  const before = digest(
    await prisma.vehicle.findMany({ select: stateSelect, orderBy: { id: 'asc' } }),
  );
  const rows = await prisma.vehicle.findMany({
    where: publicVehicleWhere(),
    select,
    orderBy: { id: 'asc' },
  });
  report.eligible = rows.length;
  for (const row of rows) {
    const key = digest(row.id).slice(0, 16);
    if (!apply) {
      report.items.push({ key, status: 'eligible-current-publication' });
      continue;
    }
    try {
      const prepared = await prepareVehicleArchive(prisma, row.id, {
        published: true,
        photoPaths: row.publicPhotoPaths,
      });
      const captured = await prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "Vehicle" WHERE "id" = ${row.id} FOR UPDATE`;
        const current = await tx.vehicle.findFirst({
          where: { ...publicVehicleWhere(), id: row.id },
          select,
        });
        if (!current?.publicSlug) return false;
        await syncPublishedArchive(
          tx,
          { ...current, slug: current.publicSlug, approved: current.publicPhotoPaths },
          prepared,
        );
        return true;
      });
      if (captured) report.captured++;
      else report.skipped++;
      report.items.push({
        key,
        status: captured ? 'captured-current-publication' : 'publication-changed-skipped',
      });
    } catch {
      report.failed++;
      report.items.push({ key, status: 'capture-failed-no-private-fallback' });
    }
  }
  report.vehicleStateUnchanged =
    digest(await prisma.vehicle.findMany({ select: stateSelect, orderBy: { id: 'asc' } })) ===
    before;
  if (!report.vehicleStateUnchanged || report.failed) process.exitCode = 1;
} catch {
  report.failed++;
  process.exitCode = 1;
} finally {
  report.finishedAt = new Date().toISOString();
  await mkdir(dirname(reportPath), { recursive: true });
  await writeFile(reportPath, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
  await prisma.$disconnect();
}
