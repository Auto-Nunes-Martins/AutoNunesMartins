import { afterEach, describe, expect, it, vi } from 'vitest';
import type { RequestEvent } from '@sveltejs/kit';
vi.mock('$env/static/public', () => ({ PUBLIC_BACKEND_URL: 'http://backend.test' }));
vi.mock('./vehicles', () => ({ vehiclesApi: { webPublication: vi.fn(), get: vi.fn(async () => ({photos:["stored-photo"]})) } }));
import { vehiclesApi } from './vehicles';
import { webPublicationAction } from './webPublication';
const id = 'clabcdefghijklmnopqrstuvw';
function event(values: Record<string, string | string[]>) {
  const form = new FormData();
  for (const [key, value] of Object.entries(values))
    for (const item of Array.isArray(value) ? value : [value]) form.append(key, item);
  return {
    request: new Request('http://localhost/viaturas/nova?/webPublication', {
      method: 'POST',
      body: form,
    }),
  } as RequestEvent;
}
afterEach(() => vi.clearAllMocks());
describe('Shared create/edit publication action', () => {
  it('identifies an empty formatted description instead of accepting markup as content', async () => {
    const result = await webPublicationAction(
      event({
        operation: 'publish',
        publicDescription: '<!--anm:rich-description:v1--><p><br></p>',
        publicPhotoPaths: ['photo'],
      }),
      id,
    );
    expect(result).toMatchObject({
      status: 400,
      data: {
        issues: expect.arrayContaining([expect.objectContaining({ path: ['publicDescription'] })]),
      },
    });
    expect(vehiclesApi.webPublication).not.toHaveBeenCalled();
  });
  it('retains the wizard vehicle ID when the enhanced action replaces the query string', async () => {
    await webPublicationAction(
      event({
        vehicleId: id,
        operation: 'publish',
        publicDescription: 'Descrição confirmada',
        publicPhotoPaths: ['approved-photo'],
      }),
      '',
    );
    expect(vehiclesApi.webPublication).toHaveBeenCalledWith(
      expect.anything(),
      id,
      expect.objectContaining({ published: true }),
    );
  });
  it('never lets a posted identifier override the vehicle from an edit route', async () => {
    await webPublicationAction(
      event({ vehicleId: 'clzzzzzzzzzzzzzzzzzzzzzzz', operation: 'remove' }),
      id,
    );
    expect(vehiclesApi.webPublication).toHaveBeenCalledWith(expect.anything(), id, {
      published: false,
    });
  });
  it('requires explicit confirmation when the stored vehicle has no photos', async () => {
    vi.mocked(vehiclesApi.get).mockResolvedValueOnce({photos:[]} as any);
    const result = await webPublicationAction(
      event({ operation: 'publish', publicPrice: '10000', publicDescription: 'Factual' }),
      id,
    );
    expect(result).toHaveProperty('status', 400);
    expect(vehiclesApi.webPublication).not.toHaveBeenCalled();
  });
  it('allows confirmed publication with no photo and unknown price', async () => {
    await webPublicationAction(
      event({
        operation: 'publish',
        publicPrice: '',
        publicDescription: 'Factual',
        confirmWithoutPhoto: 'true',
      }),
      id,
    );
    expect(vehiclesApi.webPublication).toHaveBeenCalledWith(expect.anything(), id, {
      published: true,
      price: null,
      description: 'Factual',
      transmission: null,
    });
  });
  it('sends only explicitly approved public fields to the authenticated ADMIN API', async () => {
    await webPublicationAction(
      event({
        operation: 'publish',
        publicPrice: '10000.25',
        publicDescription: 'Factual',
        publicPhotoPaths: ['approved-photo'],
        privateNotes: 'PRIVATE',
        publicTransmission: '',
      }),
      id,
    );
    expect(vehiclesApi.webPublication).toHaveBeenCalledWith(expect.anything(), id, {
      published: true,
      price: '10000.25',
      description: 'Factual',
      transmission: null,
    });
  });
  it('unpublishes without requiring content or changing internal status', async () => {
    await webPublicationAction(event({ operation: 'remove', status: 'SOLD' }), id);
    expect(vehiclesApi.webPublication).toHaveBeenCalledWith(expect.anything(), id, {
      published: false,
    });
  });
  it('rejects malformed identifiers', async () => {
    expect(await webPublicationAction(event({ operation: 'remove' }), '../secret')).toHaveProperty(
      'status',
      400,
    );
    expect(vehiclesApi.webPublication).not.toHaveBeenCalled();
  });
});

describe('confirmed public specifications', () => {
  it('parses optional form values and forwards only approved details', async () => {
    await webPublicationAction(
      event({
        operation: 'publish',
        publicPrice: '17141.78',
        publicDescription: 'Confirmed description',
        confirmWithoutPhoto: 'true',
        specificationsPresent: 'true',
        version: '  1.0 TSI Style  ',
        powerHp: '110',
        engineCc: '999',
        seats: '7',
        doors: '5',
        category: 'Familiar',
        color: 'Cinza',
        equipment: 'Ar condicionado\nBluetooth',
        privateNotes: 'PRIVATE',
      }),
      id,
    );
    expect(vehiclesApi.webPublication).toHaveBeenCalledWith(
      expect.anything(),
      id,
      expect.objectContaining({
        specifications: {
          version: '1.0 TSI Style',
          powerHp: 110,
          engineCc: 999,
          seats: 7,
          doors: 5,
          category: 'Familiar',
          color: 'Cinza',
          equipment: ['Ar condicionado', 'Bluetooth'],
        },
      }),
    );
  });
  it('rejects invalid numeric characteristics without saving', async () => {
    const result = await webPublicationAction(
      event({
        operation: 'publish',
        publicPrice: '17141.78',
        publicDescription: 'Confirmed',
        confirmWithoutPhoto: 'true',
        specificationsPresent: 'true',
        powerHp: '-2',
      }),
      id,
    );
    expect(result).toHaveProperty('status', 400);
    expect(vehiclesApi.webPublication).not.toHaveBeenCalled();
  });
});

it('ignores legacy posted subsets and leaves order to the stored vehicle', async () => {
  await webPublicationAction(
    event({
      operation: 'publish',
      publicPrice: '18000',
      publicDescription: 'Confirmado',
      publicPhotoPaths: ['chosen-cover', 'photo-third', 'photo-second'],
    }),
    id,
  );
  expect(vehiclesApi.webPublication).toHaveBeenCalledWith(
    expect.anything(),
    id,
    expect.not.objectContaining({ photoPaths: expect.anything() }),
  );
});
