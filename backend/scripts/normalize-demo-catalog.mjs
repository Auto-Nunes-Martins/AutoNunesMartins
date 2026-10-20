/** Owner-authorized TEST DATA maintenance; never part of seed, startup or deployment.
 * Preview: node --env-file=backend/.env --import tsx backend/scripts/normalize-demo-catalog.mjs
 * Apply: append --apply --backup .cache/demo-catalog-backup-YYYYMMDD.json
 * Revert: append --revert .cache/demo-catalog-backup-YYYYMMDD.json
 * No publication flags, slugs, photos, private identifiers or financial fields are written.
 */
import { Prisma, PrismaClient } from '@prisma/client';
import { publicSpecificationsSchema } from '@anm/types';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { catalogState, mutableFields, planDemoVehicle, stable } from './demo-catalog-data.mjs';

const arg = name => { const i = process.argv.indexOf(name); return i < 0 ? null : process.argv[i + 1]; };
const apply = process.argv.includes('--apply');
const revertPath = arg('--revert');
if (apply && revertPath) throw new Error('Choose --apply or --revert, not both.');
const hash = value => createHash('sha256').update(stable(value)).digest('hex');
const url = new URL(process.env.DATABASE_URL);
const target = createHash('sha256').update(`${url.hostname}${url.pathname}${url.username}`).digest('hex');
const protectedHash = row => hash(Object.fromEntries(Object.entries(row).filter(([field]) => !mutableFields.includes(field) && field !== 'updatedAt')));
const dataFor = state => ({ ...catalogState(state), publicSpecifications: state.publicSpecifications === null ? Prisma.DbNull : publicSpecificationsSchema.parse(state.publicSpecifications) });
const db = new PrismaClient();
const relatedCounts = async client => ({
  sales: await client.sale.count(), customers: await client.customer.count(),
  expenses: await client.vehicleExpense.count(), archives: await client.publicVehicleArchive.count(),
});
const localPath = value => {
  const path = resolve(value);
  const root = resolve('.cache') + '/';
  if (!(path.replaceAll('\\', '/').startsWith(root.replaceAll('\\', '/')))) throw new Error('Reports/backups must stay inside ignored .cache/.');
  return path;
};

try {
  const rows = await db.vehicle.findMany({ orderBy: { id: 'asc' } });
  const beforeCounts = await relatedCounts(db);
  let changes;
  if (revertPath) {
    const backup = JSON.parse(await readFile(localPath(revertPath), 'utf8'));
    if (backup.version !== 1 || backup.target !== target || !Array.isArray(backup.items)) throw new Error('Backup does not match this database/schema.');
    if (new Set(backup.items.map(item => item.id)).size !== backup.items.length) throw new Error('Duplicate backup identities.');
    changes = [];
    for (const item of backup.items) {
      const row = rows.find(row => row.id === item.id);
      if (!row) throw new Error('A backed-up vehicle no longer exists; no changes applied.');
      const current = catalogState(row);
      if (stable(current) === stable(item.before)) continue;
      if (stable(current) !== stable(item.after)) throw new Error('Catalog changed since this backup; refusing to overwrite later edits.');
      changes.push({ id: row.id, updatedAt: row.updatedAt, before: current, after: catalogState(item.before), protectedHash: protectedHash(row) });
    }
  } else {
    changes = rows.map(row => {
      const after = planDemoVehicle(row);
      publicSpecificationsSchema.parse(after.publicSpecifications);
      return { id: row.id, updatedAt: row.updatedAt, before: catalogState(row), after, protectedHash: protectedHash(row) };
    }).filter(item => stable(item.before) !== stable(item.after));
  }
  const report = { version: 1, createdAt: new Date().toISOString(), target, mode: revertPath ? 'revert' : apply ? 'apply' : 'preview', vehicles: rows.length, changed: changes.length,
    items: changes.map(({ updatedAt, ...item }) => item) };
  const reportPath = localPath(arg('--report') ?? '.cache/demo-catalog-preview.json');
  await mkdir(dirname(reportPath), { recursive: true });
  await writeFile(reportPath, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ mode: report.mode, provider: /supabase/.test(url.hostname) ? 'Supabase PostgreSQL remoto' : 'PostgreSQL configurado', targetFingerprint: target.slice(0, 12), vehicles: rows.length, changed: changes.length }));
  if (!apply && !revertPath) {
    for (const item of changes) console.log(`${item.before.brand} ${item.before.model} -> ${item.after.brand} ${item.after.model} | ${item.after.publicSpecifications?.version ?? ''}`);
  } else if (changes.length) {
    if (apply) {
      const backupPath = localPath(arg('--backup') ?? `.cache/demo-catalog-backup-${Date.now()}.json`);
      await mkdir(dirname(backupPath), { recursive: true });
      await writeFile(backupPath, JSON.stringify(report, null, 2), { flag: 'wx', mode: 0o600 });
      console.log('Reversible catalog-only backup written inside .cache/.');
    }
    await db.$transaction(async tx => {
      const transactionRows = await tx.vehicle.findMany({ orderBy: { id: 'asc' } });
      if (transactionRows.length !== rows.length || stable(await relatedCounts(tx)) !== stable(beforeCounts)) throw new Error('Dataset changed during preparation; retry from a new preview.');
      for (const item of changes) {
        const current = transactionRows.find(row => row.id === item.id);
        if (!current || stable(catalogState(current)) !== stable(item.before) || protectedHash(current) !== item.protectedHash)
          throw new Error('Concurrent vehicle edits detected; transaction cancelled.');
        const result = await tx.vehicle.updateMany({ where: { id: item.id, updatedAt: item.updatedAt }, data: dataFor(item.after) });
        if (result.count !== 1) throw new Error('Concurrent edit detected while saving; transaction cancelled.');
      }
      const afterRows = await tx.vehicle.findMany({ orderBy: { id: 'asc' } });
      for (const row of afterRows) {
        const before = rows.find(candidate => candidate.id === row.id);
        const changed = changes.find(item => item.id === row.id);
        if (!before || protectedHash(row) !== protectedHash(before)) throw new Error('Protected vehicle data differs; transaction cancelled.');
        if (stable(catalogState(row)) !== stable(changed?.after ?? catalogState(before))) throw new Error('Catalog verification failed; transaction cancelled.');
      }
      if (stable(await relatedCounts(tx)) !== stable(beforeCounts)) throw new Error('Related record counts changed; transaction cancelled.');
    }, { maxWait: 30000, timeout: 120000 });
    console.log(JSON.stringify({ committed: true, updated: changes.length, protectedVehicleFieldsUnchanged: true, relatedCountsUnchanged: true }));
  } else console.log('Already matches the requested state: zero writes.');
} catch (error) {
  console.error(error instanceof Error ? error.message.replace(/postgres(?:ql)?:\/\/[^\s]+/g, '[database]') : 'Catalog maintenance failed.');
  process.exitCode = 1;
} finally { await db.$disconnect(); }
