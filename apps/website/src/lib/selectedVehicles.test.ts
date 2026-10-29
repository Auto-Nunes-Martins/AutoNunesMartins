import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadSelectedVehicles, retainSelectionIdentity, selectionIdentity } from './selectedVehicles';
const ids = ['audi-012345abcdef', 'bmw-012345abcdef', 'dacia-012345abcdef', 'tesla-012345abcdef'];
const vehicle = { slug: ids[0], brand: 'Audi', model: 'A3', year: 2022, mileage: 12, fuel: 'GASOLINE', price: null, currency: 'EUR', description: null, transmission: null, availability: 'AVAILABLE', photos: [] };
afterEach(() => vi.unstubAllGlobals());
describe('Fresh selected vehicle data', () => {
  it('retains only session identity after error and replaces it after confirmed success or removal',()=>{
    const memory = new Map();
    const known={id:ids[0]!,status:200,vehicle:{...vehicle,slug:ids[0]!,currency:'EUR' as const,fuel:'GASOLINE' as const,availability:'AVAILABLE' as const}};
    retainSelectionIdentity([known],memory);
    const [failed]=retainSelectionIdentity([{id:ids[0]!,status:503,vehicle:null}],memory);
    expect(failed?.vehicle).toBeNull();expect(selectionIdentity(failed!)?.model).toBe('A3');
    expect(JSON.stringify(failed)).not.toMatch(/price|availability|mileage|specifications/);
    const [removed]=retainSelectionIdentity([{id:ids[0]!,status:404,vehicle:null}],memory);
    expect(removed).not.toHaveProperty('lastKnownIdentity');expect(memory.size).toBe(0);
    expect(retainSelectionIdentity([{id:ids[0]!,status:503,vehicle:null}],memory)[0]).not.toHaveProperty('lastKnownIdentity');
  });
  it('keeps validated unavailable identity without creating a live comparison DTO or local snapshot',async()=>{
    const unavailableVehicle={slug:ids[0],brand:'Audi',model:'A3',year:2022,photo:`/viaturas/${ids[0]}/indisponivel/foto`,vin:'SECRET',privateNotes:'SECRET'};
    vi.stubGlobal('fetch',vi.fn().mockResolvedValue(Response.json({items:[{id:ids[0],status:404,vehicle:null,unavailableVehicle}]})));
    const [entry]=await loadSelectedVehicles([ids[0]!],new AbortController().signal);
    expect(entry).toMatchObject({id:ids[0],status:404,vehicle:null,unavailableVehicle:{brand:'Audi',model:'A3',photo:unavailableVehicle.photo}});expect(JSON.stringify(entry)).not.toContain('SECRET');
  });
  it.each([['other-012345abcdef',null],[ids[0],'https://private.test/photo']])('discards unavailable identity/photo substitution %s %s',async(slug,photo)=>{
    vi.stubGlobal('fetch',vi.fn().mockResolvedValue(Response.json({items:[{id:ids[0],status:404,vehicle:null,unavailableVehicle:{slug,brand:'Audi',model:'A3',year:2022,photo}}]})));
    expect((await loadSelectedVehicles([ids[0]!],new AbortController().signal))[0]).toEqual({id:ids[0],status:404,vehicle:null});
  });
  it('passes only matching bounded photo identities and never reuses an earlier DTO on a later load', async () => {
    const version='a'.repeat(64),fresh={...vehicle,photos:[`/api/public/vehicles/${ids[0]}/photos/0`]};
    const fetcher=vi.fn().mockResolvedValueOnce(Response.json({items:[{id:ids[0],status:200,vehicle:fresh,photoVersions:[version]}]})).mockRejectedValueOnce(new Error('offline'));
    vi.stubGlobal('fetch',fetcher);
    expect((await loadSelectedVehicles([ids[0]!],new AbortController().signal))[0]?.photoVersions).toEqual([version]);
    expect((await loadSelectedVehicles([ids[0]!],new AbortController().signal))[0]).toEqual({id:ids[0],status:503,vehicle:null});
    expect(fetcher).toHaveBeenCalledTimes(2);
    vi.stubGlobal('fetch',vi.fn().mockResolvedValue(Response.json({items:[{id:ids[0],status:200,vehicle:fresh,photoVersions:['bad']}]})));
    expect((await loadSelectedVehicles([ids[0]!],new AbortController().signal))[0]?.photoVersions).toBeUndefined();
  });
  it('loads favorites in bounded batches and retains selection order', async () => {
    const fetcher = vi.fn().mockImplementation(async (url: string) => Response.json({ items: new URL(url, 'http://site.test').searchParams.getAll('id').reverse().map(id => ({ id, status: 404, vehicle: null })) }));
    vi.stubGlobal('fetch', fetcher);
    const result = await loadSelectedVehicles(ids, new AbortController().signal);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(result.map(item => item.id)).toEqual(ids);
    expect(fetcher.mock.calls[0]![1]).toMatchObject({ cache: 'no-store', credentials: 'omit' });
  });
  it('strips private fields and refuses mismatched data instead of using a stale snapshot', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ items: [
      { id: ids[0], status: 200, vehicle: { ...vehicle, vin: 'SECRET', privateNotes: 'SECRET' } },
      { id: ids[1], status: 200, vehicle },
    ] })));
    const result = await loadSelectedVehicles(ids.slice(0, 2), new AbortController().signal);
    expect(result[0]?.status).toBe(200); expect(JSON.stringify(result)).not.toContain('SECRET');
    expect(result[1]).toEqual({ id: ids[1], status: 503, vehicle: null });
  });
  it.each([null, {}, { items: [null] }, { items: 'invalid' }])('tolerates malformed response %j', async data => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(data)));
    expect((await loadSelectedVehicles([ids[0]!], new AbortController().signal))[0]?.status).toBe(503);
  });
  it('represents offline and no-longer-public vehicles without fabricated fields', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    expect((await loadSelectedVehicles([ids[0]!], new AbortController().signal))[0]?.vehicle).toBeNull();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ items: [{ id: ids[0], status: 404, vehicle: { ...vehicle, availability: 'SOLD' } }] })));
    expect((await loadSelectedVehicles([ids[0]!], new AbortController().signal))[0]).toEqual({ id: ids[0], status: 404, vehicle: null });
  });
});
