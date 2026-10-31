import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RequestEvent } from '@sveltejs/kit';
vi.mock('$env/static/public', () => ({ PUBLIC_BACKEND_URL: 'http://backend.test' }));
vi.mock('$lib/server/vehicles', () => ({
  vehiclesApi: { create: vi.fn(), get: vi.fn(), signedPhotos: vi.fn() },
}));
import { vehiclesApi } from '$lib/server/vehicles';
import { actions } from './+page.server';
describe('new vehicle draft creation', () => {
  beforeEach(() => vi.clearAllMocks());
  it('creates a draft and retains the intended stock status in the next step', async () => {
    vi.mocked(vehiclesApi.create).mockResolvedValue({ id: 'clabcdefghijklmnopqrstuvw' });
    const data = new FormData();
    for (const [key, value] of Object.entries({
      brand: 'Dacia',
      model: 'Jogger',
      year: '2023',
      fuel: 'GASOLINE',
      mileage: '10000',
      vin: 'VF1AAAAAAAAAAAAAA',
      purchasePrice: '10000',
      salePrice: '15000',
      licensePlate: 'AA-00-AA',
      status: 'RESERVED',
      acquisitionDate: '2026-10-23',
    }))
      data.set(key, value);
    const event = {
      request: new Request('http://localhost/viaturas/nova?/submit', {
        method: 'POST',
        body: data,
      }),
    } as RequestEvent;
    await expect(actions.submit!(event as never)).rejects.toMatchObject({
      status: 303,
      location: expect.stringContaining('estado=RESERVED'),
    });
    expect(vehiclesApi.create).toHaveBeenCalledWith(
      event,
      expect.objectContaining({ status: 'DRAFT' }),
    );
  });
  it('does not create a vehicle when required identification is missing', async () => {
    const event = {
      request: new Request('http://localhost/viaturas/nova?/submit', {
        method: 'POST',
        body: new FormData(),
      }),
    } as RequestEvent;
    expect(await actions.submit!(event as never)).toHaveProperty('status', 400);
    expect(vehiclesApi.create).not.toHaveBeenCalled();
  });
  it('persists first-step characteristics into the draft without publishing it', async () => {
    vi.mocked(vehiclesApi.create).mockResolvedValue({ id: 'clabcdefghijklmnopqrstuvw' });
    const data = new FormData();
    for (const [key, value] of Object.entries({
      brand: 'Dacia',
      model: 'Jogger',
      year: '2023',
      fuel: 'GASOLINE',
      mileage: '10000',
      purchasePrice: '10000',
      salePrice: '15000',
      licensePlate: 'AA-00-AA',
      acquisitionDate: '2026-10-23',
      specificationsPresent: 'true',
      publicTransmission: 'MANUAL',
      version: '1.0 TCe',
      powerHp: '110',
      engineCc: '999',
      doors: '5',
      seats: '7',
      category: 'Familiar',
      color: 'Azul',
      equipment: 'Ar condicionado\n Sensores de estacionamento\n',
    }))
      data.set(key, value);
    const event = {
      request: new Request('http://localhost/viaturas/nova?/submit', {
        method: 'POST',
        body: data,
      }),
    } as RequestEvent;
    await expect(actions.submit!(event as never)).rejects.toMatchObject({ status: 303 });
    expect(vehiclesApi.create).toHaveBeenCalledWith(
      event,
      expect.objectContaining({
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
          equipment: ['Ar condicionado', 'Sensores de estacionamento'],
        },
      }),
    );
    expect(vi.mocked(vehiclesApi.create).mock.calls[0]![1]).not.toHaveProperty('webPublished');
    data.set('powerHp', '99999');
    vi.mocked(vehiclesApi.create).mockClear();
    const invalid = {
      request: new Request('http://localhost/viaturas/nova?/submit', {
        method: 'POST',
        body: data,
      }),
    } as RequestEvent;
    expect(await actions.submit!(invalid as never)).toHaveProperty('status', 400);
    expect(vehiclesApi.create).not.toHaveBeenCalled();
  });
});
