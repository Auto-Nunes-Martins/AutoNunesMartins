import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('$lib/server/publicVehicles', () => ({ publicRequest: vi.fn() }));
import { publicRequest } from '$lib/server/publicVehicles';
import { GET } from './dados/+server';
const ids = ['audi-2022-012345abcdef', 'bmw-2020-012345abcdef', 'dacia-2023-012345abcdef', 'tesla-2021-012345abcdef'];
const request = (query: string) => GET({ url: new URL(`http://site.test/comparar/dados?${query}`) } as Parameters<typeof GET>[0]);
beforeEach(() => vi.mocked(publicRequest).mockReset());
describe('Public comparison endpoint', () => {
  it.each(['id=porsche-911', 'id=../private', 'vin=secret', `id=${ids[0]}&id=${ids[0]}`, ids.map(id => `id=${id}`).join('&')])('rejects invalid selections before any lookup: %s', async query => {
    expect((await request(query)).status).toBe(400);
    expect(publicRequest).not.toHaveBeenCalled();
  });
  it('loads selected slugs in one fresh batch, including vehicles outside the first catalogue page', async () => {
    vi.mocked(publicRequest).mockResolvedValue(Response.json({ items: ids.slice(0,3).map(id=>({id,status:404,vehicle:null})) }));
    const response = await request(ids.slice(0, 3).map(id => `id=${id}`).join('&'));
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(publicRequest).toHaveBeenCalledTimes(1);
    expect(String(vi.mocked(publicRequest).mock.calls[0]![0])).toContain('/selection?id='+ids[0]);
    expect((await response.json()).items.map((item: { id: string }) => item.id)).toEqual(ids.slice(0, 3));
  });
  it('refreshes lookups on every request and preserves not-published vs service-error states', async () => {
    vi.mocked(publicRequest).mockResolvedValueOnce(Response.json({items:[{id:ids[0],status:404,vehicle:null}]})).mockResolvedValueOnce(new Response(null,{status:503}));
    expect((await (await request(`id=${ids[0]}`)).json()).items[0].status).toBe(404);
    expect((await (await request(`id=${ids[0]}`)).json()).items[0].status).toBe(503);
    expect(publicRequest).toHaveBeenCalledTimes(2);
  });
});
