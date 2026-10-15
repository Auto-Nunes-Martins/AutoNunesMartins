import express from 'express';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import Decimal from 'decimal.js';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  db: {
    $transaction: vi.fn(),
    vehicle: { findUnique: vi.fn(), update: vi.fn() },
    sale: { findUnique: vi.fn(), update: vi.fn(), create: vi.fn(), delete: vi.fn() },
    vehicleExpense: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      aggregate: vi.fn(),
    },
    customer: { findUnique: vi.fn(), update: vi.fn() },
    activityLog: { create: vi.fn() },
  },
  lock: vi.fn(),
  auth: vi.fn(),
  logger: { error: vi.fn(), warn: vi.fn() },
}));
vi.mock('../../db.js', () => ({ prisma: mocks.db }));
vi.mock('../../logger.js', () => ({ logger: mocks.logger }));
vi.mock('../../middleware/clerk.js', () => ({ requireUser: mocks.auth }));
vi.mock('../data/storage.js', () => ({ createSignedReadUrls: vi.fn() }));
import {
  createVehicleExpense,
  updateVehicleExpense,
  deleteVehicleExpense,
} from './vehicleExpenseService.js';
import { updateVehicle, getVehicleWithProfit } from './vehicleService.js';
import { updateSaleDelivery } from './saleService.js';
import vehiclesRouter from '../../routes/vehicles.js';
import expensesRouter from '../../routes/vehicleExpenses.js';
import salesRouter from '../../routes/sales.js';
import { errorHandler } from '../../middleware/errorHandler.js';
import { cache } from '../data/cache.js';

const actor = { actorId: 'admin', actorName: 'Admin' };
function fixture(buyerType: 'PARTICULAR' | 'COMERCIANTE' = 'PARTICULAR') {
  return {
    vehicle: {
      id: 'vehicle',
      brand: 'BMW',
      model: 'One',
      year: 2020,
      fuel: 'DIESEL',
      mileage: 10000,
      vin: 'WBA12345678912345',
      licensePlate: 'AA-00-AA',
      status: 'SOLD',
      purchasePrice: new Decimal(10000),
      salePrice: new Decimal(15000),
      publicPrice: new Decimal(25000),
      soldDate: new Date('2026-10-10'),
      acquisitionDate: new Date('2026-01-01'),
      photos: ['vehicle/photo.jpg'],
      pendingDocFlags: { financing: true, docs: true, imt: false, registration: false },
      description: 'Notes',
      webPublished: true,
      sourceTradeIn: null,
    },
    sale: {
      id: 'sale',
      vehicleId: 'vehicle',
      customerId: 'customer',
      salePrice: new Decimal(15000),
      vatAmount: new Decimal(buyerType === 'COMERCIANTE' ? 0 : '916.26'),
      commission: new Decimal(500),
      realProfit: new Decimal(buyerType === 'COMERCIANTE' ? 5400 : '4483.74'),
      buyerType,
      saleDate: new Date('2026-10-10'),
      deliveryDate: null,
      deliveryStatus: 'PENDING',
      tradeIn: null,
    },
    expenses: [
      {
        id: 'expense',
        vehicleId: 'vehicle',
        category: 'REPAIR',
        description: 'Repair',
        amount: new Decimal(100),
        date: new Date('2026-10-10'),
      },
    ],
    customer: { id: 'customer', name: 'Ana', nif: '123456789', phone: '900000000', email: null },
    activity: [] as unknown[],
  };
}
let state = fixture();
const snapshot = () => ({
  ...state,
  vehicle: { ...state.vehicle },
  sale: { ...state.sale },
  expenses: state.expenses.map((row) => ({ ...row })),
  activity: [...state.activity],
});
let lockTail = Promise.resolve();
let server: Server;
let base: string;
beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use('/vehicles', vehiclesRouter);
  app.use('/expenses', expensesRouter);
  app.use('/sales', salesRouter);
  app.use(errorHandler);
  server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(async () => {
  server.closeAllConnections();
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
});
beforeEach(() => {
  vi.resetAllMocks();
  cache.clearAll();
  state = fixture();
  lockTail = Promise.resolve();
  mocks.auth.mockImplementation((req, _res, next) => {
    req.user = { id: 'admin', name: 'Admin' };
    next();
  });
  mocks.db.$transaction.mockImplementation(async (work) => {
    let release: (() => void) | undefined;
    let before: ReturnType<typeof snapshot> | undefined;
    const tx = {
      ...mocks.db,
      $queryRaw: async (...args: unknown[]) => {
        mocks.lock(...args);
        const preceding = lockTail;
        lockTail = new Promise<void>((resolve) => {
          release = resolve;
        });
        await preceding;
        before = snapshot();
        return [{ id: state.vehicle.id }];
      },
    };
    try {
      const result = await work(tx);
      // Model a view refilled before commit; the service must bust it after commit.
      cache.set('dashboard:stale', 'old', 60000);
      return result;
    } catch (error) {
      if (before) state = before;
      throw error;
    } finally {
      release?.();
    }
  });
  mocks.db.vehicle.findUnique.mockImplementation(async ({ where }) =>
    where.id === state.vehicle.id
      ? {
          ...state.vehicle,
          sale: state.sale ? { ...state.sale, customer: state.customer } : null,
          expenses: state.expenses,
          sourceTradeIn: state.vehicle.sourceTradeIn,
        }
      : null,
  );
  mocks.db.vehicle.update.mockImplementation(async ({ data }) => {
    const updates = { ...data };
    for (const field of ['purchasePrice', 'salePrice'])
      if (updates[field] !== undefined) updates[field] = new Decimal(updates[field]);
    state.vehicle = { ...state.vehicle, ...updates };
    return { ...state.vehicle };
  });
  mocks.db.sale.findUnique.mockImplementation(async ({ where }) =>
    state.sale && (where.id === state.sale.id || where.vehicleId === state.vehicle.id)
      ? {
          ...state.sale,
          vehicle: state.vehicle,
          customer: state.customer,
        }
      : null,
  );
  mocks.db.sale.update.mockImplementation(async ({ data }) => {
    state.sale = { ...state.sale, ...data };
    return state.sale;
  });
  mocks.db.vehicleExpense.findUnique.mockImplementation(async ({ where }) => {
    const row = state.expenses.find((expense) => expense.id === where.id);
    return row ? { ...row, vehicle: { ...state.vehicle, sale: state.sale } } : null;
  });
  mocks.db.vehicleExpense.create.mockImplementation(async ({ data }) => {
    const row = {
      ...data,
      id: `expense-${state.expenses.length}`,
      amount: new Decimal(data.amount),
    };
    state.expenses = [...state.expenses, row];
    return row;
  });
  mocks.db.vehicleExpense.update.mockImplementation(async ({ where, data }) => {
    state.expenses = state.expenses.map((row) =>
      row.id === where.id
        ? {
            ...row,
            ...data,
            amount: data.amount !== undefined ? new Decimal(data.amount) : row.amount,
          }
        : row,
    );
    return state.expenses.find((row) => row.id === where.id);
  });
  mocks.db.vehicleExpense.delete.mockImplementation(async ({ where }) => {
    state.expenses = state.expenses.filter((row) => row.id !== where.id);
  });
  mocks.db.vehicleExpense.aggregate.mockImplementation(async () => ({
    _sum: { amount: state.expenses.reduce((sum, row) => sum.plus(row.amount), new Decimal(0)) },
  }));
  mocks.db.activityLog.create.mockImplementation(async ({ data }) => {
    state.activity.push(data);
    return data;
  });
});

async function request(path: string, method: string, body?: unknown) {
  return fetch(`${base}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(3000),
  });
}

describe.each(['PARTICULAR', 'COMERCIANTE'] as const)(
  'post-sale expense recalculation: %s',
  (buyerType) => {
    it.each([
      ['create', '878.86', '4321.14', '5200'],
      ['update', '860.16', '4239.84', '5100'],
      ['delete', '934.96', '4565.04', '5500'],
    ])(
      'preserves buyer type and commission after expense %s through the API',
      async (operation, vat, profit, traderProfit) => {
        state = fixture(buyerType);
        state.vehicle.status = 'DELIVERED';
        let response: Response;
        if (operation === 'create')
          response = await request('/expenses', 'POST', {
            vehicleId: 'vehicle',
            category: 'REPAIR',
            description: 'Repair2',
            amount: '200',
            date: '2026-10-14',
            confirmedOnSold: true,
          });
        else if (operation === 'update')
          response = await request('/expenses/expense', 'PATCH', {
            amount: '400',
            confirmedOnSold: true,
          });
        else response = await request('/expenses/expense?confirmedOnSold=true', 'DELETE');
        expect(response.status).toBe(operation === 'create' ? 201 : 200);
        expect(await response.json()).toMatchObject({ saleRecomputed: true });
        expect(state.sale.buyerType).toBe(buyerType);
        expect(state.sale.commission.toString()).toBe('500');
        expect(state.sale.salePrice.toString()).toBe('15000');
        expect(state.sale.vatAmount.toString()).toBe(buyerType === 'COMERCIANTE' ? '0' : vat);
        expect(state.sale.realProfit.toString()).toBe(
          buyerType === 'COMERCIANTE' ? traderProfit : profit,
        );
        expect(cache.get('dashboard:stale')).toBeUndefined();
      },
    );
    it('uses the persisted buyer type and recorded price for the vehicle figures', async () => {
      state = fixture(buyerType);
      state.vehicle.salePrice = new Decimal(19000);
      const result = await getVehicleWithProfit('vehicle');
      expect(result?.figures?.vatAmount).toBe(buyerType === 'COMERCIANTE' ? '0' : '916.26');
      expect(result?.figures?.realProfit).toBe(buyerType === 'COMERCIANTE' ? '5400' : '4483.74');
    });
    it.each([
      [{ salePrice: '16000' }, '1103.25', '5296.75', '6400'],
      [{ purchasePrice: '11000' }, '729.27', '3670.73', '4400'],
    ])(
      'recalculates a single financial correction %j',
      async (patch, vat, profit, traderProfit) => {
        state = fixture(buyerType);
        const tradeIn = {
          id: 'retoma',
          allowanceValue: new Decimal(3000),
          disposition: 'STOCK',
          resultingVehicleId: 'retoma-vehicle',
        };
        Object.assign(state.sale, { tradeIn });
        expect((await request('/vehicles/vehicle', 'PATCH', patch)).status).toBe(200);
        expect(state.sale.vatAmount.toString()).toBe(buyerType === 'COMERCIANTE' ? '0' : vat);
        expect(state.sale.realProfit.toString()).toBe(
          buyerType === 'COMERCIANTE' ? traderProfit : profit,
        );
        expect(state.sale.commission.toString()).toBe('500');
        expect(state.sale.buyerType).toBe(buyerType);
        expect(state.sale.tradeIn).toEqual(tradeIn);
      },
    );
    it('synchronizes corrected prices, preserves sale context, and leaves public price independent', async () => {
      state = fixture(buyerType);
      state.vehicle.status = 'DELIVERED';
      const previous = { ...state.sale };
      expect(
        (
          await request('/vehicles/vehicle', 'PATCH', {
            purchasePrice: '11000',
            salePrice: '16000',
          })
        ).status,
      ).toBe(200);
      expect(state.vehicle.purchasePrice.toString()).toBe('11000');
      expect(state.vehicle.salePrice.toString()).toBe('16000');
      expect(state.sale.salePrice.toString()).toBe('16000');
      expect(state.sale.vatAmount.toString()).toBe(buyerType === 'COMERCIANTE' ? '0' : '916.26');
      expect(state.sale.realProfit.toString()).toBe(
        buyerType === 'COMERCIANTE' ? '5400' : '4483.74',
      );
      expect(state.sale).toMatchObject({
        buyerType,
        commission: previous.commission,
        customerId: previous.customerId,
        saleDate: previous.saleDate,
        deliveryStatus: previous.deliveryStatus,
      });
      expect(state.vehicle.publicPrice.toString()).toBe('25000');
      expect(state.vehicle.status).toBe('DELIVERED');
      expect(state.activity).toContainEqual(
        expect.objectContaining({
          type: 'SALE_UPDATED',
          metadata: expect.objectContaining({ action: 'SALE_PRICES_CORRECTED', buyerType }),
        }),
      );
    });
  },
);

describe('post-sale editing and transaction safety', () => {
  it('keeps non-financial fields editable without changing sale figures or context', async () => {
    const before = { ...state.sale };
    expect(
      (
        await request('/vehicles/vehicle', 'PATCH', {
          purchasePrice: '10000.00',
          salePrice: '15000.00',
          licensePlate: '12AB34',
          description: 'Updated notes',
          pendingDocFlags: { financing: false, imt: true, registration: false, docs: true },
        })
      ).status,
    ).toBe(200);
    expect(state.vehicle.licensePlate).toBe('12-AB-34');
    expect(state.vehicle.description).toBe('Updated notes');
    expect(state.vehicle.pendingDocFlags.financing).toBe(false);
    expect(state.vehicle.photos).toEqual(['vehicle/photo.jpg']);
    expect(state.sale).toEqual(before);
    expect(mocks.db.sale.update).not.toHaveBeenCalled();
  });
  it('recalculates a purchase-price-only correction from the authoritative sale price, including negative margins', async () => {
    state.vehicle.salePrice = new Decimal(19000);
    await updateVehicle('vehicle', { purchasePrice: '15000' }, actor);
    expect(state.vehicle.salePrice.toString()).toBe('15000');
    expect(state.sale.salePrice.toString()).toBe('15000');
    expect(state.sale.vatAmount.toString()).toBe('0');
    expect(state.sale.realProfit.toString()).toBe('400');
  });
  it('rejects ordinary status edits that would detach or contradict an active sale', async () => {
    for (const status of ['AVAILABLE', 'RESERVED', 'DOCS_PENDING', 'DRAFT', 'DELIVERED']) {
      expect((await request('/vehicles/vehicle', 'PATCH', { status })).status).toBe(409);
    }
    expect(mocks.db.vehicle.update).not.toHaveBeenCalled();
    expect(state.sale.id).toBe('sale');
    expect(
      (
        await request('/vehicles/vehicle', 'PATCH', {
          status: 'SOLD',
          description: 'Still editable',
        })
      ).status,
    ).toBe(200);
  });
  it('rejects invalid price input before any write', async () => {
    for (const price of ['-1', 'NaN', 'abc'])
      expect((await request('/vehicles/vehicle', 'PATCH', { salePrice: price })).status).toBe(400);
    expect(mocks.db.vehicle.update).not.toHaveBeenCalled();
  });
  it('keeps expense confirmation authoritative for create, update and delete', async () => {
    await expect(
      createVehicleExpense(
        {
          vehicleId: 'vehicle',
          category: 'REPAIR',
          description: 'Repair2',
          amount: '200',
          date: new Date(),
        },
        actor,
      ),
    ).rejects.toHaveProperty('name', 'SaleExistsConfirmationRequired');
    await expect(updateVehicleExpense('expense', { amount: '400' }, actor)).rejects.toHaveProperty(
      'name',
      'SaleExistsConfirmationRequired',
    );
    await expect(deleteVehicleExpense('expense', false, actor)).rejects.toHaveProperty(
      'name',
      'SaleExistsConfirmationRequired',
    );
    expect(state.expenses[0].amount.toString()).toBe('100');
    expect(mocks.db.sale.update).not.toHaveBeenCalled();
  });
  it('rolls back corrected prices and audit if recalculation fails', async () => {
    mocks.db.sale.update.mockRejectedValueOnce(new Error('DB failure'));
    expect(
      (await request('/vehicles/vehicle', 'PATCH', { purchasePrice: '11000', salePrice: '16000' }))
        .status,
    ).toBe(500);
    expect(state.vehicle.purchasePrice.toString()).toBe('10000');
    expect(state.vehicle.salePrice.toString()).toBe('15000');
    expect(state.activity).toEqual([]);
  });
  it('rolls back expense and its audit if recalculation fails', async () => {
    mocks.db.sale.update.mockRejectedValueOnce(new Error('DB failure'));
    await expect(deleteVehicleExpense('expense', true, actor)).rejects.toThrow('DB failure');
    expect(state.expenses).toHaveLength(1);
    expect(state.activity).toEqual([]);
  });
  it('serializes concurrent expense and price corrections from current committed data', async () => {
    state = fixture('COMERCIANTE');
    await Promise.all([
      createVehicleExpense(
        {
          vehicleId: 'vehicle',
          category: 'REPAIR',
          description: 'Repair2',
          amount: '200',
          date: new Date(),
          confirmedOnSold: true,
        },
        actor,
      ),
      updateVehicle('vehicle', { purchasePrice: '11000', salePrice: '16000' }, actor),
    ]);
    expect(state.sale.realProfit.toString()).toBe('5200');
    expect(state.sale.vatAmount.toString()).toBe('0');
    expect(state.expenses).toHaveLength(2);
    expect(mocks.lock).toHaveBeenCalledTimes(2);
    for (const call of mocks.lock.mock.calls) {
      expect(call[0].join('')).toContain('FOR UPDATE');
      expect(call[1]).toBe('vehicle');
    }
  });
  it('uses the delivery action to keep the sale and sold/delivered status aligned', async () => {
    await updateSaleDelivery(
      'sale',
      { deliveryStatus: 'DELIVERED', deliveryDate: new Date('2026-10-14') },
      actor,
    );
    expect(state.vehicle.status).toBe('DELIVERED');
    await updateSaleDelivery('sale', { deliveryStatus: 'PENDING', deliveryDate: null }, actor);
    expect(state.vehicle.status).toBe('SOLD');
    expect(state.sale.deliveryStatus).toBe('PENDING');
  });
});
