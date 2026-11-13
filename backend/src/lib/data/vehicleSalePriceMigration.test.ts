import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { expect, it } from 'vitest';

it('removes the duplicate price, rescues missing stock prices and preserves recorded sales', async () => {
  const db = await PGlite.create();
  try {
    await db.exec(`
      CREATE TABLE "Vehicle" (id text PRIMARY KEY, "salePrice" numeric(12,2), "publicPrice" numeric(12,2), status text, "soldDate" timestamp);
      CREATE TABLE "Sale" ("vehicleId" text REFERENCES "Vehicle"(id));
      INSERT INTO "Vehicle" VALUES
        ('existing', 20000, 25000, 'AVAILABLE', NULL),
        ('missing', NULL, 18000, 'AVAILABLE', NULL),
        ('zero', 0, 17000, 'RESERVED', NULL),
        ('empty', NULL, NULL, 'DRAFT', NULL),
        ('sold', 0, 15000, 'SOLD', NOW()),
        ('recorded', NULL, 16000, 'AVAILABLE', NULL);
      INSERT INTO "Sale" VALUES ('recorded');
    `);
    await db.exec(readFileSync('prisma/migrations/20261113170000_unify_vehicle_sale_price/migration.sql', 'utf8'));
    const rows = (await db.query<{ id: string; salePrice: string | null }>('SELECT id, "salePrice" FROM "Vehicle" ORDER BY id')).rows;
    expect(rows.map(r => [r.id, r.salePrice === null ? null : Number(r.salePrice)])).toEqual([
      ['empty', null], ['existing', 20000], ['missing', 18000], ['recorded', null], ['sold', 0], ['zero', 17000],
    ]);
    expect((await db.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'Vehicle' AND column_name = 'publicPrice'`)).rows).toEqual([]);
  } finally { await db.close(); }
});
