import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

describe('cancellation migration on isolated PostgreSQL', () => {
  let db: PGlite;
  const root = resolve('prisma/migrations');
  const migration = '20261014120000_preserve_cancelled_sales';
  beforeAll(async () => {
    db = await PGlite.create();
    for (const dir of readdirSync(root)
      .filter((dir) => /^\d/.test(dir) && dir !== migration)
      .sort()) {
      await db.exec(readFileSync(resolve(root, dir, 'migration.sql'), 'utf8'));
    }
    await db.exec(`
      INSERT INTO "Customer" ("id", "name", "phone", "nif", "updatedAt") VALUES ('customer','Cliente','900000000','123456789', NOW());
      INSERT INTO "Vehicle" ("id","brand","model","year","fuel","mileage","vin","purchasePrice","salePrice","status","acquisitionDate","updatedAt")
      VALUES ('original','BMW','320',2020,'DIESEL',10000,'AAAAAAAAAAAAAAAAA',10000,16000,'SOLD',NOW(),NOW()),
      ('trade-vehicle','Ford','Focus',2019,'GASOLINE',20000,'BBBBBBBBBBBBBBBBB',3000,6000,'DRAFT',NOW(),NOW());
      INSERT INTO "Sale" ("id","vehicleId","customerId","salePrice","vatAmount","realProfit","saleDate","updatedAt") VALUES ('sale','original','customer',16000,1000,4000,NOW(),NOW());
      INSERT INTO "TradeIn" ("id","saleId","brand","model","year","fuel","mileage","allowanceValue","disposition","resultingVehicleId","updatedAt") VALUES ('trade','sale','Ford','Focus',2019,'GASOLINE',20000,3000,'STOCK','trade-vehicle',NOW());
      INSERT INTO "VehicleExpense" ("id","vehicleId","category","description","amount","date") VALUES ('cost','trade-vehicle','REPAIR','Reparação',250,NOW());
    `);
    await db.exec(readFileSync(resolve(root, migration, 'migration.sql'), 'utf8'));
  }, 30000);
  afterAll(async () => {
    await db?.close();
  });
  it('backfills the historical vehicle without changing existing sale or trade-in values', async () => {
    expect(
      (await db.query('SELECT "originalVehicleId", "vehicleId", "cancelledAt" FROM "Sale"')).rows,
    ).toEqual([{ originalVehicleId: 'original', vehicleId: 'original', cancelledAt: null }]);
    expect((await db.query('SELECT "allowanceValue"::text FROM "TradeIn"')).rows).toEqual([
      { allowanceValue: '3000.00' },
    ]);
  });
  it('prevents releasing a sale without a cancellation record and rolls back', async () => {
    await expect(
      db.transaction(async (tx) => {
        await tx.exec(`UPDATE "Vehicle" SET "status"='AVAILABLE' WHERE "id"='original';`);
        await tx.exec(`UPDATE "Sale" SET "vehicleId"=NULL WHERE "id"='sale';`);
      }),
    ).rejects.toMatchObject({ code: '23514' });
    expect((await db.query(`SELECT "status" FROM "Vehicle" WHERE "id"='original'`)).rows).toEqual([
      { status: 'SOLD' },
    ]);
  });
  it('allows resale while preserving cancelled sales, trade-in relations and expenses', async () => {
    await db.transaction(async (tx) => {
      await tx.exec(
        `UPDATE "Sale" SET "vehicleId"=NULL, "cancelledAt"=NOW(), "cancelledBy"='admin', "cancellationReason"='Desistência' WHERE "id"='sale';`,
      );
      await tx.exec(
        `UPDATE "Vehicle" SET "status"='AVAILABLE', "webPublished"=false WHERE "id"='original';`,
      );
      await tx.exec(
        `UPDATE "Vehicle" SET "status"='RETURNED', "webPublished"=false WHERE "id"='trade-vehicle';`,
      );
      await tx.exec(
        `INSERT INTO "Sale" ("id","vehicleId","originalVehicleId","customerId","salePrice","vatAmount","realProfit","saleDate","updatedAt") VALUES ('resale','original','original','customer',17000,1100,4500,NOW(),NOW());`,
      );
    });
    expect(
      (
        await db.query(
          `SELECT count(*)::int AS count FROM "Sale" WHERE "originalVehicleId"='original'`,
        )
      ).rows,
    ).toEqual([{ count: 2 }]);
    expect(
      (await db.query(`SELECT count(*)::int AS count FROM "Sale" WHERE "cancelledAt" IS NULL`))
        .rows,
    ).toEqual([{ count: 1 }]);
    expect((await db.query(`SELECT "saleId", "resultingVehicleId" FROM "TradeIn"`)).rows).toEqual([
      { saleId: 'sale', resultingVehicleId: 'trade-vehicle' },
    ]);
    expect((await db.query(`SELECT "amount"::text FROM "VehicleExpense"`)).rows).toEqual([
      { amount: '250.00' },
    ]);
    await expect(db.exec(`DELETE FROM "Vehicle" WHERE "id"='original';`)).rejects.toMatchObject({
      code: expect.stringMatching(/^(23503|23001)$/),
    });
    await expect(
      db.exec(`DELETE FROM "Vehicle" WHERE "id"='trade-vehicle';`),
    ).rejects.toMatchObject({ code: expect.stringMatching(/^(23503|23001)$/) });
  });
  it('blocks a second active sale and returned-stock reactivation while allowing ordinary historical edits', async () => {
    await expect(
      db.exec(
        `INSERT INTO "Sale" ("id","vehicleId","originalVehicleId","customerId","salePrice","vatAmount","realProfit","saleDate","updatedAt") VALUES ('duplicate','original','original','customer',17000,1100,4500,NOW(),NOW());`,
      ),
    ).rejects.toMatchObject({ code: '23505' });
    await expect(
      db.exec(`UPDATE "Vehicle" SET "status"='AVAILABLE' WHERE "id"='trade-vehicle';`),
    ).rejects.toMatchObject({ code: '23514' });
    await db.exec(
      `UPDATE "Vehicle" SET "description"='Ficha histórica corrigida', "licensePlate"='AA-01-AA', "status"='RETURNED' WHERE "id"='trade-vehicle';`,
    );
    expect(
      (
        await db.query(
          `SELECT "status", "description", "licensePlate" FROM "Vehicle" WHERE "id"='trade-vehicle'`,
        )
      ).rows,
    ).toEqual([
      { status: 'RETURNED', description: 'Ficha histórica corrigida', licensePlate: 'AA-01-AA' },
    ]);
  });
});
