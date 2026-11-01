import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import sharp from 'sharp';
import { createHash } from 'node:crypto';
const mock = vi.hoisted(() => ({
  objects: new Map<string, Buffer>(), calls: [] as string[], status: 404,
  pause: undefined as undefined | ((path: string) => Promise<void>),
  sanitize: vi.fn(async (input: Buffer) => input),
}));
vi.mock('./photoMetadata.js', () => ({ sanitizePhotoMetadata: mock.sanitize }));
vi.mock('../data/storage.js', () => ({
  getBucketName: () => 'fake-private',
  getSupabase: () => ({ storage: { from: () => ({
    download: async (path: string) => {
      mock.calls.push(path);
      const bytes = mock.objects.get(path);
      await mock.pause?.(path);
      return bytes ? { data: new Blob([new Uint8Array(bytes)], { type: path.endsWith('/800.webp') ? 'image/webp' : 'image/jpeg' }), error: null }
        : { data: null, error: { statusCode: mock.status } };
    },
  }) } }),
}));
import { forgetPhotoVariants, manifestPath, readPhotoBytes, readVariantManifest, variantPath } from './photoVariants.js';
const path = 'master-read/fixture.jpg';
const paths = new Set([path]);
const gate = () => { let release!: () => void; const ready = new Promise<void>(resolve => { release = resolve; }); return { ready, release }; };
const flush = () => new Promise<void>(resolve => setImmediate(resolve));
const masterCalls = () => mock.calls.filter(p => p === path);
beforeEach(() => {
  for (const p of paths) forgetPhotoVariants(p);
  mock.calls = []; mock.objects.clear(); mock.pause = undefined; mock.status = 404;
  mock.sanitize.mockReset().mockImplementation(async input => input);
  mock.objects.set(path, Buffer.from('immutable-master'));
});
afterEach(() => { vi.restoreAllMocks(); for (const p of paths) forgetPhotoVariants(p); });

it('shares one resolved master download, sanitize, Buffer and ETag across three widths', async () => {
  await readVariantManifest(path); // Known legacy master; no derivative candidates.
  const wait = gate(); mock.pause = p => p === path ? wait.ready : Promise.resolve();
  const pending = [800, 1280, 1600].map(width => readPhotoBytes(path, width as 800 | 1280 | 1600));
  await vi.waitFor(() => expect(masterCalls()).toHaveLength(1)); await flush(); wait.release();
  const results = await Promise.all(pending);
  expect(mock.sanitize).toHaveBeenCalledTimes(1);
  expect(results.every(p => p!.buffer === results[0]!.buffer && p!.etag === results[0]!.etag)).toBe(true);
  expect(results[0]!.etag).toBe('"' + createHash('sha256').update(path).update(results[0]!.buffer).digest('hex') + '"');
  expect(results[0]!.contentType).toBe('image/jpeg');
  expect((await readPhotoBytes(path, 2560))!.buffer).toBe(results[0]!.buffer);
  expect(masterCalls()).toHaveLength(1);
});

it('does not cache originals without a width and removes each settled flight', async () => {
  for (let i = 0; i < 3; i++) await readPhotoBytes(path);
  expect(masterCalls()).toHaveLength(3); expect(mock.sanitize).toHaveBeenCalledTimes(3);
});

it.each([true, false])('shares original/width overlap in either order without enabling original cache (%s)', async originalFirst => {
  const wait = gate(); mock.pause = p => p === path ? wait.ready : Promise.resolve();
  const first = readPhotoBytes(path, originalFirst ? undefined : 1600);
  await vi.waitFor(() => expect(masterCalls()).toHaveLength(1));
  const second = readPhotoBytes(path, originalFirst ? 1600 : undefined);
  await flush(); wait.release(); const [a, b] = await Promise.all([first, second]);
  expect(a!.buffer).toBe(b!.buffer); expect(masterCalls()).toHaveLength(1);
  mock.pause = undefined;
  expect((await readPhotoBytes(path, 1280))!.buffer).toBe(a!.buffer);
  await readPhotoBytes(path); expect(masterCalls()).toHaveLength(2);
});

it.each(['manifest', 'derivative'])('isolates a request invalidated while waiting for its %s before any master flight exists', async stage => {
  const before = gate(), active = gate(); let delayed = false, master = 0;
  mock.pause = p => {
    if (!delayed && p === (stage === 'manifest' ? manifestPath(path) : variantPath(path, 800))) { delayed = true; return before.ready; }
    if (p === path && ++master === 1) return active.ready;
    return Promise.resolve();
  };
  const old = readPhotoBytes(path, stage === 'manifest' ? 1280 : 800);
  await vi.waitFor(() => expect(delayed).toBe(true)); forgetPhotoVariants(path);
  const current = readPhotoBytes(path, 1600);
  await vi.waitFor(() => expect(masterCalls()).toHaveLength(1));
  before.release(); const stale = await old;
  expect(masterCalls()).toHaveLength(2); // It must not join the new reusable flight.
  active.release(); const fresh = await current;
  expect(stale!.buffer).not.toBe(fresh!.buffer);
  mock.pause = undefined;
  expect((await readPhotoBytes(path, 1280))!.buffer).toBe(fresh!.buffer);
});

it('does not resurrect bytes if invalidated after sanitize resolves but before publication', async () => {
  mock.sanitize.mockImplementationOnce(async input => { queueMicrotask(() => forgetPhotoVariants(path)); return input; });
  const old = await readPhotoBytes(path, 1280);
  const current = await readPhotoBytes(path, 1600);
  expect(masterCalls()).toHaveLength(2); expect(old!.buffer).not.toBe(current!.buffer);
});

it('rechecks the outer identity after a timing callback invalidates the request', async () => {
  const wait = gate(); mock.pause = p => p === path ? wait.ready : Promise.resolve();
  let current: ReturnType<typeof readPhotoBytes> | undefined;
  const old = readPhotoBytes(path, 1280, stage => {
    if (stage === 'photo-cache-miss' && !current) {
      forgetPhotoVariants(path);
      current = readPhotoBytes(path, 1600);
    }
  });
  await vi.waitFor(() => expect(masterCalls()).toHaveLength(2)); wait.release();
  const [a, b] = await Promise.all([old, current!]); expect(a!.buffer).not.toBe(b!.buffer);
});

it('an invalidated old finally cannot remove a newer pending flight', async () => {
  const oldGate = gate(), newGate = gate(); let count = 0;
  mock.pause = p => p === path ? (++count === 1 ? oldGate.ready : newGate.ready) : Promise.resolve();
  const old = readPhotoBytes(path, 1280);
  await vi.waitFor(() => expect(masterCalls()).toHaveLength(1)); forgetPhotoVariants(path);
  const current = readPhotoBytes(path, 1600);
  await vi.waitFor(() => expect(masterCalls()).toHaveLength(2));
  oldGate.release(); await old;
  const join = readPhotoBytes(path, 2560); await flush();
  expect(masterCalls()).toHaveLength(2);
  newGate.release(); const [a, b] = await Promise.all([current, join]); expect(a!.buffer).toBe(b!.buffer);
});

it('expires one master entry at sixty seconds without refreshing it on hits', async () => {
  const now = Date.now(), clock = vi.spyOn(Date, 'now').mockReturnValue(now);
  const first = await readPhotoBytes(path, 1280);
  clock.mockReturnValue(now + 30_000); expect((await readPhotoBytes(path, 1600))!.buffer).toBe(first!.buffer);
  clock.mockReturnValue(now + 59_999); expect((await readPhotoBytes(path, 800))!.buffer).toBe(first!.buffer);
  clock.mockReturnValue(now + 60_001); expect((await readPhotoBytes(path, 1600))!.buffer).not.toBe(first!.buffer);
  expect(masterCalls()).toHaveLength(2);
});

it.each([2_000_000, 2_000_001])('preserves the exact per-entry byte ceiling at %i bytes', async size => {
  mock.objects.set(path, Buffer.alloc(size));
  const first = await readPhotoBytes(path, 1280), second = await readPhotoBytes(path, 1600);
  expect(second!.buffer.length).toBe(size);
  expect(masterCalls()).toHaveLength(size === 2_000_000 ? 1 : 2);
  expect(second!.buffer === first!.buffer).toBe(size === 2_000_000);
});

it('charges the shared buffer once within the unchanged global budget', async () => {
  mock.objects.set(path, Buffer.alloc(2_000_000)); await readVariantManifest(path);
  const [first] = await Promise.all([readPhotoBytes(path, 800), readPhotoBytes(path, 1280), readPhotoBytes(path, 1600)]);
  for (let i = 0; i < 5; i++) {
    const p = `master-read/extra-${i}.jpg`; paths.add(p); mock.objects.set(p, Buffer.alloc(2_000_000)); await readPhotoBytes(p, 1280);
  }
  expect((await readPhotoBytes(path, 2560))!.buffer).toBe(first!.buffer); // Six unique 2MB buffers fit, three aliases would not.
  const seventh = 'master-read/seventh.jpg'; paths.add(seventh); mock.objects.set(seventh, Buffer.alloc(2_000_000)); await readPhotoBytes(seventh, 1280);
  await readPhotoBytes('master-read/extra-0.jpg', 1280);
  expect(mock.calls.filter(p => p === 'master-read/extra-0.jpg')).toHaveLength(2);
});

it('cleans failed flights so retries can succeed', async () => {
  mock.sanitize.mockRejectedValueOnce(new Error('invalid'));
  expect(await readPhotoBytes(path, 1280)).toBeNull();
  expect(await readPhotoBytes(path, 1600)).not.toBeNull();
  expect(masterCalls()).toHaveLength(2);
});

it('keeps derivative recovery ahead of the master cache and measures the extra missing-derivative probe', async () => {
  const first = await readPhotoBytes(path, 800), second = await readPhotoBytes(path, 800);
  expect(first!.buffer).toBe(second!.buffer); expect(masterCalls()).toHaveLength(1);
  expect(mock.calls.filter(p => p === variantPath(path, 800))).toHaveLength(2); // Explicit tradeoff: another 404, not another master body.
  mock.objects.set(variantPath(path, 800), await sharp({ create: { width: 800, height: 600, channels: 3, background: 'blue' } }).webp().toBuffer());
  const recovered = await readPhotoBytes(path, 800);
  expect(recovered!.buffer).not.toBe(first!.buffer); expect((await sharp(recovered!.buffer).metadata()).width).toBe(800);
});

it.each([403, 503])('does not introduce fallback on thumbnail status %i', async status => {
  await readPhotoBytes(path, 800); // Retain master without a manifest hint.
  mock.status = status;
  expect(await readPhotoBytes(path, 800)).toBeNull(); expect(masterCalls()).toHaveLength(1);
});

it('cleans a throwing download before a later retry', async () => {
  mock.pause = async p => { if (p === path) throw new Error('fixture network failure'); };
  await expect(readPhotoBytes(path)).rejects.toThrow('fixture network failure');
  mock.pause = undefined;
  expect(await readPhotoBytes(path)).not.toBeNull();
  expect(masterCalls()).toHaveLength(2);
});
