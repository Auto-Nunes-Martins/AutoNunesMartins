import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
let db: PGlite;
beforeEach(async () => {
  db = await PGlite.create();
  for (const migration of readdirSync(resolve('prisma/migrations'))
    .filter((name) => /^\d/.test(name))
    .sort())
    await db.exec(readFileSync(resolve('prisma/migrations', migration, 'migration.sql'), 'utf8'));
  await db.exec(`
    INSERT INTO "Customer" ("id","name","phone","nif","updatedAt") VALUES ('customerA','Cliente A','900000000','123456789',NOW()),('customerB','Cliente B','900000001','123456788',NOW());
    INSERT INTO "Vehicle" ("id","brand","model","year","fuel","mileage","purchasePrice","status","acquisitionDate","updatedAt") VALUES
      ('A','Renault','A',2020,'DIESEL',10000,10000,'SOLD',NOW(),NOW()),
      ('B','Renault','B',2019,'DIESEL',20000,3000,'SOLD',NOW(),NOW()),
      ('C','Renault','C',2018,'DIESEL',30000,2100,'DRAFT',NOW(),NOW());
    INSERT INTO "Sale" ("id","vehicleId","originalVehicleId","customerId","salePrice","vatAmount","realProfit","saleDate","updatedAt") VALUES
      ('saleA','A','A','customerA',16000,1000,4000,NOW(),NOW()),
      ('saleB','B','B','customerB',8000,888.21,3961.79,NOW(),NOW());
    INSERT INTO "TradeIn" ("id","saleId","brand","model","year","fuel","mileage","allowanceValue","disposition","resultingVehicleId","updatedAt") VALUES
      ('tradeA','saleA','Renault','B',2019,'DIESEL',20000,3000,'STOCK','B',NOW()),
      ('tradeB','saleB','Renault','C',2018,'DIESEL',30000,2100,'STOCK','C',NOW());
    INSERT INTO "VehicleExpense" ("id","vehicleId","category","description","amount","date") VALUES ('expenseB','B','REPAIR','Reparação',250,NOW());
  `);
}, 30000);
afterEach(async () => {
  await db?.close();
});
const regularize = async (tx: PGlite) =>
  tx.exec(`
  UPDATE "Sale" SET "vehicleId"=NULL,"cancelledAt"=NOW(),"cancelledBy"='admin',"cancellationReason"='Negócio desfeito' WHERE "id"='saleA';
  UPDATE "Vehicle" SET "purchasePrice"=4500 WHERE "id"='B';
  UPDATE "Sale" SET "vatAmount"=607.72,"realProfit"=2742.28 WHERE "id"='saleB';
  DELETE FROM "TradeIn" WHERE "id"='tradeA';
`);
describe('normal stock purchase using the existing relational schema', () => {
  it('removes only A→B acquisition, retaining B sale/customer, C receipt, C cost and expenses', async () => {
    await db.transaction((tx) => regularize(tx as PGlite));
    expect(
      (await db.query(`SELECT "id" FROM "TradeIn" WHERE "resultingVehicleId"='B'`)).rows,
    ).toEqual([]);
    expect(
      (
        await db.query(
          `SELECT "id","vehicleId","customerId","salePrice"::text FROM "Sale" WHERE "id"='saleB'`,
        )
      ).rows,
    ).toEqual([{ id: 'saleB', vehicleId: 'B', customerId: 'customerB', salePrice: '8000.00' }]);
    expect(
      (await db.query(`SELECT "saleId","resultingVehicleId","allowanceValue"::text FROM "TradeIn"`))
        .rows,
    ).toEqual([{ saleId: 'saleB', resultingVehicleId: 'C', allowanceValue: '2100.00' }]);
    expect(
      (await db.query(`SELECT "purchasePrice"::text FROM "Vehicle" WHERE "id"='C'`)).rows,
    ).toEqual([{ purchasePrice: '2100.00' }]);
    expect(
      (await db.query(`SELECT "vehicleId","amount"::text FROM "VehicleExpense"`)).rows,
    ).toEqual([{ vehicleId: 'B', amount: '250.00' }]);
    expect((await db.query(`SELECT "id" FROM "Vehicle" ORDER BY "id"`)).rows).toHaveLength(3);
  });
  it('can remove the erroneous A sale without deleting B, its sale or C after the receipt is explicitly removed', async () => {
    await db.transaction(async (tx) => {
      await regularize(tx as PGlite);
      await tx.exec(`DELETE FROM "Sale" WHERE "id"='saleA';`);
    });
    expect((await db.query(`SELECT "id" FROM "Sale"`)).rows).toEqual([{ id: 'saleB' }]);
    expect((await db.query(`SELECT "id" FROM "Vehicle" ORDER BY "id"`)).rows).toEqual([
      { id: 'A' },
      { id: 'B' },
      { id: 'C' },
    ]);
    expect((await db.query(`SELECT "id" FROM "TradeIn"`)).rows).toEqual([{ id: 'tradeB' }]);
  });
  it('retains database protection for the sold B and forbids orphan receipts without any schema change', async () => {
    await db.transaction((tx) => regularize(tx as PGlite));
    await expect(db.exec(`DELETE FROM "Vehicle" WHERE "id"='B';`)).rejects.toMatchObject({
      code: expect.stringMatching(/^(23503|23001)$/),
    });
    await expect(
      db.exec(`UPDATE "TradeIn" SET "saleId"=NULL WHERE "id"='tradeB';`),
    ).rejects.toMatchObject({ code: '23502' });
    await expect(db.exec(`DELETE FROM "Sale" WHERE "id"='saleB';`)).rejects.toMatchObject({
      code: expect.stringMatching(/^(23503|23001)$/),
    });
  });
  it('rolls back acquisition, metrics and link removal together on a relational failure', async () => {
    await expect(
      db.transaction(async (tx) => {
        await regularize(tx as PGlite);
        await tx.exec(`DELETE FROM "Vehicle" WHERE "id"='B';`);
      }),
    ).rejects.toMatchObject({ code: expect.stringMatching(/^(23503|23001)$/) });
    expect(
      (await db.query(`SELECT "vehicleId","cancelledAt" FROM "Sale" WHERE "id"='saleA'`)).rows,
    ).toEqual([{ vehicleId: 'A', cancelledAt: null }]);
    expect(
      (await db.query(`SELECT "purchasePrice"::text FROM "Vehicle" WHERE "id"='B'`)).rows,
    ).toEqual([{ purchasePrice: '3000.00' }]);
    expect(
      (await db.query(`SELECT "realProfit"::text FROM "Sale" WHERE "id"='saleB'`)).rows,
    ).toEqual([{ realProfit: '3961.79' }]);
    expect(
      (await db.query(`SELECT "id" FROM "TradeIn" WHERE "resultingVehicleId"='B'`)).rows,
    ).toEqual([{ id: 'tradeA' }]);
  });
});
