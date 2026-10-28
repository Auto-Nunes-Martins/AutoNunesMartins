import Decimal from 'decimal.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { saleCreateSchema } from '../../../../shared/types/src/sale.js';
const mocks = vi.hoisted(() => ({
  db: {
    $transaction: vi.fn(),
    $queryRaw: vi.fn(),
    vehicle: { findUnique: vi.fn(), update: vi.fn(), create: vi.fn() },
    customer: { findUnique: vi.fn(), updateMany: vi.fn() },
    sale: { create: vi.fn() },
    tradeIn: { create: vi.fn() },
    vehicleExpense: { aggregate: vi.fn() },
    activityLog: { create: vi.fn() },
  },
}));
vi.mock('../../db.js', () => ({ prisma: mocks.db }));
import { createSale, TradeInVehicleConflict } from './saleService.js';
const input = (fields = {}) =>
  saleCreateSchema.parse({
    vehicleId: 'original',
    customerId: 'customer',
    salePrice: '15000',
    saleDate: '2026-10-27',
    tradeIn: {
      brand: 'Renault',
      model: 'Clio',
      year: 2018,
      fuel: 'DIESEL',
      mileage: 120000,
      licensePlate: '12ab34',
      allowanceValue: '4000',
      disposition: 'STOCK',
      notes: 'Revisão em falta',
      pendingDocFlags: { docs: true },
      ...fields,
    },
  });
beforeEach(() => {
  vi.resetAllMocks();
  mocks.db.$transaction.mockImplementation(async (fn) => fn(mocks.db));
  mocks.db.vehicle.findUnique.mockResolvedValue({
    id: 'original',
    brand: 'BMW',
    model: '320',
    status: 'AVAILABLE',
    purchasePrice: new Decimal(10000),
    sale: null,
  });
  mocks.db.customer.findUnique.mockResolvedValue({ id: 'customer', name: 'Cliente' });
  mocks.db.vehicleExpense.aggregate.mockResolvedValue({ _sum: { amount: null } });
  mocks.db.sale.create.mockResolvedValue({ id: 'sale' });
  mocks.db.vehicle.create.mockResolvedValue({
    id: 'retoma',
    brand: 'Renault',
    model: 'Clio',
    year: 2018,
  });
});
describe('trade-in draft creation inside sale transaction', () => {
  it('persists plate, nullable VIN, acquisition, cost, notes and checklist in the draft', async () => {
    const data = input();
    await createSale(data, { actorId: 'admin', actorName: 'Admin' });
    expect(mocks.db.vehicle.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        vin: null,
        licensePlate: '12-AB-34',
        status: 'DRAFT',
        acquisitionDate: data.saleDate,
        description: 'Revisão em falta',
        pendingDocFlags: { financing: false, imt: false, registration: false, docs: true },
      }),
    });
    expect(mocks.db.vehicle.create.mock.calls[0][0].data.purchasePrice.toString()).toBe('4000');
    expect(mocks.db.tradeIn.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        resultingVehicleId: 'retoma',
        vin: null,
        licensePlate: '12-AB-34',
      }),
    });
  });
  it('never creates an inventory vehicle for scrap', async () => {
    await createSale(input({ disposition: 'SCRAP', licensePlate: '' }), {
      actorId: 'admin',
      actorName: 'Admin',
    });
    expect(mocks.db.vehicle.create).not.toHaveBeenCalled();
    expect(mocks.db.tradeIn.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ resultingVehicleId: null, licensePlate: null }),
    });
  });
  it('propagates a plate conflict out of the transaction without persisting a trade-in', async () => {
    mocks.db.vehicle.create.mockRejectedValue({
      code: 'P2002',
      meta: { target: ['licensePlate'] },
    });
    await expect(
      createSale(input(), { actorId: 'admin', actorName: 'Admin' }),
    ).rejects.toBeInstanceOf(TradeInVehicleConflict);
    expect(mocks.db.tradeIn.create).not.toHaveBeenCalled();
  });
});
