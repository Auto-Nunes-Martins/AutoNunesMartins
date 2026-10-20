/** Explicit owner-authorized demo homepage selection. Default is read-only preview. */
import { PrismaClient } from '@prisma/client';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { saveHighlights, highlightsKey } from '../src/lib/server/homepageHighlights.ts';
import { approvedPaths, publicVehicleWhere } from '../src/lib/data/publicVehicle.ts';
import { stable } from './demo-catalog-data.mjs';

const arg = name => { const i = process.argv.indexOf(name); return i < 0 ? null : process.argv[i + 1]; };
const apply = process.argv.includes('--apply'), revert = arg('--revert');
if (apply && revert) throw Error('Choose apply or revert.');
const sha = value => createHash('sha256').update(stable(value)).digest('hex');
const url = new URL(process.env.DATABASE_URL), target = sha(`${url.hostname}${url.pathname}${url.username}`);
const local = name => { const path = resolve(name); if (!path.replaceAll('\\', '/').startsWith(resolve('.cache').replaceAll('\\', '/') + '/')) throw Error('Backup/report must remain in .cache/.'); return path; };
const db = new PrismaClient();
try {
  const current = await db.appSetting.findUnique({ where: { key: highlightsKey } });
  if (revert) {
    const backup = JSON.parse(await readFile(local(revert), 'utf8'));
    if (backup.target !== target || !backup.after?.revision || stable(current?.value) !== stable(backup.after)) throw Error('Highlights changed since backup or backup is incomplete; refusing to overwrite.');
    await db.$transaction(async tx => {
      const row = await tx.appSetting.findUnique({ where: { key: highlightsKey } });
      if (stable(row?.value) !== stable(backup.after)) throw Error('Concurrent highlight edit.');
      if (backup.before) await tx.appSetting.update({ where: { key: highlightsKey }, data: { value: backup.before } });
      else await tx.appSetting.delete({ where: { key: highlightsKey } });
    }, { isolationLevel: 'Serializable' });
    console.log(JSON.stringify({ reverted: true, restoredItems: backup.before?.items?.length ?? 0 }));
  } else {
    const vehiclesBefore = await db.vehicle.findMany({ orderBy: { id: 'asc' } });
    const candidates = await db.vehicle.findMany({ where: { ...publicVehicleWhere(), status: 'AVAILABLE' } });
    const desired = ['cmpfgs5mq00dyrm90fxofh72o', 'cmpfgr4ee004arm90g4h292nj', 'c4830d68165bbfd977cf81688'];
    const desiredItems = desired.map(id => { const row = candidates.find(row => row.id === id); if (!row || !row.publicDescription?.startsWith('[DADOS FICTÍCIOS DE TESTE]')) throw Error('Expected public demo candidate unavailable.'); const path = approvedPaths(row)[0]; if (!path) throw Error('Candidate has no approved cover.'); return { vehicleId: id, photoPath: path }; });
    const validExisting = (current?.value?.items ?? []).filter(item => { const row = candidates.find(row => row.id === item.vehicleId); return row && approvedPaths(row).includes(item.photoPath); });
    // Preserve an already populated, live selection; otherwise repair the stale demo configuration.
    const items = validExisting.length >= 3 ? validExisting : desiredItems;
    const changed = stable(current?.value?.items ?? []) !== stable(items);
    const report = { version: 1, target, createdAt: new Date().toISOString(), before: current?.value ?? null, after: { revision: null, items }, validExisting: validExisting.length, selected: items.map(item => { const row = candidates.find(row => row.id === item.vehicleId); return `${row.brand} ${row.model}`; }), changed };
    await writeFile(local(arg('--report') ?? '.cache/demo-highlights-preview.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify({ mode: apply ? 'apply' : 'preview', changed, validExisting: validExisting.length, selected: report.selected }));
    if (apply && changed) {
      const backup = local(arg('--backup') ?? `.cache/demo-highlights-backup-${Date.now()}.json`);
      await writeFile(backup, JSON.stringify(report, null, 2), { flag: 'wx', mode: 0o600 });
      const saved = await saveHighlights(db, { revision: current?.value?.revision ?? null, items }, null);
      report.after.revision = saved.revision;
      await writeFile(backup, JSON.stringify(report, null, 2), { mode: 0o600 });
      const after = await db.appSetting.findUnique({ where: { key: highlightsKey } });
      if (stable(after.value) !== stable(report.after) || sha(await db.vehicle.findMany({ orderBy: { id: 'asc' } })) !== sha(vehiclesBefore)) throw Error('Post-save verification failed.');
      console.log(JSON.stringify({ committed: true, highlights: items.length, vehicleDataUnchanged: true, auditActivityRecorded: true }));
    }
  }
} catch (error) {
  console.error(error instanceof Error ? error.message.replace(/postgres(?:ql)?:\/\/[^\s]+/g, '[database]') : 'Highlight maintenance failed.');
  process.exitCode = 1;
} finally { await db.$disconnect(); }
