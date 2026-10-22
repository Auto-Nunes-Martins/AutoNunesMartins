import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('$env/static/public', () => ({ PUBLIC_BACKEND_URL: 'https://api.test' }));
const mocks = vi.hoisted(() => ({ get: vi.fn(), photos: vi.fn(), highlights: vi.fn(), api: vi.fn() }));
vi.mock('$lib/server/vehicles', () => ({ vehiclesApi: { get: mocks.get, signedPhotos: mocks.photos } }));
vi.mock('$lib/server/dashboard', () => ({ dashboardApi: { highlights: mocks.highlights } }));
vi.mock('$lib/server/api', async (original) => ({ ...await original<typeof import('./api')>(), apiJson: mocks.api }));
import { ApiError } from './api';
import { load as detailLoad } from '../../routes/(app)/viaturas/[id]/+page.server';
import { load as layoutLoad } from '../../routes/(app)/+layout.server';
const event = { params: { id: 'car' }, locals: { auth: () => ({ userId: 'user' }) } } as any;
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}
beforeEach(() => {
  vi.resetAllMocks();
  mocks.get.mockResolvedValue({ id: 'car', photos: ['car/a.jpg'] });
  mocks.photos.mockResolvedValue({ photos: [] });
  mocks.highlights.mockResolvedValue({ items: [] });
});
describe('CRM load latency boundaries', () => {
  it('returns vehicle details while gallery and highlights are still pending', async () => {
    const gallery = deferred<{ photos: { path: string; url: string }[] }>();
    const highlights = deferred<{ items: { id: string }[] }>();
    mocks.photos.mockReturnValue(gallery.promise);
    mocks.highlights.mockReturnValue(highlights.promise);
    const result = await detailLoad(event) as any;
    expect(result.vehicle.id).toBe('car');
    expect(mocks.photos).toHaveBeenCalledOnce();
    expect(mocks.highlights).toHaveBeenCalledOnce();
    gallery.resolve({ photos: [{ path: 'car/a.jpg', url: 'signed' }] });
    highlights.resolve({ items: [{ id: 'car' }] });
    expect(await result.signedPhotos).toHaveLength(1);
    expect(await result.isFeatured).toBe(true);
  });
  it.each([401, 403])('retains gallery access failures (%s) as streamed errors', async (status) => {
    mocks.photos.mockRejectedValue(new ApiError(status, null));
    const result = await detailLoad(event) as any;
    await expect(result.signedPhotos).rejects.toMatchObject({ status });
  });
  it('keeps missing vehicles as a page 404', async () => {
    mocks.get.mockRejectedValue(new ApiError(404, null));
    await expect(detailLoad(event)).rejects.toMatchObject({ status: 404 });
    expect(mocks.photos).not.toHaveBeenCalled();
  });
  it('starts both badge reads before /me resolves and preserves a successful badge on partial failure', async () => {
    const me = deferred<{ user: { id: string } }>();
    mocks.api.mockImplementation((_event: unknown, path: string) => {
      if (path === '/api/me') return me.promise;
      if (path === '/api/vehicles/stats') return Promise.resolve({ active: 12 });
      return Promise.reject(new ApiError(503, null));
    });
    const pending = layoutLoad(event);
    expect(mocks.api).toHaveBeenCalledTimes(3);
    me.resolve({ user: { id: 'user' } });
    expect(await pending).toMatchObject({ currentUser: { id: 'user' }, vehicleStats: { active: 12 }, taskStats: null });
  });
  it.each([401, 403])('does not hide authorization failures in sidebar badges (%s)', async (status) => {
    mocks.api.mockImplementation((_event: unknown, path: string) => path === '/api/me' ? Promise.resolve({ user: { id: 'user' } }) : Promise.reject(new ApiError(status, null)));
    await expect(layoutLoad(event)).rejects.toMatchObject({ status });
  });
});
