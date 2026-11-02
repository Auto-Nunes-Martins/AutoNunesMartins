interface Entry<T> {
  value: T;
  expiresAt: number;
}

interface Pending<T> {
  promise: Promise<T>;
  revision: number;
}

export interface TtlCache {
  get<T>(key: string): T | undefined;
  set<T>(key: string, value: T, ttlMs: number): void;
  /** Shares concurrent loads for a key until it is invalidated or settles. */
  wrap<T>(key: string, ttlMs: number, loader: () => Promise<T>): Promise<T>;
  invalidate(key: string): void;
  /** Invalidate all keys with this prefix (use for namespaced groups). */
  clearPrefix(prefix: string): void;
  clearAll(): void;
}

/**
 * Bounded LRU cache for reads that tolerate a short TTL. Expired entries are
 * swept on writes and at most once a second on reads, without a background timer.
 * The entry limit also bounds idle retention; it is not a byte-size guarantee.
 */
export function createTtlCache(maxEntries = 512): TtlCache {
  if (!Number.isSafeInteger(maxEntries) || maxEntries < 1) {
    throw new RangeError('Cache entry limit must be a positive integer.');
  }
  const store = new Map<string, Entry<unknown>>();
  const pending = new Map<string, Pending<unknown>>();
  // Preserve the existing conservative invalidation of pre-mutation reads.
  let revision = 0;
  let lastSweep = 0;

  function sweep(now: number) {
    for (const [key, entry] of store) {
      if (entry.expiresAt <= now) store.delete(key);
    }
    lastSweep = now;
  }

  function storeValue<T>(key: string, value: T, ttlMs: number) {
    const now = Date.now();
    sweep(now);
    store.delete(key);
    if (!Number.isFinite(ttlMs) || ttlMs <= 0) return;
    store.set(key, { value, expiresAt: now + ttlMs });
    while (store.size > maxEntries) store.delete(store.keys().next().value!);
  }

  const result: TtlCache = {
    get<T>(key: string): T | undefined {
      const now = Date.now();
      if (now - lastSweep >= 1000) sweep(now);
      const entry = store.get(key);
      if (!entry) return undefined;
      if (entry.expiresAt <= now) {
        store.delete(key);
        return undefined;
      }
      store.delete(key);
      store.set(key, entry);
      return entry.value as T;
    },

    set<T>(key: string, value: T, ttlMs: number): void {
      pending.delete(key);
      storeValue(key, value, ttlMs);
    },

    wrap<T>(key: string, ttlMs: number, loader: () => Promise<T>): Promise<T> {
      const hit = result.get<T>(key);
      if (hit !== undefined) return Promise.resolve(hit);
      const existing = pending.get(key);
      if (existing?.revision === revision) return existing.promise as Promise<T>;

      // Do not build an unbounded registry during a burst of distinct slow reads.
      // Overflow still serves the request, without retaining its load or result.
      if (!existing && pending.size >= maxEntries) {
        try {
          return Promise.resolve(loader());
        } catch (error) {
          return Promise.reject(error);
        }
      }

      let resolve!: (value: T) => void;
      let reject!: (reason: unknown) => void;
      const flight: Pending<T> = {
        revision,
        promise: new Promise<T>((done, fail) => {
          resolve = done;
          reject = fail;
        }),
      };
      // Register before invoking loader: synchronous invalidation must win too.
      pending.set(key, flight);
      void (async () => {
        try {
          const value = await loader();
          if (flight.revision === revision && pending.get(key) === flight) {
            storeValue(key, value, ttlMs);
          }
          resolve(value);
        } catch (error) {
          reject(error);
        } finally {
          if (pending.get(key) === flight) pending.delete(key);
        }
      })();
      return flight.promise;
    },

    invalidate(key: string): void {
      revision++;
      store.delete(key);
      pending.delete(key);
    },

    clearPrefix(prefix: string): void {
      revision++;
      for (const key of store.keys()) if (key.startsWith(prefix)) store.delete(key);
      for (const key of pending.keys()) if (key.startsWith(prefix)) pending.delete(key);
    },

    clearAll(): void {
      revision++;
      store.clear();
      pending.clear();
    },
  };
  return result;
}

export const cache = createTtlCache();
