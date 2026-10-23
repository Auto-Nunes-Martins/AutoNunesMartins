export interface DraftGuard {
  flush(): Promise<void>;
  discard(): Promise<void>;
  resume?(): void;
}
let active: DraftGuard | undefined;
export const activeDraftGuard = () => active;
export function registerDraftGuard(guard: DraftGuard) {
  active = guard;
  return () => { if (active === guard) active = undefined; };
}

const database = 'anm-vehicle-recovery';
async function openDatabase() {
  return await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(database, 1);
    request.onupgradeneeded = () => request.result.createObjectStore('drafts');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(Error('Armazenamento indisponível.'));
  });
}
async function transaction<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>) {
  const db = await openDatabase();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction('drafts', mode);
      const request = run(tx.objectStore('drafts'));
      tx.oncomplete = () => resolve(request.result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error ?? Error('Não foi possível guardar.'));
    });
  } finally { db.close(); }
}
export const draftStorage = {
  read: <T>(key: string) => transaction<T | undefined>('readonly', store => store.get(key)),
  write: <T>(key: string, data: T) => transaction('readwrite', store => store.put(data, key)),
  remove: (key: string) => transaction('readwrite', store => store.delete(key)),
};

export function draftFingerprint(value: unknown) {
  return JSON.stringify(value, (key, item) => {
    if (key === 'url' || key === 'variants') return undefined;
    if (typeof File !== 'undefined' && item instanceof File)
      return [item.name, item.type, item.size, item.lastModified];
    return item;
  });
}

/** Serial writes; an older write can never mark newer edits as protected. */
export function automaticDraft<T>(options: {
  capture: () => T;
  persist: (value: T) => Promise<unknown>;
  remove: () => Promise<unknown>;
  protected: () => void;
  state: (value: 'saving' | 'saved' | 'error') => void;
}) {
  let saved = draftFingerprint(options.capture());
  let timer: ReturnType<typeof setTimeout> | undefined;
  let running: Promise<void> | undefined;
  let stopped = false;
  async function flush() {
    clearTimeout(timer);
    if (stopped) return;
    if (running) { await running; return flush(); }
    const work = async () => {
      while (!stopped) {
        const value = options.capture();
        const fingerprint = draftFingerprint(value);
        if (fingerprint === saved) return;
        options.state('saving');
        await options.persist(value);
        saved = fingerprint;
        if (draftFingerprint(options.capture()) === saved) {
          options.protected();
          options.state('saved');
          return;
        }
      }
    };
    running = work().catch(error => { options.state('error'); throw error; });
    try { await running; } finally { running = undefined; }
  }
  function update() {
    if (stopped || draftFingerprint(options.capture()) === saved) return;
    options.state('saving');
    clearTimeout(timer);
    timer = setTimeout(() => { void flush().catch(() => {}); }, 350);
  }
  async function discard() {
    stopped = true;
    clearTimeout(timer);
    try { await running; } catch { /* deletion still follows the failed write */ }
    await options.remove();
  }
  async function abandon() {
    stopped = true;
    clearTimeout(timer);
    try { await running; } catch { /* Keep the last successfully stored recovery copy. */ }
  }
  return { flush, update, discard, abandon, resume() { stopped = false; }, dispose() { stopped = true; clearTimeout(timer); } };
}
