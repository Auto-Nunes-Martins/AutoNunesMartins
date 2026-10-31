import { readFileSync } from 'node:fs';
import { getHeapStatistics } from 'node:v8';
const key = Symbol.for('anm.nativeDiagnostics');
function state() {
  return (globalThis[key] ??= { providers: new Map(), at: 0, value: {}, allocator: undefined });
}
export function registerDiagnosticProvider(name, provider) {
  const s = state();
  if (/^[a-z]{1,24}$/.test(name) && (s.providers.has(name) || s.providers.size < 8)) {
    s.providers.set(name, provider);
    s.at = 0;
  }
}
export function nativeDiagnosticSnapshot() {
  const s = state(),
    now = Date.now();
  if (now - s.at < 1000) return { ...s.value, nativeAgeMs: now - s.at };
  s.at = now;
  const heap = getHeapStatistics();
  let native = {
    nodeVersion: process.versions.node.split('.').map(Number),
    nativeSampledAtEpochMs: now,
    nativeAgeMs: 0,
    nodeMajor: Number(process.versions.node.split('.')[0]),
    v8TotalPhysicalBytes: heap.total_physical_size,
    v8MallocedBytes: heap.malloced_memory,
    v8PeakMallocedBytes: heap.peak_malloced_memory,
    v8HeapLimitBytes: heap.heap_size_limit,
  };
  if (/^[a-f0-9]{40}$/.test(process.env.RENDER_GIT_COMMIT ?? ''))
    native.release = process.env.RENDER_GIT_COMMIT;
  if (process.platform === 'linux') {
    try {
      const text = readFileSync('/proc/self/smaps_rollup', 'utf8');
      for (const [label, name] of [
        ['Rss', 'smapsRssBytes'],
        ['Pss', 'smapsPssBytes'],
        ['Pss_Anon', 'smapsPssAnonBytes'],
        ['Pss_File', 'smapsPssFileBytes'],
        ['Pss_Shmem', 'smapsPssSharedBytes'],
        ['Private_Clean', 'smapsPrivateCleanBytes'],
        ['Private_Dirty', 'smapsPrivateDirtyBytes'],
        ['Anonymous', 'smapsAnonBytes'],
        ['LazyFree', 'smapsLazyFreeBytes'],
        ['Swap', 'smapsSwapBytes'],
      ]) {
        const n = text.match(new RegExp('^' + label + ':\\s+(\\d+) kB$', 'm'));
        if (n) native[name] = Number(n[1]) * 1024;
      }
      native.smapsAvailable = true;
    } catch {
      native.smapsAvailable = false;
    }
    if (!s.allocator) {
      try {
        const maps = readFileSync('/proc/self/maps', 'utf8');
        s.allocator = {
          glibcMapped: /\/libc\.so/.test(maps),
          jemallocMapped: /\/libjemalloc\.so/.test(maps),
          mimallocMapped: /\/libmimalloc/.test(maps),
        };
      } catch {
        s.allocator = { allocatorMapsAvailable: false };
      }
    }
    Object.assign(native, s.allocator);
    try {
      const threads = readFileSync('/proc/self/status', 'utf8').match(/^Threads:\s+(\d+)$/m);
      native.nativeThreads = threads ? Number(threads[1]) : null;
    } catch {
      native.nativeThreads = null;
    }
  } else native.smapsAvailable = false;
  const arena = Number(process.env.MALLOC_ARENA_MAX);
  native.mallocArenaMaxConfigured = Number.isSafeInteger(arena) && arena > 0 ? arena : null;
  for (const [name, provider] of s.providers) {
    try {
      native[name] = provider();
    } catch {
      native[name] = { available: false };
    }
  }
  s.value = native;
  return native;
}
