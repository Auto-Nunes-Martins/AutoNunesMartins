import { beforeEach, afterEach, expect, it, vi } from 'vitest';
const request = vi.hoisted(() => vi.fn());
vi.mock('$lib/auth/session', () => ({ sessionFetch: request }));
import { createPhotoStaging } from './photoStaging';
let paths: string[],
  missing: ReturnType<typeof vi.fn>,
  staging: ReturnType<typeof createPhotoStaging>;
beforeEach(() => {
  vi.useFakeTimers();
  request.mockReset();
  request.mockImplementation(async () => Response.json({ missingPaths: [] }));
  paths = ['vehicle/prepared.webp'];
  missing = vi.fn();
  staging = createPhotoStaging({ endpoint: () => '/staging', paths: () => paths, missing });
  vi.stubGlobal('window', { addEventListener: vi.fn(), removeEventListener: vi.fn() });
  vi.stubGlobal('document', {
    visibilityState: 'visible',
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  });
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
it('renews on open and every minute, stops listeners/timers, and sends no unload deletion', async () => {
  const stop = staging.start();
  await vi.advanceTimersByTimeAsync(0);
  expect(JSON.parse(request.mock.calls[0]![1].body)).toEqual({ action: 'retain', paths });
  await vi.advanceTimersByTimeAsync(60000);
  expect(request).toHaveBeenCalledTimes(2);
  stop();
  await vi.advanceTimersByTimeAsync(120000);
  expect(request).toHaveBeenCalledTimes(2);
  expect(window.removeEventListener).toHaveBeenCalledWith('focus', expect.any(Function));
});
it('does not retain File data and reads only the current editor paths', async () => {
  await staging.retain();
  paths = [];
  await staging.retain();
  expect(request).toHaveBeenCalledTimes(1);
  paths = ['vehicle/next.webp'];
  await staging.discard();
  expect(JSON.parse(request.mock.calls[1]![1].body)).toEqual({ action: 'discard', paths });
});
it('marks expired/missing prepared paths for re-upload and reports explicit discard failure', async () => {
  request.mockResolvedValueOnce(Response.json({ missingPaths: paths }));
  await staging.retain();
  expect(missing).toHaveBeenCalledWith(paths);
  request.mockResolvedValueOnce(new Response('', { status: 503 }));
  await expect(staging.discard()).rejects.toThrow('confirmar');
});
it('a late heartbeat cannot resurrect a path this editor has just discarded', async () => {
  await staging.discard();
  await staging.retain();
  expect(request).toHaveBeenCalledTimes(1);
  expect(JSON.parse(request.mock.calls[0]![1].body).action).toBe('discard');
});
it('closing the editor aborts a pending renewal; expiry remains a server responsibility', async () => {
  request.mockImplementationOnce(
    (_url, init) =>
      new Promise((_resolve, reject) => {
        init.signal.addEventListener('abort', () =>
          reject(new DOMException('aborted', 'AbortError')),
        );
      }),
  );
  const stop = staging.start();
  const signal = request.mock.calls[0]![1].signal as AbortSignal;
  stop();
  await vi.advanceTimersByTimeAsync(0);
  expect(signal.aborted).toBe(true);
  expect(request).toHaveBeenCalledTimes(1);
});
