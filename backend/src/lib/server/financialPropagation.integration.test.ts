import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { prismaForPglite } from '../../test/prismaForPglite.js';
const mocks = vi.hoisted(() => ({ db: {} as any }));
vi.mock('../../db.js', () => ({ prisma: mocks.db }));
vi.mock('../../env.js', () => ({
  getEnv: () => ({ CLERK_SECRET_KEY: 'isolated-integration-secret' }),
}));
vi.mock('../../logger.js', () => ({ logger: { warn: vi.fn() } }));
import { createSale, listSales, updateSaleDelivery } from './saleService.js';
import { updateVehicle } from './vehicleService.js';
import {
  createVehicleExpense,
  updateVehicleExpense,
  deleteVehicleExpense,
} from './vehicleExpenseService.js';
import { cancelSale, previewSaleCancellation } from './saleCancellationService.js';
import { loadDashboard } from './dashboardService.js';
import { cache } from '../data/cache.js';
import { publicVehicleWhere } from '../data/publicVehicle.js';
import {
  createOperationalExpense,
  updateOperationalExpense,
  deleteOperationalExpense,
} from './operationalExpenseService.js';
import type { SaleCancellationDecision } from '@anm/types';
let db: PGlite;
const actor = { actorId: 'admin', actorName: 'Admin' };
const now = new Date('2026-01-25T12:00:00Z');
const chart = () => loadDashboard('admin', now);
const resolveSale = async (id: string, decision: SaleCancellationDecision) =>
  cancelSale(
    id,
    {
      decision,
      confirmed: true,
      reviewToken: (await previewSaleCancellation(id, decision)).reviewToken,
      ...(decision.operation === 'DELETE' ? { deletionConfirmation: 'ELIMINAR' as const } : {}),
    },
    actor,
  );
beforeEach(async () => {
  cache.clearAll();
  db = await PGlite.create();
  for (const m of readdirSync(resolve('prisma/migrations'))
    .filter((n) => /^\d/.test(n))
    .sort())
    await db.exec(readFileSync(resolve('prisma/migrations', m, 'migration.sql'), 'utf8'));
  Object.assign(mocks.db, prismaForPglite(db));
  await db.exec(`INSERT INTO "User" ("id","clerkId","email","name") VALUES ('admin','test-admin','local@example.test','Admin');
    INSERT INTO "Customer" ("id","name","phone","nif","updatedAt") VALUES ('customerA','Cliente A','900000000','123456789',NOW()),('customerB','Cliente B','900000001','123456788',NOW());
    INSERT INTO "Vehicle" ("id","brand","model","year","fuel","mileage","purchasePrice","salePrice","status","acquisitionDate","updatedAt","webPublished","publicSlug","publicPrice") VALUES
    ('A','BMW','A',2020,'DIESEL',10000,10000,16000,'AVAILABLE','2025-10-01',NOW(),true,'bmw-a',16000),
    ('X','Ford','X',2019,'GASOLINE',20000,2000,5000,'AVAILABLE','2025-09-01',NOW(),false,NULL,NULL);
    INSERT INTO "OperationalExpense" ("id","category","description","amount","date") VALUES ('overhead','OTHER','Renda',200,'2026-01-05');`);
}, 30000);
afterEach(async () => {
  await db?.close();
  cache.clearAll();
});
const saleA = async () =>
  createSale(
    {
      vehicleId: 'A',
      customerId: 'customerA',
      salePrice: '16000',
      saleDate: new Date('2025-12-15'),
      commission: '100',
      buyerType: 'PARTICULAR',
      deliveryStatus: 'PENDING',
      tradeIn: {
        brand: 'Ford',
        model: 'B',
        year: 2019,
        fuel: 'DIESEL',
        mileage: 50000,
        licensePlate: 'BB-00-AA',
        allowanceValue: '3000',
        disposition: 'STOCK',
      },
    },
    actor,
  );

describe('real financial services → isolated PostgreSQL → dashboard, lists, customers and public stock', () => {
  it('restores the recorded older customer contact after deleting an erroneous sale', async () => {
    const previous = new Date('2025-11-01');
    await mocks.db.customer.update({
      where: { id: 'customerA' },
      data: { lastContactDate: previous },
    });
    const a = await saleA();
    await resolveSale(a.id, {
      reason: 'Erro',
      operation: 'DELETE',
      tradeInAction: 'KEEP',
      independentPurchasePrice: '3000',
      independentAcquisitionDate: '2025-12-15',
    });
    expect(
      (await mocks.db.customer.findUnique({ where: { id: 'customerA' } })).lastContactDate,
    ).toEqual(previous);
  });
  it('propagates operational expense create/edit/date move/delete after a primed dashboard cache', async () => {
    await cache.wrap('dashboard:admin', 90000, chart);
    const expense = await createOperationalExpense(
      { category: 'OTHER', description: 'Custo', amount: '25', date: now },
      actor,
    );
    expect(cache.get('dashboard:admin')).toBeUndefined();
    expect((await chart()).kpis.resultadoAposDespesasMes.current).toBe('-225.00');
    await cache.wrap('dashboard:admin', 90000, chart);
    await updateOperationalExpense(
      expense.id,
      { amount: '50', date: new Date('2025-12-20') },
      actor,
    );
    expect(cache.get('dashboard:admin')).toBeUndefined();
    const moved = await chart();
    expect(moved.salesChart.operatingExpenses[10]).toBe(50);
    expect(moved.kpis.despesasOperacionaisMes.current).toBe('200.00');
    await cache.wrap('dashboard:admin', 90000, chart);
    await deleteOperationalExpense(expense.id, actor);
    expect(cache.get('dashboard:admin')).toBeUndefined();
    expect((await chart()).salesChart.operatingExpenses[10]).toBe(0);
  });
  it('preserves newer customer contacts and rejects acquisition dates after sale or in the future', async () => {
    await mocks.db.customer.update({ where: { id: 'customerA' }, data: { lastContactDate: now } });
    const a = await saleA();
    expect(
      (await mocks.db.customer.findUnique({ where: { id: 'customerA' } })).lastContactDate,
    ).toEqual(now);
    await expect(
      updateVehicle('A', { acquisitionDate: new Date('2026-01-01') }, actor),
    ).rejects.toThrow('posterior');
    await expect(
      updateVehicle('X', { acquisitionDate: new Date('2099-01-01') }, actor),
    ).rejects.toThrow('futuro');
    await resolveSale(a.id, {
      reason: 'Erro',
      operation: 'DELETE',
      tradeInAction: 'KEEP',
      independentPurchasePrice: '3000',
      independentAcquisitionDate: '2025-12-15',
    });
    expect(
      (await mocks.db.customer.findUnique({ where: { id: 'customerA' } })).lastContactDate,
    ).toEqual(now);
  });
  it('propagates create, price and expense changes, preserves delivery and recalculates the original sale month', async () => {
    const a = await saleA();
    let data = await chart();
    expect(data.salesChart.sold[10]).toBe(1);
    expect(data.salesChart.ytdSold).toBe(0);
    expect(data.kpis.resultadoAposDespesasMes.current).toBe('-200.00');
    await cache.wrap('dashboard:admin', 90000, chart);
    expect(cache.get('dashboard:admin')).toBeDefined();
    await updateVehicle('A', { purchasePrice: '11000' }, actor);
    expect(cache.get('dashboard:admin')).toBeUndefined();
    const added = await createVehicleExpense(
      {
        vehicleId: 'A',
        category: 'REPAIR',
        description: 'Reparação',
        amount: '250',
        date: now,
        confirmedOnSold: true,
      },
      actor,
    );
    await updateVehicleExpense(added.id, { amount: '500', confirmedOnSold: true }, actor);
    data = await chart();
    const stored = await mocks.db.sale.findUnique({ where: { id: a.id } });
    expect(data.salesChart.profit[10]).toBe(Number(stored.realProfit));
    expect(data.salesChart.vat[10]).toBe(Number(stored.vatAmount));
    await deleteVehicleExpense(added.id, true, actor);
    await updateSaleDelivery(a.id, { deliveryStatus: 'DELIVERED', deliveryDate: now }, actor);
    const list = await listSales({});
    data = await chart();
    expect(list.totals.profit).toBe(data.salesChart.profit[10]!.toFixed(2));
    expect(list.items[0]?.deliveryStatus).toBe('DELIVERED');
    expect((await mocks.db.vehicle.findUnique({ where: { id: 'A' } })).status).toBe('DELIVERED');
    expect(await mocks.db.vehicle.findMany({ where: publicVehicleWhere() })).toEqual([]);
    expect(data.salesChart.ytdSold).toBe(0);
    expect(data.salesChart.totals12m.sold).toBe(1);
  });
  it.each(['CANCEL', 'DELETE'] as const)(
    'propagates %s A+KEEP through B January metrics, preserving C and client B',
    async (operation) => {
      const a = await saleA();
      const intake = await mocks.db.tradeIn.findUnique({ where: { saleId: a.id } });
      const b = intake.resultingVehicleId;
      await updateVehicle(b, { salePrice: '8000', status: 'AVAILABLE' }, actor);
      const bSale = await createSale(
        {
          vehicleId: b,
          customerId: 'customerB',
          salePrice: '8000',
          saleDate: new Date('2026-01-10'),
          commission: '100',
          buyerType: 'PARTICULAR',
          deliveryStatus: 'DELIVERED',
          tradeIn: {
            brand: 'Renault',
            model: 'C',
            year: 2018,
            fuel: 'GASOLINE',
            mileage: 70000,
            licensePlate: 'CC-00-AA',
            allowanceValue: '2100',
            disposition: 'STOCK',
          },
        },
        actor,
      );
      await createVehicleExpense(
        {
          vehicleId: b,
          category: 'REPAIR',
          description: 'Revisão',
          amount: '250',
          date: now,
          confirmedOnSold: true,
        },
        actor,
      );
      const c = await mocks.db.tradeIn.findUnique({ where: { saleId: bSale.id } });
      const cBefore = await mocks.db.vehicle.findUnique({ where: { id: c.resultingVehicleId } });
      await cache.wrap('dashboard:admin', 90000, chart);
      await resolveSale(a.id, {
        reason: 'Negócio corrigido',
        operation,
        tradeInAction: 'KEEP',
        independentPurchasePrice: '4500',
        independentAcquisitionDate: '2025-12-15',
      });
      expect(cache.get('dashboard:admin')).toBeUndefined();
      const data = await chart();
      expect(data.salesChart.sold[10]).toBe(0);
      expect(data.salesChart.ytdSold).toBe(1);
      expect(data.kpis.lucroMes.current).toBe('2742.28');
      expect(data.salesChart.vat[11]).toBe(607.72);
      expect(data.kpis.resultadoAposDespesasMes.current).toBe('2542.28');
      expect((await listSales({})).totals).toMatchObject({
        count: 1,
        revenue: '8000.00',
        profit: '2742.28',
        vat: '607.72',
        commission: '100.00',
      });
      expect(await mocks.db.tradeIn.findUnique({ where: { resultingVehicleId: b } })).toBeNull();
      expect(await mocks.db.vehicle.findUnique({ where: { id: c.resultingVehicleId } })).toEqual(
        cBefore,
      );
      const valid = await mocks.db.sale.findUnique({ where: { id: bSale.id } });
      expect(valid.customerId).toBe('customerB');
      expect(valid.deliveryStatus).toBe('DELIVERED');
      expect(valid.saleDate.toISOString()).toBe('2026-01-10T00:00:00.000Z');
      expect((await mocks.db.vehicle.findUnique({ where: { id: 'A' } })).webPublished).toBe(false);
      expect(await mocks.db.vehicle.findMany({ where: publicVehicleWhere() })).toEqual([]);
      if (operation === 'DELETE')
        expect(
          (await mocks.db.customer.findUnique({ where: { id: 'customerA' } })).lastContactDate,
        ).toBeNull();
    },
  );
  it('RETURN removes B from inventory while preserving its expenses and excludes A from every active period', async () => {
    const a = await saleA();
    const b = (await mocks.db.tradeIn.findUnique({ where: { saleId: a.id } })).resultingVehicleId;
    await createVehicleExpense(
      { vehicleId: b, category: 'REPAIR', description: 'Diagnóstico', amount: '75', date: now },
      actor,
    );
    await resolveSale(a.id, { reason: 'Negócio desfeito', tradeInAction: 'RETURN' });
    expect((await chart()).salesChart.totals12m.sold).toBe(0);
    expect((await listSales({})).totals.count).toBe(0);
    expect((await mocks.db.vehicle.findUnique({ where: { id: b } })).status).toBe('RETURNED');
    expect(await mocks.db.vehicleExpense.findMany({ where: { vehicleId: b } })).toHaveLength(1);
    expect(
      (
        await mocks.db.vehicle.findMany({
          where: { status: { in: ['AVAILABLE', 'RESERVED', 'DOCS_PENDING'] } },
        })
      )
        .map((v: any) => v.id)
        .sort(),
    ).toEqual(['A', 'X']);
  });
  it('uses calendar YTD and complete twelve-month financial series including expense-only months', async () => {
    await saleA();
    await createSale(
      {
        vehicleId: 'X',
        customerId: 'customerB',
        salePrice: '5000',
        saleDate: new Date('2026-01-01'),
        commission: '0',
        buyerType: 'COMERCIANTE',
        deliveryStatus: 'PENDING',
      },
      actor,
    );
    let data = await chart();
    expect(data.salesChart.ytdRevenue).toBe('5000.00');
    expect(data.salesChart.totals12m.revenue).toBe('21000.00');
    expect(data.salesChart.profit).toHaveLength(12);
    expect(data.salesChart.ytdProfit).toBe('3000.00');
    expect(data.salesChart.ytdResultAfterExpenses).toBe('2800.00');
    data = await loadDashboard('admin', new Date('2025-12-31T23:59:59Z'));
    expect(data.salesChart.ytdRevenue).toBe('16000.00');
    expect(data.salesChart.monthKeys[11]).toBe('2025-12');
  });
});
