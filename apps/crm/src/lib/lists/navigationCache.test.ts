import { describe, expect, it, vi } from 'vitest';
import { get } from 'svelte/store';
import { createNavigationCache } from './navigationCache';

interface List { items: string[]; _error?: string; _status?: number }
const failure = (status: number): List => ({ items: [], _status: status, _error: 'Falha' });
const result = (name: string): List => ({ items: [name] });
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}

describe('in-memory list navigation', () => {
  it('shows a skeleton on first visit, cached rows synchronously on revisit, then replaces them', async () => {
    const cache = createNavigationCache(); cache.scope('user-a:ADMIN');
    const first = cache.request('vehicles:page1', async () => result('old'), failure);
    expect(get(first.view)).toMatchObject({ value: undefined, updating: true, stale: false });
    await first.promise;
    const pending = deferred<List>();
    const next = cache.request('vehicles:page1', () => pending.promise, failure);
    expect(get(next.view)).toMatchObject({ value: result('old'), updating: true, stale: true });
    pending.resolve(result('new')); await next.promise;
    expect(get(next.view)).toMatchObject({ value: result('new'), updating: false, stale: false });
  });
  it('keeps cached rows and their original timestamp on a failed update, then supports retry', async () => {
    const cache = createNavigationCache();
    const seed = cache.request('sales', async () => result('saved'), failure); await seed.promise;
    const at = get(seed.view).updatedAt;
    const offline = cache.request('sales', async () => { throw Error('offline'); }, failure); await offline.promise;
    expect(get(offline.view)).toMatchObject({ value: result('saved'), updatedAt: at, stale: true, updating: false, error: 'Falha' });
    const retry = cache.request('sales', async () => result('current'), failure); await retry.promise;
    expect(get(retry.view)).toMatchObject({ value: result('current'), stale: false });
    expect(get(retry.view).error).toBeUndefined();
  });
  it('isolates complete filter/page/order keys, including cached empty lists', async () => {
    const cache = createNavigationCache();
    await cache.request<List>('vehicles:q=a&page=1&sort=asc', async () => ({ items: [] }), failure).promise;
    const hit = cache.request('vehicles:q=a&page=1&sort=asc', () => new Promise<List>(() => {}), failure);
    expect(get(hit.view).value?.items).toEqual([]);
    for (const key of ['vehicles:q=b&page=1&sort=asc', 'vehicles:q=a&page=2&sort=asc', 'vehicles:q=a&page=1&sort=desc', 'sales:q=a&page=1&sort=asc']) {
      expect(get(cache.request(key, () => new Promise<List>(() => {}), failure).view).value).toBeUndefined();
    }
  });
  it('prevents slower earlier responses from replacing a newer cached response', async () => {
    const cache = createNavigationCache(), slow = deferred<List>();
    const old = cache.request('vehicles', () => slow.promise, failure);
    await cache.request('vehicles', async () => result('latest'), failure).promise;
    slow.resolve(result('earlier')); await old.promise;
    expect(get(cache.request('vehicles', () => new Promise<List>(() => {}), failure).view).value).toEqual(result('latest'));
  });
  it.each([401, 403])('removes cached/private rows on access rejection %s', async status => {
    const cache = createNavigationCache();
    await cache.request('customers', async () => result('private'), failure).promise;
    const read = cache.request('customers', async () => failure(status), failure);
    await read.promise;
    expect(get(read.view)).toMatchObject({ value: failure(status), stale: false, error: 'Falha' });
    expect(get(cache.request('customers', () => new Promise<List>(() => {}), failure).view).value).toBeUndefined();
  });
  it('clears on identity/permission switch and discards pending previous-generation reads', async () => {
    const cache = createNavigationCache(); cache.scope('a:ADMIN');
    await cache.request('vehicles', async () => result('private'), failure).promise;
    const slow = deferred<List>();
    const pending = cache.request('vehicles', () => slow.promise, failure);
    const unsubscribe = pending.view.subscribe(() => {});
    cache.scope('b:ADMIN');
    expect(get(pending.view).value?.items).toEqual([]);
    slow.resolve(result('old-account')); await pending.promise;
    expect(get(cache.request('vehicles', () => new Promise<List>(() => {}), failure).view).value).toBeUndefined();
    cache.scope('b:OTHER');
    unsubscribe();
  });
  it('invalidates before mutation redirects and never resurrects a pre-mutation response', async () => {
    const cache = createNavigationCache(), pending = deferred<List>();
    await cache.request('vehicles', async () => result('available'), failure).promise;
    const read = cache.request('vehicles', () => pending.promise, failure);
    cache.clear();
    pending.resolve(result('available')); await read.promise;
    const next = cache.request('vehicles', () => new Promise<List>(() => {}), failure);
    expect(get(next.view).value).toBeUndefined();
  });
  it('bounds entry count and age without persisting data', async () => {
    vi.useFakeTimers();
    try {
      const cache = createNavigationCache(1, 1000);
      await cache.request('a', async () => result('a'), failure).promise;
      await cache.request('b', async () => result('b'), failure).promise;
      expect(get(cache.request('a', () => new Promise<List>(() => {}), failure).view).value).toBeUndefined();
      vi.advanceTimersByTime(1001);
      expect(get(cache.request('b', () => new Promise<List>(() => {}), failure).view).value).toBeUndefined();
    } finally { vi.useRealTimers(); }
  });
  it('does not share data between isolated SSR request instances', async () => {
    const first = createNavigationCache();
    await first.request('customers', async () => result('private'), failure).promise;
    expect(get(createNavigationCache().request('customers', () => new Promise<List>(() => {}), failure).view).value).toBeUndefined();
  });
});
