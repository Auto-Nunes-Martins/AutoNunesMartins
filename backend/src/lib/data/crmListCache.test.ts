import {PGlite} from '@electric-sql/pglite';
import {describe,it,expect,vi} from 'vitest';
vi.mock('../../db.js',()=>({prisma:{$queryRaw:vi.fn()}}));
import {crmListRevisionQuery} from './crmListCache';
import {validatedReadCache} from './validatedReadCache';
it('invalidates real PostgreSQL row versions on insert, edit, sale and deletion even when timestamps stay the same',async()=>{
 const db=new PGlite();
 try {
  await db.exec('CREATE TABLE "Vehicle" (id text primary key, value text); CREATE TABLE "Sale" (id text primary key); CREATE TABLE "Customer" (id text primary key); CREATE TABLE "VehicleExpense" (id text primary key); CREATE TABLE "TradeIn" (id text primary key);');
  const revision=async(scope:'vehicles'|'sales'|'customers')=>{const query=crmListRevisionQuery(scope);const result=await db.query<{revision:string}>(query.text,query.values);return result.rows[0].revision;};
  const cache=validatedReadCache(()=>revision('vehicles'));const loader=vi.fn(async()=> (await db.query('SELECT value FROM "Vehicle" ORDER BY id')).rows);
  expect(await cache.read('actor',loader)).toEqual([]);await db.exec(`INSERT INTO "Vehicle" VALUES ('fake-car','available')`);expect(await cache.read('actor',loader)).toEqual([{value:'available'}]);
  await cache.read('actor',loader);expect(loader).toHaveBeenCalledTimes(2);
  const oldSales=await revision('sales');await db.exec(`UPDATE "Vehicle" SET value='sold' WHERE id='fake-car'`);expect(await cache.read('actor',loader)).toEqual([{value:'sold'}]);expect(await revision('sales')).not.toBe(oldSales);
  const oldCustomers=await revision('customers');await db.exec(`INSERT INTO "Sale" VALUES ('fake-sale')`);expect(await revision('customers')).not.toBe(oldCustomers);
  for(const table of ['VehicleExpense','TradeIn']){const before=await revision('sales');await db.exec(`INSERT INTO "${table}" VALUES ('fake-related-row')`);expect(await revision('sales')).not.toBe(before);}
  await db.exec(`DELETE FROM "Vehicle" WHERE id='fake-car'`);expect(await cache.read('actor',loader)).toEqual([]);
 }finally{await db.close();}
},15000);
