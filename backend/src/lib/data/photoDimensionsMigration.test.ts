import { it, expect } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';

it('applies the additive migration locally, enforces dimensions/ownership and cascades vehicle removal', async () => {
  const db = new PGlite();
  try {
    await db.exec('CREATE TABLE "Vehicle" ("id" TEXT PRIMARY KEY); INSERT INTO "Vehicle" VALUES (\'local-fixture\');');
    await db.exec(await readFile(new URL('../../../prisma/migrations/20261025040000_photo_dimensions/migration.sql', import.meta.url), 'utf8'));
    await db.exec(await readFile(new URL('../../../prisma/migrations/20261025040100_photo_dimensions_rls/migration.sql', import.meta.url), 'utf8'));
    const insert = 'INSERT INTO "VehiclePhotoDimensions" ("version","vehicleId","width","height","sourceHash") VALUES ($1,$2,$3,$4,$5)';
    await db.query(insert, ['a'.repeat(64), 'local-fixture', 1600, 900, 'b'.repeat(64)]);
    await db.exec('CREATE ROLE metadata_reader; GRANT SELECT ON "VehiclePhotoDimensions" TO metadata_reader; SET ROLE metadata_reader;');
    expect((await db.query('SELECT * FROM "VehiclePhotoDimensions"')).rows).toEqual([]);
    await db.exec('RESET ROLE;');
    await expect(db.query(insert, ['c'.repeat(64), 'local-fixture', 0, 900, 'b'.repeat(64)])).rejects.toThrow();
    await expect(db.query(insert, ['c'.repeat(64), 'absent-owner', 1600, 900, 'b'.repeat(64)])).rejects.toThrow();
    await db.exec('DELETE FROM "Vehicle" WHERE "id" = \'local-fixture\';');
    expect((await db.query('SELECT * FROM "VehiclePhotoDimensions"')).rows).toEqual([]);
    // The rollback removes only this disposable derived metadata table.
    await db.exec('DROP TABLE "VehiclePhotoDimensions";');
    expect((await db.query('SELECT * FROM "Vehicle"')).rows).toEqual([]);
  } finally { await db.close(); }
}, 20000);
