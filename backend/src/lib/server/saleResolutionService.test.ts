import Decimal from 'decimal.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({
  db: {
    $transaction: vi.fn(),
    $queryRaw: vi.fn(),
    sale: { findUnique: vi.fn(), update: vi.fn(), delete: vi.fn() },
    vehicle: { update: vi.fn(), delete: vi.fn() },
    tradeIn: { update: vi.fn(), delete: vi.fn() },
    activityLog: { create: vi.fn(), findMany: vi.fn(), findFirst: vi.fn(), updateMany: vi.fn() },
  },
  cache: { clearPrefix: vi.fn() },
}));
vi.mock('../../db.js', () => ({ prisma: mocks.db }));
vi.mock('../../env.js', () => ({
  getEnv: () => ({ CLERK_SECRET_KEY: 'isolated-resolution-test' }),
}));
vi.mock('../data/cache.js', () => ({ cache: mocks.cache }));
import {
  cancelSale,
  previewSaleCancellation,
  getSaleResolutionContext,
} from './saleCancellationService.js';
import type { SaleCancellationDecision } from '@anm/types';

type Row = Record<string, any>;
let state: {
  vehicles: Record<string, Row>;
  sales: Record<string, Row>;
  trades: Record<string, Row>;
  events: Row[];
};
const actor = { actorId: 'admin' };
const date = new Date('2026-10-01T00:00:00Z');
function setup(depth = 0) {
  const vehicle = (id: string, price: string, status = 'DRAFT') => ({
    id,
    brand: 'Viatura',
    model: id,
    licensePlate: `${id}${id}-00-AA`,
    status,
    purchasePrice: price,
    acquisitionDate: date,
    photos: [],
    webPublished: false,
    soldDate: null,
    createdAt: date,
    updatedAt: date,
    expenses: [],
    pendingDocFlags: { docs: false },
  });
  const sale = (id: string, v: string, price: string, day: number) => ({
    id,
    originalVehicleId: v,
    vehicleId: v,
    customer: { id: `customer${v}`, name: `Cliente ${v}` },
    salePrice: price,
    commission: '100',
    buyerType: 'PARTICULAR',
    vatAmount: '888.21',
    realProfit: '3961.79',
    saleDate: new Date(`2026-10-${String(day).padStart(2, '0')}T00:00:00Z`),
    createdAt: date,
    updatedAt: date,
    deliveryStatus: 'PENDING',
    deliveryDate: null,
    cancelledAt: null,
    cancellationDecision: null,
  });
  state = {
    vehicles: { A: vehicle('A', '10000', 'SOLD'), B: vehicle('B', '3000') },
    sales: { saleA: sale('saleA', 'A', '16000', 1) },
    trades: {
      tradeA: {
        id: 'tradeA',
        saleId: 'saleA',
        resultingVehicleId: 'B',
        disposition: 'STOCK',
        allowanceValue: '3000',
        brand: 'Viatura',
        model: 'B',
      },
    },
    events: [],
  };
  if (depth) {
    state.vehicles.B.status = 'DELIVERED';
    state.vehicles.B.soldDate = new Date('2026-10-10');
    state.vehicles.B.expenses = [{ id: 'expenseB', amount: '250', createdAt: date }];
    state.vehicles.C = vehicle('C', '2100');
    state.sales.saleB = sale('saleB', 'B', '8000', 10);
    state.sales.saleB.deliveryStatus = 'DELIVERED';
    state.sales.saleB.deliveryDate = new Date('2026-10-11');
    state.trades.tradeB = {
      id: 'tradeB',
      saleId: 'saleB',
      resultingVehicleId: 'C',
      disposition: 'STOCK',
      allowanceValue: '2100',
    };
  }
  if (depth > 1) {
    state.vehicles.C.status = 'SOLD';
    state.vehicles.C.expenses = [{ id: 'expenseC', amount: '75', createdAt: date }];
    state.vehicles.D = vehicle('D', '900');
    state.sales.saleC = sale('saleC', 'C', '5000', 20);
    state.trades.tradeC = {
      id: 'tradeC',
      saleId: 'saleC',
      resultingVehicleId: 'D',
      disposition: 'STOCK',
      allowanceValue: '900',
    };
  }
}
const active = (id: string) => Object.values(state.sales).find((s) => s.vehicleId === id);
function viewVehicle(id: string) {
  const vehicle = state.vehicles[id];
  return {
    ...structuredClone(vehicle),
    sale: structuredClone(active(id) ?? null),
    salesHistory: Object.values(state.sales)
      .filter((s) => s.originalVehicleId === id)
      .map((s) => ({ id: s.id, saleDate: s.saleDate, cancelledAt: s.cancelledAt })),
  };
}
function viewSale(id: string) {
  const sale = state.sales[id];
  if (!sale) return null;
  const trade = Object.values(state.trades).find((t) => t.saleId === id);
  return {
    ...structuredClone(sale),
    vehicle: viewVehicle(sale.originalVehicleId),
    tradeIn: trade
      ? {
          ...structuredClone(trade),
          resultingVehicle: trade.resultingVehicleId ? viewVehicle(trade.resultingVehicleId) : null,
        }
      : null,
  };
}
const keep: SaleCancellationDecision = {
  reason: 'Negócio desfeito, aquisição da retoma confirmada',
  tradeInAction: 'KEEP',
  independentPurchasePrice: '4500',
  independentAcquisitionDate: '2026-10-01',
};
const correction: SaleCancellationDecision = {
  reason: 'Venda criada por engano',
  operation: 'DELETE',
  tradeInAction: 'KEEP',
  independentPurchasePrice: '3000',
  independentAcquisitionDate: '2026-10-01',
};
const confirm = async (decision: SaleCancellationDecision) => ({
  decision,
  confirmed: true as const,
  reviewToken: (await previewSaleCancellation('saleA', decision)).reviewToken,
  ...(decision.operation === 'DELETE' ? { deletionConfirmation: 'ELIMINAR' as const } : {}),
});
beforeEach(() => {
  vi.resetAllMocks();
  setup();
  mocks.db.sale.findUnique.mockImplementation(async ({ where }) =>
    viewSale(where.id ?? active(where.vehicleId)?.id),
  );
  mocks.db.sale.update.mockImplementation(async ({ where, data }) =>
    Object.assign(state.sales[where.id], data),
  );
  mocks.db.sale.delete.mockImplementation(async ({ where }) => {
    delete state.sales[where.id];
  });
  mocks.db.vehicle.update.mockImplementation(async ({ where, data }) =>
    Object.assign(state.vehicles[where.id], data),
  );
  mocks.db.vehicle.delete.mockImplementation(async ({ where }) => {
    delete state.vehicles[where.id];
  });
  mocks.db.tradeIn.update.mockImplementation(async ({ where, data }) =>
    Object.assign(state.trades[where.id], data),
  );
  mocks.db.tradeIn.delete.mockImplementation(async ({ where }) => {
    delete state.trades[where.id];
  });
  mocks.db.activityLog.create.mockImplementation(async ({ data }) => {
    const event = { ...data, id: String(state.events.length) };
    state.events.push(event);
    return event;
  });
  mocks.db.activityLog.findMany.mockImplementation(async ({ where }) =>
    structuredClone(
      state.events.filter(
        (e) =>
          e.entityId === where.entityId && e.entityType === 'vehicle' && e.type !== 'VEHICLE_ADDED',
      ),
    ),
  );
  mocks.db.activityLog.updateMany.mockImplementation(async ({ where, data }) => {
    let count = 0;
    for (const event of state.events) {
      const path = where.metadata.path[0];
      if (
        event.entityType === where.entityType &&
        event.entityId === where.entityId &&
        event.metadata?.[path] === where.metadata.equals &&
        (where.type
          ? event.type === where.type
          : ['VEHICLE_ADDED', 'VEHICLE_UPDATED'].includes(event.type))
      ) {
        Object.assign(event, data);
        count++;
      }
    }
    return { count };
  });
  mocks.db.activityLog.findFirst.mockImplementation(async ({ where }) =>
    state.events.find(
      (e) =>
        e.entityId === where.entityId &&
        e.actorId === where.actorId &&
        e.metadata?.reviewToken === where.metadata.equals,
    ),
  );
  mocks.db.$transaction.mockImplementation(async (fn) => {
    const before = structuredClone(state);
    try {
      return await fn(mocks.db);
    } catch (err) {
      state = before;
      throw err;
    }
  });
});
describe('preserving chains while resolving the first sale', () => {
  it.each([1, 2])(
    'regularizes only B across %i later sale(s), preserving C/D acquisitions and valid deliveries',
    async (depth) => {
      setup(depth);
      const before = structuredClone(state);
      const review = await previewSaleCancellation('saleA', keep);
      expect(review.followingVehicles.map((v) => v.id)).toEqual(
        depth === 1 ? ['B', 'C'] : ['B', 'C', 'D'],
      );
      expect(review.affectedSale).toMatchObject({
        id: 'saleB',
        afterProfit: '2742.28',
        afterVat: '607.72',
      });
      await cancelSale('saleA', await confirm(keep), actor);
      expect(state.sales.saleA.cancelledAt).toBeInstanceOf(Date);
      expect(state.vehicles.A).toMatchObject({
        status: 'AVAILABLE',
        soldDate: null,
        webPublished: false,
      });
      expect(state.vehicles.B).toMatchObject({
        status: 'DELIVERED',
        purchasePrice: '4500',
        acquisitionDate: date,
        expenses: before.vehicles.B.expenses,
        soldDate: before.vehicles.B.soldDate,
      });
      expect(new Decimal(state.sales.saleB.realProfit).toFixed(2)).toBe('2742.28');
      expect(new Decimal(state.sales.saleB.vatAmount).toFixed(2)).toBe('607.72');
      expect(state.sales.saleB).toMatchObject({
        customer: { id: 'customerB', name: 'Cliente B' },
        salePrice: before.sales.saleB.salePrice,
        commission: '100',
        buyerType: 'PARTICULAR',
        deliveryStatus: 'DELIVERED',
        deliveryDate: before.sales.saleB.deliveryDate,
        vehicleId: 'B',
      });
      expect(state.vehicles.C).toEqual(before.vehicles.C);
      expect(state.trades.tradeB).toEqual(before.trades.tradeB);
      if (depth === 2) {
        expect(state.vehicles.D).toEqual(before.vehicles.D);
        expect(state.sales.saleC).toEqual(before.sales.saleC);
        expect(state.trades.tradeC).toEqual(before.trades.tradeC);
      }
      expect(mocks.db.sale.delete).not.toHaveBeenCalled();
      expect(mocks.db.vehicle.delete).not.toHaveBeenCalled();
      expect(state.trades.tradeA).toBeUndefined();
      expect(
        state.events
          .filter((e) => e.entityId === 'B')
          .some((e) => JSON.stringify(e.metadata).includes('saleA')),
      ).toBe(false);
      expect(state.sales.saleA.cancellationDecision.snapshot.tradeIn).toBeNull();
      expect(mocks.db.$transaction).toHaveBeenCalledWith(expect.any(Function), {
        isolationLevel: 'Serializable',
      });
      expect(mocks.db.$queryRaw.mock.calls.map((args) => args[1])).toEqual(['A', 'B']);
      expect(mocks.cache.clearPrefix).toHaveBeenCalledWith('search:');
    },
  );
  it('removes the old acquisition marker and client association, without retaining an orphan trade-in or new provenance', async () => {
    setup(1);
    state.vehicles.B.description = 'Retoma da venda saleA';
    state.events.push({
      id: 'originB',
      entityType: 'vehicle',
      entityId: 'B',
      type: 'VEHICLE_ADDED',
      message: 'Viatura adicionada por retoma',
      metadata: { source: 'TRADE_IN', saleId: 'saleA', customer: 'Cliente antigo' },
    });
    state.events.push({
      id: 'receiptA',
      entityType: 'sale',
      entityId: 'saleA',
      type: 'TRADE_IN_RECEIVED',
      metadata: { resultingVehicleId: 'B' },
    });
    await cancelSale('saleA', await confirm(keep), actor);
    expect(Object.values(state.trades).some((t) => t.resultingVehicleId === 'B')).toBe(false);
    expect(state.trades.tradeB).toMatchObject({
      saleId: 'saleB',
      resultingVehicleId: 'C',
      allowanceValue: '2100',
    });
    const timeline = JSON.stringify(
      state.events.filter((e) => e.entityId === 'B' || e.entityId === 'saleB'),
    );
    expect(timeline).not.toContain('saleA');
    expect(timeline).not.toContain('Cliente antigo');
    expect(timeline).not.toContain('TRADE_IN');
    expect(state.events.find((e) => e.id === 'receiptA')?.metadata).toEqual({
      action: 'RECORD_CORRECTED',
    });
    expect(state.vehicles.B.description).toBeNull();
    expect(state.vehicles.B).not.toHaveProperty('customerId');
    expect(state.vehicles.B).not.toHaveProperty('independentAcquisition');
  });
  it('preserves B2B tax treatment and commission when B acquisition changes', async () => {
    setup(1);
    state.sales.saleB.buyerType = 'COMERCIANTE';
    const review = await previewSaleCancellation('saleA', keep);
    expect(Number(review.affectedSale?.afterVat)).toBe(0);
    await cancelSale('saleA', await confirm(keep), actor);
    expect(new Decimal(state.sales.saleB.realProfit).toFixed(2)).toBe('3350.00');
  });
  it('rejects returning or deleting an already sold B, without asking for a new C value', async () => {
    setup(1);
    await expect(
      previewSaleCancellation('saleA', { reason: keep.reason, tradeInAction: 'RETURN' }),
    ).rejects.toMatchObject({ status: 409, dependencySaleId: 'saleB' });
    await expect(
      previewSaleCancellation('saleA', {
        reason: keep.reason,
        operation: 'DELETE',
        tradeInAction: 'DELETE',
      }),
    ).rejects.toMatchObject({ status: 409 });
    expect(
      (await previewSaleCancellation('saleA', keep)).followingVehicles.find((v) => v.id === 'C')
        ?.purchasePrice,
    ).toBe('2100');
  });
  it('requires an acquisition date no later than the preserved B sale', async () => {
    setup(1);
    await expect(
      previewSaleCancellation('saleA', { ...keep, independentAcquisitionDate: '2026-10-11' }),
    ).rejects.toMatchObject({ status: 400 });
  });
  it('preserves B reservation and expenses when keeping it, and costs on return', async () => {
    state.vehicles.B.status = 'RESERVED';
    state.vehicles.B.expenses = [{ id: 'cost', amount: '80', createdAt: date }];
    await cancelSale('saleA', await confirm(keep), actor);
    expect(state.vehicles.B.status).toBe('RESERVED');
    expect(state.vehicles.B.expenses).toHaveLength(1);
    setup();
    state.vehicles.B.expenses = [{ id: 'cost', amount: '80', createdAt: date }];
    const decision = { reason: 'Cliente desistiu', tradeInAction: 'RETURN' as const };
    await cancelSale('saleA', await confirm(decision), actor);
    expect(state.vehicles.B).toMatchObject({
      status: 'RETURNED',
      purchasePrice: '3000',
      expenses: [{ amount: '80' }],
    });
  });
  it('rolls back A, B valuation, B metrics and audit if a later write fails', async () => {
    setup(2);
    const payload = await confirm(keep),
      before = structuredClone(state);
    mocks.db.tradeIn.delete.mockRejectedValueOnce(new Error('isolated write failure'));
    await expect(cancelSale('saleA', payload, actor)).rejects.toThrow('isolated write failure');
    expect(state).toEqual(before);
  });
  it('invalidates a review after B expenses, C acquisition, or the dependent sale changes', async () => {
    for (const change of [
      () => state.vehicles.B.expenses.push({ id: 'new', amount: '10', createdAt: new Date() }),
      () => (state.vehicles.C.purchasePrice = '2300'),
      () => (state.sales.saleB.salePrice = '8500'),
    ]) {
      setup(1);
      const payload = await confirm(keep);
      change();
      await expect(cancelSale('saleA', payload, actor)).rejects.toMatchObject({ status: 409 });
      expect(state.sales.saleA.cancelledAt).toBeNull();
    }
  });
  it('returns a review conflict on serialization failure with no commit', async () => {
    const payload = await confirm(keep);
    mocks.db.$transaction.mockRejectedValueOnce({ code: 'P2034' });
    await expect(cancelSale('saleA', payload, actor)).rejects.toMatchObject({ status: 409 });
    expect(state.sales.saleA.cancelledAt).toBeNull();
  });
});
describe('explicit deletion of an erroneous sale without later movements', () => {
  it.each(['KEEP', 'RETURN', 'DELETE'] as const)(
    'deletes only A sale with %s destination and records the complete audit',
    async (action) => {
      const decision: SaleCancellationDecision =
        action === 'KEEP'
          ? correction
          : { reason: correction.reason, operation: 'DELETE', tradeInAction: action };
      const payload = await confirm(decision);
      expect((await previewSaleCancellation('saleA', decision)).eliminated).toHaveLength(
        action === 'DELETE' ? 2 : 1,
      );
      const result = await cancelSale('saleA', payload, actor);
      expect(result.deleted).toBe(true);
      expect(state.sales.saleA).toBeUndefined();
      expect(state.vehicles.A.status).toBe('AVAILABLE');
      if (action === 'DELETE') {
        expect(state.vehicles.B).toBeUndefined();
        expect(state.trades.tradeA).toBeUndefined();
      } else {
        expect(state.vehicles.B).toBeDefined();
        expect(state.trades.tradeA).toBeUndefined();
      }
      expect(
        state.events.find((e) => e.metadata?.action === 'SALE_DELETED')?.metadata,
      ).toMatchObject({
        snapshot: { id: 'saleA' },
        eliminated: expect.any(Array),
        preserved: expect.any(Array),
      });
      await expect(cancelSale('saleA', payload, actor)).resolves.toMatchObject({
        deleted: true,
        alreadyCancelled: true,
      });
    },
  );
  it('also permits correction without any trade-in and preserves the original vehicle', async () => {
    state.trades = {};
    const decision: SaleCancellationDecision = { reason: 'Registo duplicado', operation: 'DELETE' };
    await cancelSale('saleA', await confirm(decision), actor);
    expect(state.sales.saleA).toBeUndefined();
    expect(Object.keys(state.vehicles)).toEqual(['A', 'B']);
  });
  it('requires both signed review and typed ELIMINAR, with explicit confirmation', async () => {
    const payload = await confirm(correction);
    for (const changed of [
      { ...payload, deletionConfirmation: undefined },
      { ...payload, confirmed: false as true },
      { ...payload, reviewToken: 'forged' },
    ])
      await expect(cancelSale('saleA', changed, actor)).rejects.toMatchObject({
        status: expect.any(Number),
      });
    expect(state.sales.saleA.cancelledAt).toBeNull();
    expect(mocks.db.sale.delete).not.toHaveBeenCalled();
  });
  it.each(['delivery', 'laterOriginal'])(
    'blocks deletion after a %s movement while retaining cancellation where possible',
    async (movement) => {
      if (movement === 'expense')
        state.vehicles.B.expenses = [{ id: 'cost', amount: '0', createdAt: date }];
      if (movement === 'sale') setup(1);
      if (movement === 'delivery') state.sales.saleA.deliveryStatus = 'DELIVERED';
      if (movement === 'edit')
        state.events.push({
          id: 'edit',
          entityType: 'vehicle',
          entityId: 'B',
          type: 'VEHICLE_UPDATED',
          metadata: {},
        });
      if (movement === 'laterOriginal')
        state.sales.later = { ...state.sales.saleA, id: 'later', saleDate: new Date('2026-10-20') };
      expect((await getSaleResolutionContext('saleA')).deletionBlockers.length).toBeGreaterThan(0);
      await expect(previewSaleCancellation('saleA', correction)).rejects.toMatchObject({
        status: 409,
      });
      await expect(previewSaleCancellation('saleA', keep)).resolves.toBeDefined();
    },
  );
  it.each(['expense', 'sale', 'edit', 'prepared'])(
    'corrects A while preserving B with a %s movement, without permitting B deletion',
    async (movement) => {
      if (movement === 'sale') setup(2);
      if (movement === 'expense')
        state.vehicles.B.expenses = [{ id: 'cost', amount: '50', createdAt: date }];
      if (movement === 'edit')
        state.events.push({
          id: 'edit',
          entityType: 'vehicle',
          entityId: 'B',
          type: 'VEHICLE_UPDATED',
          metadata: {},
        });
      if (movement === 'prepared') state.vehicles.B.status = 'AVAILABLE';
      const before = structuredClone(state);
      const ctx = await getSaleResolutionContext('saleA');
      expect(ctx.deletionBlockers).toEqual([]);
      expect(ctx.canDeleteTradeIn).toBe(false);
      expect(ctx.tradeInDeletionBlockers.length).toBeGreaterThan(0);
      const decision = movement === 'sale' ? { ...keep, operation: 'DELETE' as const } : correction;
      await expect(
        previewSaleCancellation('saleA', {
          reason: correction.reason,
          operation: 'DELETE',
          tradeInAction: 'DELETE',
        }),
      ).rejects.toMatchObject({ status: 409 });
      await cancelSale('saleA', await confirm(decision), actor);
      expect(state.sales.saleA).toBeUndefined();
      expect(state.vehicles.B.expenses).toEqual(before.vehicles.B.expenses);
      expect(state.vehicles.B.status).toBe(before.vehicles.B.status);
      expect(state.trades.tradeA).toBeUndefined();
      if (movement === 'sale') {
        expect(state.sales.saleB).toMatchObject({
          customer: before.sales.saleB.customer,
          salePrice: before.sales.saleB.salePrice,
          deliveryStatus: before.sales.saleB.deliveryStatus,
        });
        expect(state.vehicles.C).toEqual(before.vehicles.C);
        expect(state.vehicles.D).toEqual(before.vehicles.D);
        expect(state.trades.tradeB).toEqual(before.trades.tradeB);
        expect(state.sales.saleC).toEqual(before.sales.saleC);
      }
      expect(mocks.db.vehicle.delete).not.toHaveBeenCalled();
    },
  );
  it('does not permit deleting a prepared or photographed retoma even if the sale itself is removable', async () => {
    state.vehicles.B.photos = ['B/photo.webp'];
    const decision: SaleCancellationDecision = {
      reason: correction.reason,
      operation: 'DELETE',
      tradeInAction: 'DELETE',
    };
    expect((await getSaleResolutionContext('saleA')).canDeleteTradeIn).toBe(false);
    await expect(previewSaleCancellation('saleA', decision)).rejects.toMatchObject({ status: 409 });
  });
  it('supports deleting a previously annulled empty sale while preserving its completed acquisition decision', async () => {
    const initial = { ...keep, independentPurchasePrice: '3000' };
    await cancelSale('saleA', await confirm(initial), actor);
    const before = structuredClone(state.vehicles);
    await cancelSale(
      'saleA',
      await confirm({ reason: correction.reason, operation: 'DELETE' }),
      actor,
    );
    expect(state.vehicles).toEqual(before);
    expect(state.trades.tradeA).toBeUndefined();
  });
  it('never rewrites a previously confirmed trade-in acquisition during later deletion', async () => {
    await cancelSale('saleA', await confirm(keep), actor);
    await expect(previewSaleCancellation('saleA', correction)).rejects.toMatchObject({
      status: 400,
    });
    expect(state.vehicles.B.purchasePrice).toBe('4500');
  });
  it('rolls back deletion and detached origin when the final audit cannot be written', async () => {
    const payload = await confirm(correction),
      before = structuredClone(state);
    const original = mocks.db.activityLog.create.getMockImplementation()!;
    mocks.db.activityLog.create.mockImplementation(async (args) => {
      if (args.data.metadata?.action === 'SALE_DELETED') throw new Error('audit failed');
      return original(args);
    });
    await expect(cancelSale('saleA', payload, actor)).rejects.toThrow('audit failed');
    expect(state).toEqual(before);
  });
});
