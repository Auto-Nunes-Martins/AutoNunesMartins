import { expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';

it('keeps cleanup jobs after vehicle deletion and denies browser roles even with default grants', async () => {
  const pg = new PGlite();
  try {
    await pg.exec(
      'CREATE ROLE anon; CREATE ROLE authenticated; ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated; CREATE TABLE "Vehicle" (id TEXT PRIMARY KEY); INSERT INTO "Vehicle" VALUES (\'vehicle\');',
    );
    await pg.exec(
      await readFile(
        new URL(
          '../../../prisma/migrations/20261031060000_vehicle_photo_cleanup/migration.sql',
          import.meta.url,
        ),
        'utf8',
      ),
    );
    await pg.exec(
      'BEGIN; DELETE FROM "Vehicle" WHERE id=\'vehicle\'; INSERT INTO "VehiclePhotoCleanup" ("vehicleId", photos) VALUES (\'vehicle\', ARRAY[\'vehicle/photo.jpg\']); COMMIT;',
    );
    expect((await pg.query('SELECT * FROM "VehiclePhotoCleanup"')).rows).toHaveLength(1);
    const access = (
      await pg.query(
        `SELECT has_table_privilege('anon','"VehiclePhotoCleanup"','SELECT') AS anon, has_table_privilege('authenticated','"VehiclePhotoCleanup"','DELETE') AS authenticated, (SELECT relrowsecurity FROM pg_class WHERE relname='VehiclePhotoCleanup') AS rls`,
      )
    ).rows[0];
    expect(access).toEqual({ anon: false, authenticated: false, rls: true });
    await pg.exec('BEGIN; DELETE FROM "VehiclePhotoCleanup"; ROLLBACK;');
    expect((await pg.query('SELECT * FROM "VehiclePhotoCleanup"')).rows).toHaveLength(1);
  } finally {
    await pg.close();
  }
});
