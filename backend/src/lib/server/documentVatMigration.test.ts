import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';
it('preserves historical amounts, corrects estimates and never fabricates fiscal documents', async () => {
  const db = await PGlite.create();
  try {
    const root = resolve('prisma/migrations');
    const migration = '20261115120000_document_vat';
    for (const dir of readdirSync(root)
      .filter((d) => /^\d/.test(d) && d < migration)
      .sort())
      await db.exec(readFileSync(resolve(root, dir, 'migration.sql'), 'utf8'));
    await db.exec(`INSERT INTO "Customer" (id,name,phone,nif,"updatedAt") VALUES ('c','Teste','900000000','123456789',NOW());
 INSERT INTO "Vehicle" (id,brand,model,year,fuel,"purchasePrice","acquisitionDate","updatedAt") VALUES ('v','BMW','Test',2020,'DIESEL',10000,NOW(),NOW());
 INSERT INTO "VehicleExpense" (id,"vehicleId",category,description,amount,date) VALUES ('e','v','REPAIR','Histórico',1230,NOW());
 INSERT INTO "Sale" (id,"vehicleId","originalVehicleId","customerId","salePrice","vatAmount",commission,"realProfit","saleDate","updatedAt") VALUES ('s','v','v','c',12300,200.08,100,969.92,NOW(),NOW());`);
    await db.exec(readFileSync(resolve(root, migration, 'migration.sql'), 'utf8'));
    const row = (await db.query<any>('SELECT * FROM "Sale"')).rows[0];
    expect(row.commission).toBe('100.00');
    expect(row.commissionGross).toBeNull();
    expect(row.commissionVat).toBeNull();
    expect(row.commissionDate).toBeNull();
    expect(row.vatDate).toBeNull();
    expect(row.vatAmount).toBe('430.08');
    expect(row.realProfit).toBe('739.92');
    expect(row.legacyFinancials).toEqual({
      vatAmount: '200.08',
      commission: '100.00',
      realProfit: '969.92',
    });
    const expense = (await db.query<any>('SELECT * FROM "VehicleExpense"')).rows[0];
    expect(expense.amount).toBe('1230.00');
    expect(expense.vatAmount).toBeNull();
    expect(expense.vatDate).toBeNull();
  } finally {
    await db.close();
  }
}, 30000);
