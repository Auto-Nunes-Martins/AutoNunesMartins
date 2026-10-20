/** Explicit owner-authorized DEMO maintenance, never seed/startup/deployment.
 * Preview: node --env-file=backend/.env --import tsx backend/scripts/populate-demo-photos.mjs
 * Apply: append --apply --backup .cache/demo-photo-backup-YYYYMMDD.json
 * Revert associations: append --revert .cache/demo-photo-backup-YYYYMMDD.json
 */
import { PrismaClient } from '@prisma/client';
import { createHash, randomUUID } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { getSupabase, getBucketName, deleteObjects } from '../src/lib/data/storage.ts';
import { optimizePhoto } from '../src/lib/server/photoOptimization.ts';
import { ensurePhotoVariants } from '../src/lib/server/photoVariants.ts';
import { stable } from './demo-catalog-data.mjs';
import { demoPhotoKey, demoPhotoGalleryDescription, distinctDemoPhotoKey, correctedDemoPhotoKeys, expandedJoggerPhotoKeys } from './demo-photo-plan.mjs';

const arg = name => { const i = process.argv.indexOf(name); return i < 0 ? null : process.argv[i + 1]; };
const apply = process.argv.includes('--apply'), revert = arg('--revert');
const replaceRepeated = process.argv.includes('--replace-repeated');
const correctExisting = process.argv.includes('--correct-existing');
const expandJogger = process.argv.includes('--expand-jogger');
if (apply && revert) throw Error('Choose apply or revert.');
if ([replaceRepeated, correctExisting, expandJogger, !!revert].filter(Boolean).length > 1) throw Error('Choose only one maintenance mode.');
const hash = value => createHash('sha256').update(stable(value)).digest('hex');
const url = new URL(process.env.DATABASE_URL);
const target = hash(`${url.hostname}${url.pathname}${url.username}`);
const mutable = ['photos', 'publicPhotoPaths', 'publicDescription'];
const state = row => Object.fromEntries(mutable.map(key => [key, row[key]]));
const protectedHash = row => hash(Object.fromEntries(Object.entries(row).filter(([key]) => !mutable.includes(key) && key !== 'updatedAt' && key !== 'sale')));
const cachePath = value => {
  const path = resolve(value), root = resolve('.cache').replaceAll('\\', '/') + '/';
  if (!path.replaceAll('\\', '/').startsWith(root)) throw Error('Backup/report must remain in ignored .cache/.');
  return path;
};
const counts = async db => ({ sales: await db.sale.count(), customers: await db.customer.count(), expenses: await db.vehicleExpense.count(), archives: await db.publicVehicleArchive.count() });
const db = new PrismaClient();
const uploaded = [];
let committed = false;
try {
  const rows = await db.vehicle.findMany({ orderBy: { id: 'asc' }, include: { sale: { select: { id: true } } } });
  const beforeCounts = await counts(db);
  let items, originals = new Map();
  if (revert) {
    const backup = JSON.parse(await readFile(cachePath(revert), 'utf8'));
    if (backup.version !== 1 || backup.target !== target || new Set(backup.items.map(x => x.id)).size !== backup.items.length) throw Error('Backup does not match this database.');
    items = backup.items.flatMap(item => {
      const row = rows.find(row => row.id === item.id);
      if (!row) throw Error('Backed-up vehicle missing.');
      if (stable(state(row)) === stable(item.before)) return [];
      if (stable(state(row)) !== stable(item.after)) throw Error('Later photo/description edits detected; refusing to overwrite.');
      return [{ id: row.id, updatedAt: row.updatedAt, before: state(row), after: item.before, protectedHash: protectedHash(row), sourceKey: item.sourceKey }];
    });
  } else {
    const manifest = JSON.parse(await readFile('docs/demo-photos/sources.json', 'utf8'));
    const eligible = rows.filter(row => row.webPublished && ['AVAILABLE', 'RESERVED'].includes(row.status) && !row.sale && !row.soldDate && (expandJogger ? expandedJoggerPhotoKeys(row) : correctExisting ? correctedDemoPhotoKeys(row) : replaceRepeated ? distinctDemoPhotoKey(row) : !row.publicPhotoPaths.some(path => row.photos.includes(path))));
    items = [];
    for (const row of eligible) {
      if (!replaceRepeated && !correctExisting && !expandJogger && (row.photos.length || row.publicPhotoPaths.length)) throw Error('Existing private photos require separate review; refusing to replace them.');
      const sourceKeys = expandJogger ? expandedJoggerPhotoKeys(row) : correctExisting ? correctedDemoPhotoKeys(row) : [replaceRepeated ? distinctDemoPhotoKey(row) : demoPhotoKey(row)];
      const sources = sourceKeys.map(key => manifest.sources.find(source => source.key === key));
      if (sources.some(source => !source)) throw Error(`No reviewed licensed source for ${row.brand} ${row.model}.`);
      if ((replaceRepeated || correctExisting || expandJogger) && sources.every(source => row.publicDescription?.includes(source.sourcePage))) continue;
      if (replaceRepeated && (row.photos.length !== 1 || row.publicPhotoPaths.length !== 1 || row.photos[0] !== row.publicPhotoPaths[0] || !row.publicDescription?.includes('Fotografia ilustrativa de demonstração:'))) throw Error('Replacement target changed since demo preparation.');
      let retainedPhotos = row.photos;
      if (expandJogger) {
        if (row.publicPhotoPaths.length !== 3 || !sources.slice(0, 3).every(source => row.publicDescription?.includes(source.sourcePage))) throw Error('Jogger gallery changed since the three-image review.');
        const originalBackup = JSON.parse(await readFile(cachePath(arg('--private-photo-backup') ?? '.cache/demo-photo-correct-existing-backup-20261020.json'), 'utf8'));
        if (originalBackup.target !== target) throw Error('Private photo backup targets a different database.');
        const old = originalBackup.items.find(item => item.id === row.id)?.before?.photos;
        if (!old || old.length !== 13 || !old.every(path => row.photos.includes(path))) throw Error('Reviewed private originals do not match the current gallery.');
        // Visually audited screenshots/game images. Keep their bytes and both backups.
        const archived = [4, 5, 6, 11, 12].map(index => old[index]);
        if (archived.some(path => row.publicPhotoPaths.includes(path))) throw Error('Archived private image is unexpectedly public.');
        retainedPhotos = row.photos.filter(path => !archived.includes(path));
      }
      const uploads = [];
      for (const source of expandJogger ? sources.slice(3) : sources) {
        const sourceKey = source.key;
        let input;
        const local = cachePath(`.cache/demo-cover-sources/${sourceKey}.jpg`);
        try { input = await readFile(local); } catch (error) {
          if (error.code !== 'ENOENT') throw error;
          if (!/^https:\/\/(?:thumb|upload)\.wikimedia\.org\//.test(source.downloadUrl)) throw Error('Unapproved source host.');
          const response = await fetch(source.downloadUrl, { headers: { 'User-Agent': 'AutoNunesMartinsDemoAssetPreparation/1.0' }, signal: AbortSignal.timeout(30000) });
          if (!response.ok) throw Error('Licensed source download failed.');
          input = Buffer.from(await response.arrayBuffer());
          await mkdir(dirname(local), { recursive: true }); await writeFile(local, input);
        }
        if (createHash('sha256').update(input).digest('hex') !== source.sha256) throw Error('Source image changed since visual/licence review.');
        if (!originals.has(sourceKey)) originals.set(sourceKey, await optimizePhoto(input));
        const prepared = originals.get(sourceKey);
        uploads.push({ path: `${row.id}/${randomUUID()}.${prepared.extension}`, sourceKey });
      }
      const baseDescription = row.publicDescription?.split('\n\nFotografia ilustrativa de demonstração:')[0];
      const paths = uploads.map(upload => upload.path);
      const after = { photos: [...retainedPhotos, ...paths], publicPhotoPaths: expandJogger ? [...row.publicPhotoPaths, ...paths] : paths, publicDescription: demoPhotoGalleryDescription(baseDescription, sources) };
      if (after.photos.length > 20 || new Set(after.photos).size !== after.photos.length || after.publicPhotoPaths.length > 20) throw Error('Gallery exceeds the existing CRM limits or repeats a reference.');
      items.push({ id: row.id, name: `${row.brand} ${row.model} (${row.year})`, sourceKeys, uploads, updatedAt: row.updatedAt, before: state(row), after, protectedHash: protectedHash(row) });
    }
  }
  const report = { version: 1, target, createdAt: new Date().toISOString(), mode: revert ? 'revert' : apply ? 'apply' : 'preview', vehicles: rows.length, changed: items.length, items };
  const reportPath = cachePath(arg('--report') ?? '.cache/demo-photo-preview.json');
  await mkdir(dirname(reportPath), { recursive: true }); await writeFile(reportPath, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ mode: report.mode, targetFingerprint: target.slice(0, 12), vehicles: rows.length, changed: items.length, sources: originals.size }));
  if ((apply || revert) && items.length) {
    if (apply) {
      const backup = cachePath(arg('--backup') ?? `.cache/demo-photo-backup-${Date.now()}.json`);
      await mkdir(dirname(backup), { recursive: true }); await writeFile(backup, JSON.stringify(report, null, 2), { flag: 'wx', mode: 0o600 });
      for (const item of items) {
        for (const upload of item.uploads) {
          const path = upload.path, prepared = originals.get(upload.sourceKey);
          const result = await getSupabase().storage.from(getBucketName()).upload(path, prepared.buffer, { contentType: prepared.contentType, upsert: false, cacheControl: '3600' });
          if (result.error) throw Error('Master upload failed.');
          uploaded.push(path);
          const variants = await ensurePhotoVariants(path, prepared.buffer);
          console.log(JSON.stringify({ prepared: item.name, source: upload.sourceKey, masterBytes: prepared.buffer.length, variants: variants.manifest.variants.map(v => ({ width: v.width, bytes: v.bytes })) }));
        }
      }
    }
    await db.$transaction(async tx => {
      const current = await tx.vehicle.findMany({ orderBy: { id: 'asc' } });
      if (current.length !== rows.length || stable(await counts(tx)) !== stable(beforeCounts)) throw Error('Dataset changed during preparation.');
      for (const item of items) {
        const row = current.find(row => row.id === item.id);
        if (!row || stable(state(row)) !== stable(item.before) || protectedHash(row) !== item.protectedHash) throw Error('Concurrent vehicle edit; transaction cancelled.');
        const result = await tx.vehicle.updateMany({ where: { id: item.id, updatedAt: new Date(item.updatedAt) }, data: item.after });
        if (result.count !== 1) throw Error('Concurrent vehicle edit while saving.');
      }
      const after = await tx.vehicle.findMany({ orderBy: { id: 'asc' } });
      for (const row of after) {
        const before = rows.find(before => before.id === row.id), item = items.find(item => item.id === row.id);
        if (!before || protectedHash(row) !== protectedHash(before) || stable(state(row)) !== stable(item?.after ?? state(before))) throw Error('Protected data or unrelated photos changed.');
      }
      if (stable(await counts(tx)) !== stable(beforeCounts)) throw Error('Related data changed.');
    }, { timeout: 120000, maxWait: 30000 });
    committed = true;
    console.log(JSON.stringify({ committed: true, updated: items.length, protectedFieldsUnchanged: true, unrelatedPhotosUnchanged: true }));
    // Revert deliberately preserves uploaded masters/variants as a recoverable backup.
    // They cease to be publicly accessible once the associations are reverted.
  } else console.log(items.length ? 'Preview only: no database/storage writes.' : 'Already complete: zero writes.');
} catch (error) {
  if (!committed && uploaded.length) {
    try { await deleteObjects(uploaded); } catch { console.error('Some unassociated uploaded files require cleanup from the backup paths.'); }
  }
  console.error(error instanceof Error ? error.message.replace(/postgres(?:ql)?:\/\/[^\s]+/g, '[database]') : 'Photo maintenance failed.');
  process.exitCode = 1;
} finally { await db.$disconnect(); }
