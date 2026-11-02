import { beforeEach, afterEach, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import {
  createPhotoLifecycle,
  PHOTO_DRAFT_RETENTION_MS,
  PHOTO_UPLOAD_LEASE_MS,
  PHOTO_DISCARD_GRACE_MS,
  type PhotoDatabase,
} from './photoLifecycle.js';
let pg: PGlite, database: PhotoDatabase, service: ReturnType<typeof createPhotoLifecycle>;
let time: number, stored: Set<string>, fail: boolean, removed: string[];
const path = 'vehicle/photo.webp',
  canonical = 'vehicle/keep.webp';
const version = (p: string) => createHash('sha256').update(p).digest('hex');
const row = async () =>
  (await pg.query<any>('SELECT * FROM "VehiclePhotoJob" WHERE path=$1', [path])).rows[0];
const connection = (db: any) => ({
  query: async (sql: string, values: unknown[] = []) => (await db.query(sql, values)).rows,
});
function restart() {
  service = createPhotoLifecycle({
    db: database,
    now: () => new Date(time),
    remove: async (paths) => {
      if (fail) throw Error('Storage unavailable');
      for (const p of paths) {
        stored.delete(p);
        stored.delete(p + '/variant');
        removed.push(p);
      }
    },
  });
}
beforeEach(async () => {
  pg = new PGlite();
  time = Date.parse('2026-11-02T00:00:00Z');
  fail = false;
  removed = [];
  stored = new Set([path, path + '/variant', canonical]);
  await pg.exec(`CREATE ROLE anon; CREATE ROLE authenticated;
    ALTER DEFAULT PRIVILEGES GRANT ALL ON TABLES TO anon,authenticated;
    CREATE TABLE "Vehicle"(id text PRIMARY KEY,"createdAt" timestamptz NOT NULL DEFAULT '2026-10-01',photos text[] NOT NULL DEFAULT '{}',"publicPhotoPaths" text[] NOT NULL DEFAULT '{}');
    CREATE TABLE "VehiclePhotoDimensions"(version text PRIMARY KEY);
    CREATE TABLE "VehiclePhotoCleanup"("vehicleId" text PRIMARY KEY);
    INSERT INTO "Vehicle"(id,photos,"publicPhotoPaths") VALUES ('vehicle',ARRAY['vehicle/keep.webp'],ARRAY['vehicle/keep.webp']);`);
  await pg.exec(
    await readFile(
      new URL(
        '../../../prisma/migrations/20261102060000_photo_lifecycle_jobs/migration.sql',
        import.meta.url,
      ),
      'utf8',
    ),
  );
  await pg.query('INSERT INTO "VehiclePhotoDimensions" VALUES($1)', [version(path)]);
  database = {
    ...connection(pg),
    transaction: (work) => pg.transaction((tx) => work(connection(tx))),
  };
  restart();
}, 30000);
afterEach(async () => {
  await pg.close();
});
it('records a lease before writing and rejects overlapping writers or a stale upload token', async () => {
  const first = await service.beginUpload('vehicle', path);
  expect((await row()).state).toBe('UPLOADING');
  await expect(service.beginUpload('vehicle', path)).rejects.toMatchObject({ status: 429 });
  time += PHOTO_UPLOAD_LEASE_MS + 1;
  const second = await service.beginUpload('vehicle', path);
  await expect(service.checkUpload(path, first.token)).rejects.toMatchObject({ status: 409 });
  await expect(service.finishUpload(path, first.token)).rejects.toMatchObject({ status: 409 });
  await service.checkUpload(path, second.token);
  expect((await row()).token).toBe(second.token);
});
it('renewal prevents an expired snapshot from removing an in-flight upload', async () => {
  const upload = await service.beginUpload('vehicle', path);
  time += PHOTO_UPLOAD_LEASE_MS - 10;
  await service.checkUpload(path, upload.token);
  time += 20;
  expect(await service.process(path)).toBe(false);
  expect(stored.has(path)).toBe(true);
  expect(removed).toEqual([]);
});
it('keeps a completed staged upload through retries, then attaches and forgets its cleanup job in one transaction', async () => {
  const upload = await service.beginUpload('vehicle', path);
  await service.finishUpload(path, upload.token);
  expect((await row()).state).toBe('STAGED');
  await database.transaction(async (tx) => {
    await service.assertStaged(tx, 'vehicle', [path]);
    await tx.query(
      'UPDATE "Vehicle" SET photos=array_append(photos,$1),"publicPhotoPaths"=array_append("publicPhotoPaths",$1) WHERE id=$2',
      [path, 'vehicle'],
    );
    await service.attached(tx, [path]);
  });
  time += PHOTO_DRAFT_RETENTION_MS + 1;
  await service.sweep();
  expect(await row()).toBeUndefined();
  expect(stored.has(path)).toBe(true);
});
it('recovers an abandoned upload after process death and removes only its exact master family', async () => {
  await service.beginUpload('vehicle', path);
  time += PHOTO_UPLOAD_LEASE_MS + 1;
  restart();
  await service.sweep();
  expect(stored.has(path)).toBe(false);
  expect(stored.has(canonical)).toBe(true);
  expect((await pg.query('SELECT * FROM "VehiclePhotoDimensions"')).rows).toEqual([]);
});
it('expires staged files after seven inactive days but renews an open/recovered draft', async () => {
  const upload = await service.beginUpload('vehicle', path);
  await service.finishUpload(path, upload.token);
  time += PHOTO_DRAFT_RETENTION_MS - 100;
  await service.retain('vehicle', [path]);
  time += 200;
  await service.sweep();
  expect(stored.has(path)).toBe(true);
  time += PHOTO_DRAFT_RETENTION_MS;
  await service.sweep();
  expect(stored.has(path)).toBe(false);
});
it('discard has a grace period and another open draft can retain the same prepared path', async () => {
  const upload = await service.beginUpload('vehicle', path);
  await service.finishUpload(path, upload.token);
  await service.discard('vehicle', [path]);
  expect((await row()).reason).toBe('abandoned');
  time += PHOTO_DISCARD_GRACE_MS - 1;
  await service.sweep();
  expect(stored.has(path)).toBe(true);
  await service.retain('vehicle', [path]);
  time += 2;
  await service.sweep();
  expect(stored.has(path)).toBe(true);
  await service.discard('vehicle', [path]);
  time += PHOTO_DISCARD_GRACE_MS + 1;
  await service.sweep();
  expect(stored.has(path)).toBe(false);
});
it('rolls back cleanup intent with a failed gallery change and retries a committed removal after Storage failure/restart', async () => {
  await pg.query('UPDATE "Vehicle" SET photos=array_append(photos,$1) WHERE id=$2', [
    path,
    'vehicle',
  ]);
  const change = (tx: any) =>
    tx.query('UPDATE "Vehicle" SET photos=array_remove(photos,$1) WHERE id=$2', [path, 'vehicle']);
  await expect(
    database.transaction(async (tx) => {
      await change(tx);
      await service.queueRemoved(tx, 'vehicle', [path]);
      throw Error('rollback');
    }),
  ).rejects.toThrow('rollback');
  expect(await row()).toBeUndefined();
  expect((await pg.query<any>('SELECT photos FROM "Vehicle"')).rows[0].photos).toContain(path);
  await database.transaction(async (tx) => {
    await change(tx);
    await service.queueRemoved(tx, 'vehicle', [path]);
  });
  fail = true;
  expect(await service.process(path)).toBe(false);
  expect((await row()).attempts).toBe(1);
  expect(stored.has(path)).toBe(true);
  fail = false;
  time += 60001;
  restart();
  await service.sweep();
  expect(await row()).toBeUndefined();
  expect(stored.has(path)).toBe(false);
});
it('never removes any referenced photo, including a legacy reference from another vehicle', async () => {
  await service.beginUpload('vehicle', path);
  time += PHOTO_UPLOAD_LEASE_MS + 1;
  await pg.query('INSERT INTO "Vehicle"(id,photos) VALUES($1,ARRAY[$2])', ['other', path]);
  await service.sweep();
  expect(stored.has(path)).toBe(true);
  expect(await row()).toBeUndefined();
});
it('a failed cleanup cannot shorten a concurrently renewed draft lease', async () => {
  const upload = await service.beginUpload('vehicle', path);
  await service.finishUpload(path, upload.token);
  time += PHOTO_DRAFT_RETENTION_MS + 1;
  fail = true;
  const query = database.query;
  let renewed = false;
  database.query = async (sql, values) => {
    if (!renewed && sql.includes('attempts=attempts+1')) {
      renewed = true;
      await service.retain('vehicle', [path]);
    }
    return query(sql, values);
  };
  await service.process(path);
  expect(new Date((await row()).nextAttemptAt).getTime()).toBeGreaterThanOrEqual(
    time + PHOTO_DRAFT_RETENTION_MS,
  );
  fail = false;
  time += 60001;
  await service.sweep();
  expect(stored.has(path)).toBe(true);
});
it.each(['creation-generation', 'pending-whole-deletion'])(
  'protects a restored vehicle: %s',
  async (kind) => {
    await service.beginUpload('vehicle', path);
    time += PHOTO_UPLOAD_LEASE_MS + 1;
    if (kind === 'creation-generation')
      await pg.exec(`UPDATE "Vehicle" SET "createdAt"='2026-11-01'`);
    else await pg.exec(`INSERT INTO "VehiclePhotoCleanup" VALUES ('vehicle')`);
    await service.sweep();
    expect(stored.has(path)).toBe(true);
    expect(await row()).toBeDefined();
  },
);
it('rejects expired or missing staging claims inside the same attach transaction', async () => {
  await expect(
    database.transaction((tx) => service.assertStaged(tx, 'vehicle', [path])),
  ).rejects.toMatchObject({ status: 409 });
  const upload = await service.beginUpload('vehicle', path);
  await service.finishUpload(path, upload.token);
  time += PHOTO_DRAFT_RETENTION_MS + 1;
  await expect(
    database.transaction((tx) => service.assertStaged(tx, 'vehicle', [path])),
  ).rejects.toMatchObject({ status: 409 });
});
it('adopts a legacy recoverable path before its download validation, never revives an explicitly revoked path', async () => {
  expect(await service.retain('vehicle', [path])).toEqual({ adopted: [path] });
  await database.transaction((tx) => service.queueRemoved(tx, 'vehicle', [path]));
  await expect(service.retain('vehicle', [path])).rejects.toMatchObject({ status: 409 });
});
it('keeps RLS and browser-role permissions closed even with permissive platform defaults', async () => {
  const result = await pg.query(
    `SELECT has_table_privilege('anon','"VehiclePhotoJob"','select') AS anon,has_table_privilege('authenticated','"VehiclePhotoJob"','delete') AS authenticated`,
  );
  expect(result.rows).toEqual([{ anon: false, authenticated: false }]);
});
it('rejects arbitrary namespaces and limits the number of pending uploads before Storage writes', async () => {
  await expect(service.beginUpload('vehicle', 'other/file.webp')).rejects.toMatchObject({
    status: 409,
  });
  await pg.exec(
    `INSERT INTO "VehiclePhotoJob"(path,"vehicleId","vehicleCreatedAt",state,"expiresAt","nextAttemptAt") SELECT 'vehicle/'||i||'.webp','vehicle','2026-10-01','STAGED','2026-12-01','2026-12-01' FROM generate_series(1,100) i`,
  );
  await expect(service.beginUpload('vehicle', path)).rejects.toMatchObject({ status: 429 });
  await expect(service.discard('vehicle', [path])).rejects.toMatchObject({ status: 429 });
});
