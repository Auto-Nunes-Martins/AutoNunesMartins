import express from 'express';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SaleCancellationDecision } from '@anm/types';

const mocks = vi.hoisted(() => ({
  authorized: true,
  db: {
    sale: { findUnique: vi.fn(), update: vi.fn(), findMany: vi.fn() },
    vehicle: { update: vi.fn() },
    activityLog: { create: vi.fn(), findMany: vi.fn(), findFirst: vi.fn(), updateMany: vi.fn() },
    tradeIn: { update: vi.fn(), delete: vi.fn() },
    $queryRaw: vi.fn(),
    $transaction: vi.fn(),
  },
  cache: { clearPrefix: vi.fn() },
}));
vi.mock('../../db.js', () => ({ prisma: mocks.db }));
vi.mock('../../env.js', () => ({ getEnv: () => ({ CLERK_SECRET_KEY: 'isolated-test-secret' }) }));
vi.mock('../data/cache.js', () => ({ cache: mocks.cache }));
vi.mock('../../middleware/clerk.js', () => ({
  requireUser: (
    req: { user?: unknown },
    res: { status: (code: number) => { json: (body: unknown) => void } },
    next: () => void,
  ) => {
    if (!mocks.authorized) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    req.user = { id: 'admin', name: 'Admin' };
    next();
  },
}));
import { cancelSale, previewSaleCancellation } from './saleCancellationService.js';
import { getSaleById, listSales, updateSaleDelivery } from './saleService.js';
import router from '../../routes/sales.js';
import { buildVehicleWhere } from '../data/vehicle.js';

function fixture(tradeIn = false) {
  const vehicle = {
    id: 'original',
    brand: 'BMW',
    model: '320',
    licensePlate: 'AA-00-AA',
    purchasePrice: '10000',
    status: 'DELIVERED',
    soldDate: new Date('2026-10-01'),
    webPublished: true,
    photos: ['photo'],
    pendingDocFlags: { financing: true, docs: true },
    expenses: [{ id: 'expense-original', amount: '100' }],
    updatedAt: new Date('2026-10-01'),
    createdAt: new Date('2026-09-01'),
    acquisitionDate: new Date('2026-09-01'),
    salesHistory: [] as { id: string; saleDate: Date; cancelledAt: Date | null }[],
  };
  const resultingVehicle = {
    ...structuredClone(vehicle),
    id: 'retoma',
    brand: 'Ford',
    model: 'Focus',
    status: 'RESERVED',
    soldDate: null,
    purchasePrice: '3000',
    sale: null as { id: string } | null,
    expenses: [{ id: 'expense-retoma', amount: '250' }],
  };
  return {
    id: 'sale',
    originalVehicleId: 'original',
    vehicleId: 'original' as string | null,
    salePrice: '16000',
    commission: '200',
    realProfit: '4000',
    vatAmount: '1000',
    saleDate: new Date('2026-10-01'),
    createdAt: new Date('2026-10-01'),
    deliveryDate: new Date('2026-10-03'),
    deliveryStatus: 'DELIVERED',
    customer: { id: 'customer', name: 'Cliente' },
    vehicle,
    tradeIn: tradeIn
      ? {
          id: 'trade',
          saleId: 'sale',
          disposition: 'STOCK',
          allowanceValue: '3000',
          resultingVehicleId: 'retoma',
          resultingVehicle,
        }
      : null,
    cancelledAt: null as Date | null,
    cancellationDecision: null as Record<string, unknown> | null,
    cancellationReason: null as string | null,
  };
}
let state = fixture();
const decision: SaleCancellationDecision = { reason: 'Cliente desistiu da compra' };
const actor = { actorId: 'admin' };
const confirmed = async (input = decision) => ({
  decision: input,
  confirmed: true as const,
  reviewToken: (await previewSaleCancellation('sale', input)).reviewToken,
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.authorized = true;
  state = fixture();
  mocks.db.sale.findUnique.mockImplementation(async ({ where }) =>
    where.id && where.id !== 'sale'
      ? {
          ...structuredClone(state),
          id: where.id,
          originalVehicleId: 'retoma',
          vehicle: structuredClone(state.tradeIn!.resultingVehicle),
          tradeIn: null,
        }
      : structuredClone(state),
  );
  mocks.db.activityLog.findMany.mockResolvedValue([]);
  mocks.db.sale.update.mockImplementation(async ({ data }) => {
    Object.assign(state, data);
    return state;
  });
  mocks.db.vehicle.update.mockImplementation(async ({ where, data }) => {
    const row = where.id === 'original' ? state.vehicle : state.tradeIn!.resultingVehicle;
    Object.assign(row, data);
    return row;
  });
  mocks.db.$transaction.mockImplementation(async (fn) => {
    const previous = structuredClone(state);
    try {
      return await fn(mocks.db);
    } catch (err) {
      state = previous;
      throw err;
    }
  });
});

describe('sale cancellation decisions and atomic effects', () => {
  it('preserves a sale without trade-in, delivery, documents and costs while releasing only the active link', async () => {
    const payload = await confirmed();
    const review = await previewSaleCancellation('sale', decision);
    expect(review.effects.join(' ')).toContain('nem efetua pagamentos');
    await cancelSale('sale', payload, actor);
    expect(state).toMatchObject({
      vehicleId: null,
      originalVehicleId: 'original',
      cancellationReason: decision.reason,
      deliveryStatus: 'DELIVERED',
      salePrice: '16000',
    });
    expect(state.vehicle).toMatchObject({
      status: 'AVAILABLE',
      soldDate: null,
      webPublished: false,
      photos: ['photo'],
      pendingDocFlags: { financing: true },
      expenses: [{ amount: '100' }],
    });
    expect(state.cancelledAt).toBeInstanceOf(Date);
    expect(state.cancellationDecision).toMatchObject({
      snapshot: { vehicle: { purchasePrice: '10000' } },
    });
    expect(mocks.db.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: 'Serializable',
    });
    expect(mocks.db.$queryRaw.mock.calls[0]?.[1]).toBe('original');
    expect(mocks.db.activityLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          entityType: 'sale',
          entityId: 'sale',
          metadata: expect.objectContaining({ action: 'SALE_CANCELLED' }),
        }),
      }),
    );
  });
  it('returns a trade-in outside inventory without deleting acquisition history or expenses', async () => {
    state = fixture(true);
    await cancelSale('sale', await confirmed({ ...decision, tradeInAction: 'RETURN' }), actor);
    expect(state.tradeIn).toMatchObject({
      saleId: 'sale',
      allowanceValue: '3000',
      resultingVehicle: {
        status: 'RETURNED',
        purchasePrice: '3000',
        webPublished: false,
        expenses: [{ amount: '250' }],
        photos: ['photo'],
      },
    });
    expect(buildVehicleWhere({})).toMatchObject({ status: { not: 'RETURNED' } });
    expect(buildVehicleWhere({ notStatus: 'DRAFT' })).toMatchObject({
      status: { notIn: ['DRAFT', 'RETURNED'] },
    });
    expect(buildVehicleWhere({ status: 'RETURNED' })).toMatchObject({ status: 'RETURNED' });
  });
  it.each(['RESERVED', 'DRAFT'])(
    'keeps a %s trade-in as an independent confirmed acquisition, preserving costs and old valuation',
    async (status) => {
      state = fixture(true);
      state.tradeIn!.resultingVehicle.status = status;
      const input = {
        ...decision,
        tradeInAction: 'KEEP' as const,
        independentPurchasePrice: '4200.50',
      };
      await cancelSale('sale', await confirmed(input), actor);
      expect(state.tradeIn!.resultingVehicle).toMatchObject({
        status,
        purchasePrice: '4200.50',
        webPublished: false,
        expenses: [{ amount: '250' }],
      });
      expect(state.tradeIn!.allowanceValue).toBe('3000');
      expect(state.cancellationDecision).toMatchObject({
        independentPurchasePrice: '4200.50',
        snapshot: { tradeIn: null },
      });
    },
  );
  it('requires a trade-in decision and independent acquisition value; rejects negative/overflow amounts', async () => {
    state = fixture(true);
    for (const input of [
      decision,
      { ...decision, tradeInAction: 'KEEP' as const },
      { ...decision, tradeInAction: 'KEEP' as const, independentPurchasePrice: '-1' },
      { ...decision, tradeInAction: 'KEEP' as const, independentPurchasePrice: '10000000000' },
    ]) {
      await expect(previewSaleCancellation('sale', input)).rejects.toMatchObject({ status: 400 });
    }
    expect(mocks.db.sale.update).not.toHaveBeenCalled();
  });
  it('requires preview and explicit confirmation', async () => {
    const payload = await confirmed();
    await expect(
      cancelSale('sale', { ...payload, confirmed: false as unknown as true }, actor),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      cancelSale('sale', { ...payload, reviewToken: 'forged' }, actor),
    ).rejects.toMatchObject({ status: 409 });
    expect(state.cancelledAt).toBeNull();
  });
  it('blocks a subsequent sale with its ID and allows the parent once that sale is resolved', async () => {
    state = fixture(true);
    state.tradeIn!.resultingVehicle.sale = { id: 'subsequent-sale' };
    const input = { ...decision, tradeInAction: 'RETURN' as const };
    await expect(previewSaleCancellation('sale', input)).rejects.toMatchObject({
      status: 409,
      dependencySaleId: 'subsequent-sale',
    });
    state.tradeIn!.resultingVehicle.sale = null;
    await expect(cancelSale('sale', await confirmed(input), actor)).resolves.toMatchObject({
      vehicleId: 'original',
    });
  });
  it.each(['SOLD', 'DELIVERED', 'RETURNED'])(
    'blocks an unavailable %s trade-in even without an active sale relation',
    async (status) => {
      state = fixture(true);
      state.tradeIn!.resultingVehicle.status = status;
      await expect(
        previewSaleCancellation('sale', {
          ...decision,
          tradeInAction: 'KEEP',
          independentPurchasePrice: '3000',
        }),
      ).rejects.toMatchObject({ status: 409 });
    },
  );
  it('explains scrap limitation instead of pretending the vehicle is still available', async () => {
    state = fixture(true);
    state.tradeIn!.disposition = 'SCRAP';
    await expect(
      previewSaleCancellation('sale', { ...decision, tradeInAction: 'RETURN' }),
    ).rejects.toMatchObject({ status: 409, message: expect.stringContaining('abate') });
  });
  it('rejects stale reviews after changes to original price, trade-in costs or later sale', async () => {
    state = fixture(true);
    const input = { ...decision, tradeInAction: 'RETURN' as const };
    const payload = await confirmed(input);
    state.salePrice = '17000';
    await expect(cancelSale('sale', payload, actor)).rejects.toMatchObject({ status: 409 });
    const refreshed = await confirmed(input);
    state.tradeIn!.resultingVehicle.expenses.push({ id: 'new-expense', amount: '20' });
    await expect(cancelSale('sale', refreshed, actor)).rejects.toMatchObject({ status: 409 });
    expect(state.cancelledAt).toBeNull();
  });
  it('rolls back both sale and vehicles if the audit write fails', async () => {
    state = fixture(true);
    const previous = structuredClone(state);
    const payload = await confirmed({ ...decision, tradeInAction: 'RETURN' });
    mocks.db.activityLog.create.mockRejectedValueOnce(new Error('audit unavailable'));
    await expect(cancelSale('sale', payload, actor)).rejects.toThrow('audit unavailable');
    expect(state).toEqual(previous);
  });
  it('returns a readable serialization conflict and permits an identical retry only once', async () => {
    const payload = await confirmed();
    mocks.db.$transaction.mockRejectedValueOnce({ code: 'P2034' });
    await expect(cancelSale('sale', payload, actor)).rejects.toMatchObject({ status: 409 });
    await cancelSale('sale', payload, actor);
    const writes = mocks.db.sale.update.mock.calls.length;
    expect(await cancelSale('sale', payload, actor)).toMatchObject({ alreadyCancelled: true });
    expect(mocks.db.sale.update).toHaveBeenCalledTimes(writes);
    await expect(
      cancelSale('sale', { ...payload, decision: { reason: 'Outra decisão' } }, actor),
    ).rejects.toMatchObject({ status: 409 });
  });
  it('excludes cancelled deals from active lists/exports and permits a separate history list', async () => {
    mocks.db.sale.findMany.mockResolvedValue([]);
    await listSales({});
    expect(mocks.db.sale.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({ where: { cancelledAt: null } }),
    );
    await listSales({ state: 'CANCELLED' });
    expect(mocks.db.sale.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({ where: { cancelledAt: { not: null } } }),
    );
  });
  it('blocks delivery edits on a cancelled sale and displays historical purchase valuation', async () => {
    await cancelSale('sale', await confirmed(), actor);
    await expect(
      updateSaleDelivery(
        'sale',
        { deliveryStatus: 'PENDING' },
        { actorId: 'admin', actorName: 'Admin' },
      ),
    ).rejects.toMatchObject({ status: 409 });
    state.vehicle.purchasePrice = '12000';
    expect((await getSaleById('sale'))?.vehicle.purchasePrice).toBe('10000');
  });
});

describe('authenticated cancellation HTTP endpoints', () => {
  let server: Server;
  let url: string;
  beforeAll(async () => {
    const app = express();
    app.use(express.json());
    app.use('/api/sales', router);
    app.use((err: Error, _req: unknown, res: express.Response, _next: unknown) => {
      res.status(500).json({ error: err.message });
    });
    server = app.listen(0, '127.0.0.1');
    await new Promise<void>((resolve) => server.once('listening', resolve));
    url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/sales/sale/cancellation`;
  });
  afterAll(async () => {
    await new Promise<void>((resolve, reject) =>
      server.close((err) => (err ? reject(err) : resolve())),
    );
  });
  const post = (operation: string, body: unknown) =>
    fetch(`${url}/${operation}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
  it('previews then confirms without deleting the sale; rejects missing confirmation', async () => {
    const preview = await post('preview', decision);
    expect(preview.status).toBe(200);
    const review = await preview.json();
    expect((await post('confirm', { decision, reviewToken: review.reviewToken })).status).toBe(400);
    expect(
      (await post('confirm', { decision, confirmed: true, reviewToken: review.reviewToken }))
        .status,
    ).toBe(200);
    expect(state.cancelledAt).not.toBeNull();
  });
  it('returns actionable dependencies and forwards unexpected failures in Express 4', async () => {
    state = fixture(true);
    state.tradeIn!.resultingVehicle.sale = { id: 'later-sale' };
    const response = await post('preview', { ...decision, tradeInAction: 'RETURN' });
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ dependencySaleId: 'later-sale' });
    mocks.db.sale.findUnique.mockRejectedValueOnce(new Error('isolated failure'));
    expect((await post('preview', decision)).status).toBe(500);
  });
  it('requires authentication for context, review and confirmation before reading or writing sales', async () => {
    mocks.authorized = false;
    expect((await fetch(`${url}/context`)).status).toBe(401);
    expect((await post('preview', decision)).status).toBe(401);
    expect(
      (await post('confirm', { decision, confirmed: true, reviewToken: 'token' })).status,
    ).toBe(401);
    expect(mocks.db.sale.findUnique).not.toHaveBeenCalled();
    expect(mocks.db.sale.update).not.toHaveBeenCalled();
  });
});
