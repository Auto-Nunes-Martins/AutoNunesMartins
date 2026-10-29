import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { it, expect } from 'vitest';
import { vehicleBrands } from '@anm/types';
import { seedBrandCatalog } from '../../../prisma/seedBrands.js';
const root = resolve('prisma/migrations');
const migration = '20261029090000_vehicle_brand_catalog';
it('migrates existing aliases and unknowns without loss, enforces DB catalogue, and repeated seed preserves data', async () => {
  const db = await PGlite.create();
  try {
    for (const dir of readdirSync(root)
      .filter((x) => x < migration)
      .sort())
      await db.exec(readFileSync(resolve(root, dir, 'migration.sql'), 'utf8'));
    const insert = async (id: string, brand: string) =>
      db.query(
        `INSERT INTO "Vehicle" ("id","brand","model","year","fuel","mileage","purchasePrice","status","acquisitionDate","updatedAt") VALUES ($1,$2,'Legacy model',2020,'DIESEL',10,100,'AVAILABLE',now(),now())`,
        [id, brand],
      );
    await insert('nissan', '  nIsSaN  ');
    await insert('alias', '  CITROEN  ');
    await insert('unknown', 'Unknown coachbuilder');
    await insert('ambiguous', 'Alfa');
    await db.exec(readFileSync(resolve(root, migration, 'migration.sql'), 'utf8'));
    expect(
      (
        await db.query(
          'SELECT v."brand", v."legacyBrand", v."model", b."logo" FROM "Vehicle" v JOIN "VehicleBrand" b ON b."name"=v."brand" WHERE v.id=\'nissan\'',
        )
      ).rows,
    ).toEqual([
      { brand: 'Nissan', legacyBrand: '  nIsSaN  ', model: 'Legacy model', logo: 'nissan' },
    ]);
    expect(
      (await db.query('SELECT "brand","legacyBrand" FROM "Vehicle" WHERE id=\'alias\'')).rows,
    ).toEqual([{ brand: 'Citroën', legacyBrand: '  CITROEN  ' }]);
    expect(
      (
        await db.query(
          'SELECT "name","active" FROM "VehicleBrand" WHERE "active"=false ORDER BY "name"',
        )
      ).rows,
    ).toEqual([
      { name: 'Alfa', active: false },
      { name: 'Unknown coachbuilder', active: false },
    ]);
    await expect(insert('bad', 'Fake brand')).rejects.toThrow();
    await expect(insert('reuse', 'Unknown coachbuilder')).rejects.toThrow();
    await db.exec(
      `UPDATE "Vehicle" SET "model"='Preserved update',"brand"="brand" WHERE id='unknown'`,
    );
    await db.exec(`UPDATE "Vehicle" SET "brand"='Renault' WHERE id='unknown'`);
    await insert('new', 'BMW');
    await db.exec(`UPDATE "Vehicle" SET "brand"='Dacia' WHERE id='new'`);
    // Verify migration contents before the separate seed can change anything.
    for (const b of vehicleBrands)
      expect(
        (await db.query('SELECT "logo" FROM "VehicleBrand" WHERE name=$1', [b.name])).rows[0],
      ).toEqual({ logo: b.logo });
    // Execute the actual catalogue seed with an isolated PostgreSQL adapter.
    for (let repeat = 0; repeat < 2; repeat++)
      await seedBrandCatalog({
        vehicleBrand: {
          upsert: async ({ create: b }: any) => {
            await db.query(
              `INSERT INTO "VehicleBrand" ("name","key","aliases","logo","active") VALUES ($1,$2,$3,$4,true) ON CONFLICT ("name") DO UPDATE SET "key"=excluded."key","aliases"=excluded."aliases","logo"=excluded."logo","active"=true`,
              [b.name, b.key, b.aliases, b.logo],
            );
          },
        },
      } as any);
    expect((await db.query('SELECT count(*)::int AS n FROM "Vehicle"')).rows).toEqual([{ n: 5 }]);
    expect(
      (await db.query('SELECT count(*)::int AS n FROM "VehicleBrand" WHERE active')).rows,
    ).toEqual([{ n: vehicleBrands.length }]);
    // Migration's seeded logo registry must equal checked-in release catalogue.
    for (const b of vehicleBrands)
      expect(
        (await db.query('SELECT "logo" FROM "VehicleBrand" WHERE name=$1', [b.name])).rows[0],
      ).toEqual({ logo: b.logo });
  } finally {
    await db.close();
  }
}, 60000);
it('installs on an empty database with the full catalogue', async () => {
  const db = await PGlite.create();
  try {
    for (const dir of readdirSync(root)
      .filter((x) => !x.endsWith('.toml'))
      .sort())
      await db.exec(readFileSync(resolve(root, dir, 'migration.sql'), 'utf8'));
    expect((await db.query('SELECT count(*)::int AS n FROM "VehicleBrand"')).rows).toEqual([
      { n: vehicleBrands.length },
    ]);
  } finally {
    await db.close();
  }
}, 60000);
