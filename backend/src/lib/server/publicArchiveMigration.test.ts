import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
describe('additive minimal archive migration', () => {
  it('preserves vehicle data, retains archive after deletion, bounds pixels and enables RLS', async () => {
    const db = await PGlite.create();
    try {
      await db.exec(
        'CREATE TABLE "Vehicle" (id TEXT PRIMARY KEY, "webPublished" BOOLEAN, "publicPhotoPaths" TEXT[]); INSERT INTO "Vehicle" VALUES (\'car\', false, ARRAY[\'private\']);',
      );
      const before = await db.query('SELECT * FROM "Vehicle"');
      await db.exec(
        readFileSync(
          new URL(
            '../../../prisma/migrations/20261018230000_minimal_public_vehicle_archive/migration.sql',
            import.meta.url,
          ),
          'utf8',
        ),
      );
      expect((await db.query('SELECT * FROM "Vehicle"')).rows).toEqual(before.rows);
      expect(
        (
          await db.query<{ relrowsecurity: boolean }>(
            "SELECT relrowsecurity FROM pg_class WHERE relname = 'PublicVehicleArchive'",
          )
        ).rows[0]?.relrowsecurity,
      ).toBe(true);
      await db.exec(
        "INSERT INTO \"PublicVehicleArchive\" (slug,\"originKey\",\"vehicleId\",brand,model,year,\"photoBytes\",\"updatedAt\") VALUES ('car-slug','origin','car','BMW','Série 1',2019,decode('aabb','hex'),now());",
      );
      await expect(
        db.query(
          'UPDATE "PublicVehicleArchive" SET "photoBytes" = decode(repeat(\'ab\',800001),\'hex\')',
        ),
      ).rejects.toThrow();
      await db.exec('DELETE FROM "Vehicle" WHERE id = \'car\';');
      const row = (
        await db.query<{ vehicleId: string | null; brand: string; size: number }>(
          'SELECT "vehicleId",brand,octet_length("photoBytes") AS size FROM "PublicVehicleArchive"',
        )
      ).rows[0];
      expect(row).toEqual({ vehicleId: null, brand: 'BMW', size: 2 });
    } finally {
      await db.close();
    }
  }, 20_000);
});
