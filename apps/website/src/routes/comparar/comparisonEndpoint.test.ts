import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('$lib/server/publicVehicles', () => ({ publicRequest: vi.fn() }));
import { publicRequest } from '$lib/server/publicVehicles';
import { GET } from './dados/+server';
const ids = [
  'audi-2022-012345abcdef',
  'bmw-2020-012345abcdef',
  'dacia-2023-012345abcdef',
  'tesla-2021-012345abcdef',
];
const request = (query: string) =>
  GET({ url: new URL(`http://site.test/comparar/dados?${query}`) } as Parameters<typeof GET>[0]);
beforeEach(() => vi.mocked(publicRequest).mockReset());
describe('Public comparison endpoint', () => {
  it.each([
    'id=porsche-911',
    'id=../private',
    'vin=secret',
    `id=${ids[0]}&id=${ids[0]}`,
    ids.map((id) => `id=${id}`).join('&'),
  ])('rejects invalid selections before any lookup: %s', async (query) => {
    expect((await request(query)).status).toBe(400);
    expect(publicRequest).not.toHaveBeenCalled();
  });
  it('loads selected slugs in one fresh batch, including vehicles outside the first catalogue page', async () => {
    const vehicles = ids.slice(0, 3).map((slug) => ({
      slug,
      brand: 'Marca',
      model: 'Modelo',
      year: 2022,
      fuel: 'GASOLINE',
      mileage: 12000,
      price: '20000.00',
      currency: 'EUR',
      description: null,
      transmission: null,
      availability: 'AVAILABLE',
      photos: [],
    }));
    vi.mocked(publicRequest).mockResolvedValueOnce(
      Response.json({
        items: vehicles.map((vehicle) => ({ id: vehicle.slug, status: 200, vehicle })),
      }),
    );
    const response = await request(
      ids
        .slice(0, 3)
        .map((id) => `id=${id}`)
        .join('&'),
    );
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(publicRequest).toHaveBeenCalledTimes(1);
    expect(publicRequest).toHaveBeenCalledWith(
      '/selection?' + new URLSearchParams(ids.slice(0, 3).map((id) => ['id', id])),
    );
    expect((await response.json()).items).toEqual(
      vehicles.map((vehicle) => ({ id: vehicle.slug, status: 200, vehicle })),
    );
  });
  it('refreshes lookups on every request and preserves not-published vs service-error states', async () => {
    const unavailableVehicle = {
      slug: ids[0],
      brand: 'Audi',
      model: 'A3',
      year: 2022,
      photo: null,
    };
    vi.mocked(publicRequest)
      .mockResolvedValueOnce(Response.json({ items: [{ id: ids[0], status: 404, vehicle: null }] }))
      .mockResolvedValueOnce(Response.json({ unavailableVehicle }, { status: 404 }))
      .mockResolvedValueOnce(new Response(null, { status: 503 }));
    expect((await (await request(`id=${ids[0]}`)).json()).items[0]).toEqual({
      id: ids[0],
      status: 404,
      vehicle: null,
      unavailableVehicle,
    });
    expect((await (await request(`id=${ids[0]}`)).json()).items[0]).toEqual({
      id: ids[0],
      status: 503,
      vehicle: null,
    });
    expect(vi.mocked(publicRequest).mock.calls.map(([path]) => path)).toEqual([
      '/selection?id=' + ids[0],
      '/' + ids[0],
      '/selection?id=' + ids[0],
    ]);
  });
});
