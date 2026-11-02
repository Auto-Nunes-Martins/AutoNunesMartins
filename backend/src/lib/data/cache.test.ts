import { afterEach, expect, it, vi } from 'vitest';
import { cache, createTtlCache } from './cache.js';

afterEach(() => vi.useRealTimers());

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}
it('does not repopulate an invalidated user list from an in-flight pre-deletion read', async () => {
  cache.clearAll();
  let resolve!: (value: string[]) => void;
  const pending = cache.wrap(
    'users:list',
    60000,
    () =>
      new Promise<string[]>((done) => {
        resolve = done;
      }),
  );
  cache.invalidate('users:list');
  resolve(['deleted']);
  await pending;
  expect(cache.get('users:list')).toBeUndefined();
});

it('bounds retained entries using LRU order without extending their TTL', () => {
  vi.useFakeTimers();
  const bounded = createTtlCache(2);
  bounded.set('a', 1, 1000);
  bounded.set('b', 2, 1000);
  vi.advanceTimersByTime(999);
  expect(bounded.get('a')).toBe(1);
  bounded.set('c', 3, 1000);
  expect(bounded.get('b')).toBeUndefined();
  vi.advanceTimersByTime(1);
  expect(bounded.get('a')).toBeUndefined();
  expect(bounded.get('c')).toBe(3);
});

it('sweeps expired keys that are never queried again before evicting fresh values', () => {
  vi.useFakeTimers();
  const bounded = createTtlCache(2);
  bounded.set('fresh', 1, 10_000);
  bounded.set('abandoned', 2, 100);
  vi.advanceTimersByTime(1000);
  bounded.set('new', 3, 1000);
  expect(bounded.get('fresh')).toBe(1);
  expect(bounded.get('abandoned')).toBeUndefined();
});

it('runs one loader for concurrent requests and retries after failure', async () => {
  const bounded = createTtlCache();
  const first = deferred<string>();
  const load = vi.fn(() => first.promise);
  const a = bounded.wrap('key', 1000, load);
  const b = bounded.wrap('key', 1000, load);
  expect(a).toBe(b);
  const failures = Promise.allSettled([a, b]);
  first.reject(new Error('temporary'));
  expect((await failures).every((result) => result.status === 'rejected')).toBe(true);
  expect(load).toHaveBeenCalledTimes(1);
  expect(await bounded.wrap('key', 1000, async () => 'recovered')).toBe('recovered');
  expect(bounded.get('key')).toBe('recovered');
});

it.each(['key', 'prefix', 'all'] as const)(
  'keeps a replacement load alive when an old %s-invalidated load finishes',
  async (kind) => {
    const bounded = createTtlCache();
    const old = deferred<string>();
    const fresh = deferred<string>();
    const first = bounded.wrap('search:actor', 1000, () => old.promise);
    if (kind === 'key') bounded.invalidate('search:actor');
    else if (kind === 'prefix') bounded.clearPrefix('search:');
    else bounded.clearAll();
    const second = bounded.wrap('search:actor', 1000, () => fresh.promise);
    old.resolve('stale');
    expect(await first).toBe('stale');
    expect(bounded.get('search:actor')).toBeUndefined();
    expect(bounded.wrap('search:actor', 1000, async () => 'wrong')).toBe(second);
    fresh.resolve('current');
    await second;
    expect(bounded.get('search:actor')).toBe('current');
  },
);

it('honours synchronous invalidation inside a loader and explicit replacement values', async () => {
  const bounded = createTtlCache();
  await bounded.wrap('key', 1000, async () => {
    bounded.invalidate('key');
    return 'stale';
  });
  expect(bounded.get('key')).toBeUndefined();
  const old = deferred<string>();
  const first = bounded.wrap('key', 1000, () => old.promise);
  bounded.set('key', 'replacement', 1000);
  old.resolve('old');
  await first;
  expect(bounded.get('key')).toBe('replacement');
});

it('bounds pending bookkeeping while still serving overflow requests', async () => {
  const bounded = createTtlCache(1);
  const held = deferred<string>();
  const first = bounded.wrap('held', 1000, () => held.promise);
  expect(await bounded.wrap('overflow', 1000, async () => 'served')).toBe('served');
  expect(bounded.get('overflow')).toBeUndefined();
  held.resolve('ready');
  await first;
  expect(bounded.get('held')).toBe('ready');
});

it('does not cache invalid TTL values or retain synchronous loader failures', async () => {
  const bounded = createTtlCache();
  for (const ttl of [0, -1, NaN, Infinity]) {
    bounded.set('key', 'value', ttl);
    expect(bounded.get('key')).toBeUndefined();
  }
  await expect(
    bounded.wrap('key', 1000, () => {
      throw new Error('sync');
    }),
  ).rejects.toThrow('sync');
  expect(await bounded.wrap('key', 1000, async () => 'retry')).toBe('retry');
});
