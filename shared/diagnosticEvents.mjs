import { randomUUID } from 'node:crypto';

const key = Symbol.for('anm.diagnosticEvents');
function state() {
  return (globalThis[key] ??= {
    sequence: 0,
    queue: [],
    dropped: 0,
    send: undefined,
    consume: undefined,
    timer: undefined,
    busy: false,
  });
}
const uuid = (value) =>
  typeof value === 'string' && /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(value);
const enums = new Set([
  'configuration',
  'connection',
  'permission',
  'schema',
  'timeout',
  'database',
  '42501',
  '42883',
  '42P01',
  '57014',
  '55P03',
  '53300',
  '08001',
  '08006',
  '23502',
  '23505',
  '22023',
  'runtime_diagnostics',
  'application_memory',
  'backend',
  'crm',
  'website',
  'gateway',
  'supervisor',
  'harness',
  'backend:worker',
  'crm:worker',
  'website:worker',
  'gateway:worker',
  'boot',
  'baseline',
  'idle',
  'upload_start',
  'upload_phase',
  'upload_sample',
  'upload_end',
  'client_transfer',
  'admission_rejected',
  'shutdown',
  'shutdown_requested',
  'uncaught_exception',
  'child_error',
  'child_exit',
  'lookup',
  'receive',
  'metadata',
  'optimize',
  'sanitize',
  'storage',
  'derivatives',
  'variant_encode',
  'variant_storage',
  'dimensions',
  'finalize',
  'ok',
  'error',
  'aborted',
  'network_error',
  'SIGTERM',
  'SIGKILL',
  'SIGINT',
  'SIGABRT',
  'startup',
  'warmup',
  'activity',
  'post_activity',
  'not_determined',
  'cgroup',
  'v1',
  'v2',
  'cgroup_lifetime',
  'self',
  'ancestor',
  'finite',
  'unreadable',
  'unlimited_or_unrepresentable',
  'observed_visible_constraints_only',
  'unsupported_platform',
  'membership_unreadable',
  'memory_controller_unresolved',
  'usage_unreadable',
  'app_descendants_only',
  'registered_application_tree',
  'cooperative_node',
  'cooperative_main_isolate',
  'requires_cooperative_node_snapshot',
  'unavailable',
  'kernel_clock_ticks',
  'backend_only',
  'system_allocator_unknown',
  'smaps_unreadable',
]);
const textKeys = new Set([
  'lastFailureKind',
  'lastFailureSqlState',
  'event',
  'service',
  'kind',
  'phase',
  'nextPhase',
  'outcome',
  'signal',
  'child',
  'stage',
  'scope',
  'controller',
  'peakScope',
  'limitStatus',
  'limitScope',
  'headroomScope',
  'reason',
  'discovery',
  'sampleSource',
  'heapCoverage',
  'cpuUnit',
  'baselineNormality',
  'coverage',
  'httpCoverage',
  'allocator',
]);
const idKeys = new Set(['instance', 'boot', 'collectorBoot', 'trace', 'eventId']);
function clean(value, depth = 0, name = '') {
  if (depth > 7) return undefined;
  if (value === null || typeof value === 'boolean') return value;
  if (typeof value === 'number')
    return Number.isFinite(value) && Math.abs(value) <= Number.MAX_SAFE_INTEGER ? value : undefined;
  if (typeof value === 'string') {
    if (name === 'release' && /^[a-f0-9]{40}$/.test(value)) return value;
    if (idKeys.has(name) && uuid(value)) return value;
    if (
      (name === 'time' || name === 'nativeTime') &&
      /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value) &&
      Number.isFinite(Date.parse(value))
    )
      return value;
    if (name === 'identity' && /^\d{1,12}:(?:\d{1,18}|[a-f0-9-]{36}|unavailable)$/.test(value))
      return value;
    if ((textKeys.has(name) || name === 'missingSnapshots') && enums.has(value)) return value;
    return undefined;
  }
  if (Array.isArray(value))
    return value
      .slice(0, 64)
      .map((v) => clean(v, depth + 1, name))
      .filter((v) => v !== undefined);
  if (!value || typeof value !== 'object') return undefined;
  const result = {};
  for (const [k, v] of Object.entries(value).slice(0, 96)) {
    if (
      !/^[a-zA-Z][a-zA-Z0-9_]{0,47}$/.test(k) ||
      /^(?:__proto__|constructor|prototype|password|secret|token|authorization|cookie|email|plate|url|path|body|filename|buffer|pixels)$/i.test(
        k,
      )
    )
      continue;
    const safe = clean(v, depth + 1, k);
    if (safe !== undefined) result[k] = safe;
  }
  return result;
}
export function sanitizeDiagnostic(row) {
  if (
    !row ||
    !['runtime_diagnostics', 'application_memory'].includes(row.event) ||
    !uuid(row.instance)
  )
    return;
  const result = clean(row);
  if (!result || !uuid(result.boot ?? result.collectorBoot) || !result.time) return;
  if (JSON.stringify(result).length > 65536) return;
  return result;
}
export function diagnosticTransportStats() {
  const s = state();
  return {
    transportQueued: s.queue.length,
    transportDropped: s.dropped,
    transportInFlight: s.busy,
    transportRetries: s.retryCount ?? 0,
    transportConsecutiveFailures: s.failures ?? 0,
    transportLastFailureEpochMs: s.lastFailure ?? 0,
    transportOldestQueuedAgeMs: s.queue.length
      ? Math.max(0, Date.now() - Date.parse(s.queue[0].time))
      : 0,
  };
}
function schedule() {
  const s = state();
  if (s.timer || s.busy || !s.queue.length || (!s.consume && !s.send)) return;
  s.timer = setTimeout(() => {
    s.timer = undefined;
    void pump();
  }, 250);
  s.timer.unref?.();
}
async function pump() {
  const s = state();
  if (s.busy || !s.queue.length) return;
  s.busy = true;
  const rows = s.queue.splice(0, 32);
  try {
    if (s.consume) await s.consume(rows);
    else if (s.send)
      await new Promise((resolve, reject) =>
        s.send(rows, (error) => (error ? reject(error) : resolve())),
      );
    else {
      s.queue.unshift(...rows);
    }
    s.failures = 0;
  } catch {
    s.retryCount = (s.retryCount ?? 0) + 1;
    s.lastFailure = Date.now();
    s.failures = (s.failures ?? 0) + 1;
    const keep = rows.slice(0, Math.max(0, 256 - s.queue.length));
    s.queue.unshift(...keep);
    s.dropped += rows.length - keep.length;
    await new Promise((resolve) => {
      const timer = setTimeout(resolve, Math.min(30000, 250 * 2 ** Math.min(s.failures, 7)));
      timer.unref?.();
    });
  } finally {
    s.busy = false;
    schedule();
  }
}
export function acceptDiagnosticEvents(rows) {
  if (!Array.isArray(rows) || rows.length > 32) return false;
  const s = state();
  for (const row of rows) {
    const safe = sanitizeDiagnostic(row);
    if (!safe || !uuid(safe.eventId)) {
      s.dropped++;
      continue;
    }
    if (s.queue.length >= 256) {
      s.dropped++;
      continue;
    }
    s.queue.push(safe);
  }
  schedule();
  return true;
}
export function recordDiagnostic(row) {
  if (process.env.RUNTIME_DIAGNOSTICS !== 'true') return;
  const s = state(),
    safe = sanitizeDiagnostic({
      ...row,
      eventId: randomUUID(),
      processSequence: ++s.sequence,
      processTimeOriginEpochMs: performance.timeOrigin,
      producerMonotonicMs: performance.now(),
      wallClockDriftMs: Date.now() - performance.timeOrigin - performance.now(),
      transport: diagnosticTransportStats(),
    });
  if (!safe) {
    s.dropped++;
    return;
  }
  if (s.queue.length >= 256) {
    s.dropped++;
    return;
  }
  s.queue.push(safe);
  schedule();
}
export function setDiagnosticSender(send) {
  state().send = send;
  schedule();
}
export function setDiagnosticConsumer(consume) {
  state().consume = consume;
  schedule();
}
export async function flushDiagnosticEvents() {
  const s = state();
  if (s.timer) {
    clearTimeout(s.timer);
    s.timer = undefined;
  }
  const deadline = Date.now() + 2000;
  while (Date.now() < deadline && (s.queue.length || s.busy)) {
    if (!s.busy) void pump();
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}
