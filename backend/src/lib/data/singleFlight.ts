/** Share concurrent work only; settled results and permissions are never cached. */
export function singleFlight() {
  const pending = new Map<string, Promise<unknown>>();
  return async <T>(key: string, load: () => Promise<T>): Promise<T> => {
    const current = pending.get(key);
    if (current) return current as Promise<T>;
    const work = Promise.resolve().then(load);
    pending.set(key, work);
    try { return await work; }
    finally { if (pending.get(key) === work) pending.delete(key); }
  };
}

/** Bound best-effort profile backfills, including the normal absence of a photo. */
export function attemptWindow(ttlMs: number, limit = 256) {
  const attempts = new Map<string, number>();
  return (key: string) => {
    const now = Date.now();
    if ((attempts.get(key) ?? 0) > now) return false;
    for (const [key, until] of attempts) if (until <= now) attempts.delete(key);
    if (attempts.size >= limit) attempts.delete(attempts.keys().next().value!);
    attempts.set(key, now + ttlMs);
    return true;
  };
}
