/** Reuse a result only after reading its current database revision. TTL bounds memory, not freshness. */
export function validatedReadCache(readRevision: () => Promise<string | null>, ttlMs = 60_000, limit = 64) {
  const entries = new Map<string, { revision: string; until: number; value: Promise<unknown> }>();
  return {
    async read<T>(key: string, load: () => Promise<T>): Promise<T> {
      // A failed version check must never fall back to an old result.
      const revision = await readRevision().catch(() => null);
      if (!revision) return load();
      const cached = entries.get(key);
      if (cached?.revision === revision && cached.until > Date.now()) return cached.value as Promise<T>;
      const entry = { revision, until: Date.now() + ttlMs, value: Promise.resolve().then(load) };
      entries.set(key, entry);
      for (const [key, value] of entries) if (value.until <= Date.now()) entries.delete(key);
      while (entries.size > limit) entries.delete(entries.keys().next().value!);
      try { return await entry.value; }
      catch (error) { if (entries.get(key) === entry) entries.delete(key); throw error; }
    },
  };
}
