import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';

it('removes only the obsolete archive table and preserves vehicle data', async () => {
  const db = await PGlite.create();
  try {
    await db.exec(
      'CREATE TABLE "Vehicle" (id TEXT PRIMARY KEY, "webPublished" BOOLEAN, "publicPhotoPaths" TEXT[]); INSERT INTO "Vehicle" VALUES (\'car\', false, ARRAY[\'photo\']);',
    );
    await db.exec(
      readFileSync(
        new URL(
          '../../../prisma/migrations/20261018230000_minimal_public_vehicle_archive/migration.sql',
          import.meta.url,
        ),
        'utf8',
      ),
    );
    const before = await db.query('SELECT * FROM "Vehicle"');
    await db.exec(
      readFileSync(
        new URL(
          '../../../prisma/migrations/20261021020000_remove_public_vehicle_archive/migration.sql',
          import.meta.url,
        ),
        'utf8',
      ),
    );
    expect((await db.query('SELECT * FROM "Vehicle"')).rows).toEqual(before.rows);
    expect((await db.query('SELECT to_regclass(\'"PublicVehicleArchive"\') AS name')).rows).toEqual(
      [{ name: null }],
    );
  } finally {
    await db.close();
  }
}, 20_000);
