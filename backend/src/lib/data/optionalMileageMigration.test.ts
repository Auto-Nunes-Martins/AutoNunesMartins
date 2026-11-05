import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { expect, it } from 'vitest';

it('keeps existing readings and lets a published vehicle store or clear an unknown reading', async () => {
  const db = await PGlite.create();
  try {
    await db.exec(`
      CREATE TABLE "Vehicle" (id text PRIMARY KEY, mileage integer NOT NULL, "webPublished" boolean NOT NULL DEFAULT false);
      INSERT INTO "Vehicle" (id, mileage) VALUES ('existing', 42000), ('zero', 0);
    `);
    await db.exec(readFileSync('prisma/migrations/20261105210000_optional_vehicle_mileage/migration.sql', 'utf8'));
    expect((await db.query('SELECT id, mileage FROM "Vehicle" ORDER BY id')).rows).toEqual([
      { id: 'existing', mileage: 42000 },
      { id: 'zero', mileage: 0 },
    ]);
    await db.exec(`
      INSERT INTO "Vehicle" (id) VALUES ('unknown');
      UPDATE "Vehicle" SET "webPublished" = true WHERE id = 'unknown';
      UPDATE "Vehicle" SET mileage = NULL WHERE id = 'existing';
    `);
    expect((await db.query('SELECT * FROM "Vehicle" ORDER BY mileage ASC NULLS LAST, id')).rows).toEqual([
      { id: 'zero', mileage: 0, webPublished: false },
      { id: 'existing', mileage: null, webPublished: false },
      { id: 'unknown', mileage: null, webPublished: true },
    ]);
    expect((await db.query('SELECT id FROM "Vehicle" WHERE mileage <= 100')).rows).toEqual([{ id: 'zero' }]);
  } finally {
    await db.close();
  }
});
