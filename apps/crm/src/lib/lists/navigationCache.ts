import { writable, type Readable } from 'svelte/store';

export interface ListFailure { _error?: string; _status?: number }
export interface ListView<T> {
  value?: T;
  updating: boolean;
  stale: boolean;
  error?: string;
  updatedAt?: number;
}

/** A tab-local, bounded cache. No storage, permission TTL or shared SSR state. */
export function createNavigationCache(limit = 30, maxAge = 30 * 60_000) {
  let identity: string | null = null;
  let generation = 0;
  let sequence = 0;
  const entries = new Map<string, { value: unknown; at: number }>();
  const latest = new Map<string, number>();
  const observers = new Set<(status: number) => void>();

  function clear(status = 503) {
    generation++;
    entries.clear();
    latest.clear();
    for (const reset of observers) reset(status);
  }
  function scope(next: string | null) {
    if (next !== identity) { clear(); identity = next; }
  }
  function request<T extends ListFailure>(key: string, work: () => Promise<T>, failure: (status: number) => T,
    remember = true) {
    const epoch = generation;
    const id = ++sequence;
    latest.set(key, id);
    const saved = remember ? entries.get(key) : undefined;
    const cached = saved && Date.now() - saved.at < maxAge ? saved : undefined;
    const initial: ListView<T> = {
      value: cached?.value as T | undefined, updatedAt: cached?.at,
      updating: true, stale: Boolean(cached),
    };
    let state = initial;
    const store = writable(state);
    const publish = (value: ListView<T>) => { state = value; store.set(value); };
    // Only mounted subscribers are retained; abandoned/preloaded requests cannot leak views.
    const reset = (status: number) => {
      const value = failure(status);
      publish({ value, updating: false, stale: false, error: value._error });
    };
    let subscribers = 0;
    const view: Readable<ListView<T>> = {
      subscribe(run, invalidate) {
        if (++subscribers === 1) observers.add(reset);
        const unsubscribe = store.subscribe(run, invalidate);
        return () => { unsubscribe(); if (--subscribers === 0) observers.delete(reset); };
      },
    };
    const promise = Promise.resolve().then(work).catch(() => failure(503)).then(result => {
      if (epoch !== generation) {
        // A mutation/logout may finish while this read is pending. Never revive its data.
        const discarded = failure(503);
        publish({ value: discarded, updating: false, stale: false, error: discarded._error });
        return discarded;
      }
      if (result._status === 401 || result._status === 403) {
        clear(result._status);
        publish({ value: result, updating: false, stale: false, error: result._error });
      } else if (result._error) {
        publish({ ...state, value: cached ? state.value : result, updating: false,
          stale: Boolean(cached), error: result._error });
      } else {
        const at = Date.now();
        if (remember && latest.get(key) === id) {
          entries.delete(key);
          entries.set(key, { value: result, at });
          while (entries.size > limit) entries.delete(entries.keys().next().value!);
        }
        publish({ value: result, updatedAt: at, updating: false, stale: false });
      }
      if (latest.get(key) === id) latest.delete(key);
      return result;
    });
    return { view, promise };
  }
  return { request, scope, clear };
}

// Used exclusively by browser loads/session lifecycle. SSR creates an isolated instance.
export const listNavigationCache = createNavigationCache();
