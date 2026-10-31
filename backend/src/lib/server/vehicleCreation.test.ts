import { expect, it, vi } from 'vitest';
import { vehicleCreateSchema, vehicleUpdateSchema } from '@anm/types';
const mocks = vi.hoisted(() => ({ create: vi.fn(), activity: vi.fn(), transaction: vi.fn() }));
vi.mock('../../db.js', () => ({ prisma: { $transaction: mocks.transaction } }));
vi.mock('../data/activity.js', () => ({ emitActivity: mocks.activity }));
vi.mock('./vehiclePhotoCleanup.js', () => ({
  cleanupVehiclePhotos: vi.fn(),
  vehicleCleanupPhotos: vi.fn(),
}));
import { createVehicle } from './vehicleService.js';

it('saves confirmed characteristics in the initial create transaction without granting publication', async () => {
  mocks.create.mockResolvedValue({ id: 'vehicle', brand: 'Dacia', model: 'Jogger', year: 2023 });
  mocks.transaction.mockImplementation((work) => work({ vehicle: { create: mocks.create } }));
  const data = vehicleCreateSchema.parse({
    brand: 'Dacia',
    model: 'Jogger',
    year: 2023,
    fuel: 'GASOLINE',
    mileage: 10000,
    licensePlate: 'AA-00-AA',
    purchasePrice: '10000',
    salePrice: '15000',
    acquisitionDate: '2026-10-23',
    status: 'DRAFT',
    publicTransmission: 'MANUAL',
    publicSpecifications: {
      version: '1.0 TCe',
      powerHp: 110,
      engineCc: 999,
      doors: 5,
      seats: 7,
      category: 'Familiar',
      color: 'Azul',
      equipment: ['Ar condicionado'],
    },
  });
  await expect(createVehicle(data, { actorId: 'admin', actorName: 'Admin' })).resolves.toEqual({
    id: 'vehicle',
  });
  expect(mocks.create).toHaveBeenCalledWith({
    data: expect.objectContaining({
      status: 'DRAFT',
      publicTransmission: 'MANUAL',
      publicSpecifications: data.publicSpecifications,
    }),
  });
  expect(mocks.create.mock.calls[0][0].data).not.toHaveProperty('webPublished');
  expect(mocks.activity).toHaveBeenCalledOnce();
  // The existing generic update route still excludes publication-specific fields.
  expect(
    vehicleUpdateSchema.parse({
      id: 'vehicle',
      publicTransmission: 'AUTOMATIC',
      publicSpecifications: { color: 'Azul' },
    }),
  ).toEqual({ id: 'vehicle' });
});
