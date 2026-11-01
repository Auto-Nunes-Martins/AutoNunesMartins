import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { registerDiagnosticProvider } from '../../../../shared/nativeDiagnostics.mjs';

const fields = [
  'available',
  'reasonCode',
  'arenaCount',
  'arenaSystemBytes',
  'arenaFreeFastBytes',
  'arenaFreeRestBytes',
  'arenaNonFreeBytes',
  'mmapBytes',
  'mmapCount',
  'xmlBytes',
  'outputLimitBytes',
] as const;
type NativeStats = Record<(typeof fields)[number], number>;
type Binding = { snapshot: () => unknown };
const interval = 30_000;
const budget = 25;
const unavailable = (reasonCode: number): NativeStats => ({
  available: 0,
  reasonCode,
  arenaCount: 0,
  arenaSystemBytes: 0,
  arenaFreeFastBytes: 0,
  arenaFreeRestBytes: 0,
  arenaNonFreeBytes: 0,
  mmapBytes: 0,
  mmapCount: 0,
  xmlBytes: 0,
  outputLimitBytes: 65536,
});
function validate(value: unknown): NativeStats | undefined {
  if (!value || typeof value !== 'object') return;
  const row = value as Record<string, unknown>;
  if (!fields.every((key) => Number.isSafeInteger(row[key]) && (row[key] as number) >= 0)) return;
  const safe = Object.fromEntries(fields.map((key) => [key, row[key]])) as NativeStats;
  if (
    safe.available > 1 ||
    safe.reasonCode > 9 ||
    safe.outputLimitBytes !== 65536 ||
    safe.xmlBytes >= 65536
  )
    return;
  if (!safe.available && !safe.reasonCode) return;
  if (
    safe.available &&
    (safe.reasonCode !== 0 ||
      !safe.arenaCount ||
      safe.arenaFreeFastBytes > safe.arenaSystemBytes ||
      safe.arenaFreeRestBytes > safe.arenaSystemBytes - safe.arenaFreeFastBytes ||
      safe.arenaNonFreeBytes !==
        safe.arenaSystemBytes - safe.arenaFreeFastBytes - safe.arenaFreeRestBytes)
  )
    return;
  return safe;
}

/** No timer or history. The synchronous first native call cannot be hard-timed-out.
 * Its duration is observed; a slow call stops future probes for this process boot.
 */
export function createAllocatorDiagnostics(options: {
  enabled: () => boolean;
  platform: string;
  load: () => Binding;
  clock?: () => number;
  alternateAllocator?: () => boolean;
}) {
  const clock = options.clock ?? (() => performance.now());
  let binding: Binding | undefined,
    attempted = false,
    stopped = false;
  let cached = unavailable(8),
    at: number | undefined,
    samples = 0,
    probeMs = 0,
    probeMaxMs = 0;
  const result = (time: number) => ({
    ...cached,
    sampleAgeMs:
      at === undefined || !Number.isFinite(time - at)
        ? 0
        : Math.min(Number.MAX_SAFE_INTEGER, Math.max(0, time - at)),
    samples,
    probeMs,
    probeMaxMs,
    circuitOpen: stopped ? 1 : 0,
  });
  return {
    snapshot() {
      if (!options.enabled())
        return {
          ...unavailable(8),
          sampleAgeMs: 0,
          samples: 0,
          probeMs: 0,
          probeMaxMs: 0,
          circuitOpen: 0,
        };
      if (options.platform !== 'linux')
        return {
          ...unavailable(1),
          sampleAgeMs: 0,
          samples: 0,
          probeMs: 0,
          probeMaxMs: 0,
          circuitOpen: 0,
        };
      const now = clock();
      if (!attempted) {
        attempted = true;
        at = now;
        try {
          if (options.alternateAllocator?.()) {
            cached = unavailable(9);
            return result(now);
          }
          binding = options.load();
          if (!binding || typeof binding.snapshot !== 'function') {
            binding = undefined;
            cached = unavailable(6);
          }
        } catch {
          cached = unavailable(2);
        }
      }
      if (!binding) return result(now);
      if (samples && at !== undefined && now - at < interval) return result(now);
      if (stopped) {
        cached = { ...cached, available: 0, reasonCode: 7 };
        return result(now);
      }
      const begin = clock();
      at = begin;
      try {
        cached = validate(binding.snapshot()) ?? unavailable(6);
      } catch {
        cached = unavailable(3);
      }
      const elapsed = clock() - begin;
      probeMs = Number.isFinite(elapsed)
        ? Math.min(Number.MAX_SAFE_INTEGER, Math.max(0, elapsed))
        : 0;
      probeMaxMs = Math.max(probeMaxMs, probeMs);
      samples = Math.min(Number.MAX_SAFE_INTEGER, samples + 1);
      if (probeMs > budget) stopped = true;
      return result(clock());
    },
  };
}

export const allocatorDiagnostics = createAllocatorDiagnostics({
  enabled: () => process.env.RUNTIME_DIAGNOSTICS === 'true',
  platform: process.platform,
  // Detect the normal preloaded alternatives without loading the native addon.
  // Other libraries' direct mmap/private allocators remain outside this glibc-only view.
  alternateAllocator: () => /jemalloc|mimalloc/i.test(process.env.LD_PRELOAD ?? ''),
  load: () =>
    createRequire(import.meta.url)(
      fileURLToPath(new URL('../../native/allocator.node', import.meta.url)),
    ),
});
if (process.env.RUNTIME_DIAGNOSTICS === 'true')
  registerDiagnosticProvider('allocator', () => allocatorDiagnostics.snapshot());
