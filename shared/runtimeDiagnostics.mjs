import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';

const numericKeys = new Set([
  'inputBytes',
  'outputBytes',
  'originalBytes',
  'preparedBytes',
  'originalWidth',
  'originalHeight',
  'preparedWidth',
  'preparedHeight',
  'preparationMs',
  'queueMs',
  'transferMs',
  'width',
  'height',
  'variants',
  'status',
]);
const phases = new Set([
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
]);
const noopTrace = Object.freeze({ id: undefined, phase() {}, fields() {}, finish() {} });
const bounded = (value, fallback, min, max) =>
  Number.isFinite(Number(value)) ? Math.min(max, Math.max(min, Number(value))) : fallback;
export function safeMetrics(value) {
  const output = {};
  if (!value || typeof value !== 'object' || Array.isArray(value)) return output;
  for (const [key, n] of Object.entries(value))
    if (
      numericKeys.has(key) &&
      typeof n === 'number' &&
      Number.isFinite(n) &&
      n >= 0 &&
      n <= 100_000_000
    )
      output[key] = Math.round(n * 100) / 100;
  return output;
}
export function clientMetrics(header) {
  if (typeof header !== 'string' || header.length > 1024) return {};
  try {
    return safeMetrics(JSON.parse(header));
  } catch {
    return {};
  }
}
export function correlationId(value) {
  return typeof value === 'string' && /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(value)
    ? value
    : randomUUID();
}
function containerMemory() {
  for (const [usage, limit] of [
    ['/sys/fs/cgroup/memory.current', '/sys/fs/cgroup/memory.max'],
    ['/sys/fs/cgroup/memory/memory.usage_in_bytes', '/sys/fs/cgroup/memory/memory.limit_in_bytes'],
  ]) {
    try {
      const bytes = Number(readFileSync(usage, 'utf8').trim()),
        max = Number(readFileSync(limit, 'utf8').trim());
      return {
        containerBytes: Number.isFinite(bytes) ? bytes : undefined,
        containerLimitBytes:
          Number.isFinite(max) && max < Number.MAX_SAFE_INTEGER ? max : undefined,
      };
    } catch {}
  }
  return {};
}
function snapshot() {
  const memory = process.memoryUsage(),
    cpu = process.cpuUsage();
  return {
    atMs: performance.now(),
    uptimeMs: Math.round(process.uptime() * 1000),
    rss: memory.rss,
    heapUsed: memory.heapUsed,
    heapTotal: memory.heapTotal,
    external: memory.external,
    arrayBuffers: memory.arrayBuffers,
    cpuUserUs: cpu.user,
    cpuSystemUs: cpu.system,
  };
}
/** Only bounded numeric summaries are retained. No request, file, buffer or vehicle is retained. */
export class ProcessDiagnostics {
  constructor(options = {}) {
    const env = options.env ?? process.env;
    this.enabled = env.RUNTIME_DIAGNOSTICS === 'true';
    this.service = ['backend', 'website', 'crm', 'gateway', 'harness'].includes(options.service)
      ? options.service
      : 'backend';
    this.boot = randomUUID();
    this.instance = correlationId(env.RUNTIME_DIAGNOSTICS_INSTANCE);
    this.pid = process.pid;
    const readSample = options.sample ?? snapshot;
    this.sample = () => {
      try {
        return readSample();
      } catch {
        this.dropped = (this.dropped ?? 0) + 1;
        return {
          atMs: performance.now(),
          uptimeMs: Math.round(process.uptime() * 1000),
          rss: 0,
          heapUsed: 0,
          heapTotal: 0,
          external: 0,
          arrayBuffers: 0,
          cpuUserUs: 0,
          cpuSystemUs: 0,
        };
      }
    };
    this.sink =
      options.sink ??
      ((row) => {
        if (process.stdout.writableNeedDrain) return false;
        process.stdout.write(JSON.stringify(row) + '\n');
        return true;
      });
    this.interval = options.setInterval ?? setInterval;
    this.clearInterval = options.clearInterval ?? clearInterval;
    this.container = options.container ?? containerMemory;
    this.sampleMs = bounded(env.RUNTIME_DIAGNOSTICS_SAMPLE_MS, 250, 100, 2000);
    this.baselineMs = bounded(env.RUNTIME_DIAGNOSTICS_BASELINE_MS, 30000, 10000, 300000);
    this.idleMs = bounded(env.RUNTIME_DIAGNOSTICS_IDLE_MS, 30000, 5000, 120000);
    this.active = new Map();
    this.recent = new Map();
    this.sequence = 0;
    this.completed = 0;
    this.failed = 0;
    this.rejected = 0;
    this.dropped = 0;
    this.stopped = false;
    this.lastRejected = -Infinity;
    this.clientWindow = 0;
    this.clientCount = 0;
    if (this.enabled) {
      this.emit('boot', {}, true);
      this.baseline = this.interval(() => this.emit('baseline', {}, true), this.baselineMs);
      this.baseline.unref?.();
    }
  }
  emit(kind, fields = {}, includeContainer = false) {
    if (!this.enabled || this.stopped) return;
    try {
      const point = this.sample();
      const row = {
        event: 'runtime_diagnostics',
        version: 1,
        kind,
        time: new Date().toISOString(),
        service: this.service,
        instance: this.instance,
        boot: this.boot,
        pid: this.pid,
        ...point,
        ...(includeContainer ? this.container() : {}),
        active: this.active.size,
        uploadsStarted: this.sequence,
        uploadsCompleted: this.completed,
        uploadsFailed: this.failed,
        rejected: this.rejected,
        logsDropped: this.dropped,
        ...fields,
      };
      if (this.sink(row) === false) this.dropped++;
    } catch {
      this.dropped++;
    }
  }
  rejection() {
    if (!this.enabled || this.stopped) return;
    this.rejected++;
    const now = this.sample().atMs;
    if (now - this.lastRejected >= 5000) {
      this.lastRejected = now;
      this.emit('admission_rejected');
    }
  }
  begin(id, metrics = {}) {
    if (!this.enabled || this.stopped) return noopTrace;
    // Hard defensive bound independent of the upload admission implementation.
    if (this.active.size >= 32) {
      this.rejection();
      return noopTrace;
    }
    if (this.idle) {
      this.clearInterval(this.idle);
      this.idle = undefined;
    }
    const start = this.sample(),
      state = {
        id: correlationId(id),
        sequence: ++this.sequence,
        start: start.atMs,
        phase: 'lookup',
        phaseStart: start.atMs,
        peak: {
          rss: start.rss,
          heapUsed: start.heapUsed,
          external: start.external,
          arrayBuffers: start.arrayBuffers,
        },
        metrics: safeMetrics(metrics),
        samples: 0,
        lastLog: start.atMs,
      };
    const token = Symbol();
    this.active.set(token, state);
    this.emit('upload_start', { trace: state.id, upload: state.sequence, client: state.metrics });
    if (!this.sampler) {
      this.sampler = this.interval(() => this.tick(), this.sampleMs);
      this.sampler.unref?.();
    }
    const fields = (values) => {
      if (this.active.has(token)) Object.assign(state.metrics, safeMetrics(values));
    };
    const phase = (name, values = {}) => {
      if (!this.active.has(token) || !phases.has(name)) return;
      this.observe(state);
      const now = this.sample().atMs;
      this.emit('upload_phase', {
        trace: state.id,
        upload: state.sequence,
        phase: state.phase,
        nextPhase: name,
        phaseMs: Math.max(0, now - state.phaseStart),
        ...safeMetrics(values),
      });
      state.phase = name;
      state.phaseStart = now;
    };
    const finish = (outcome = 'error', values = {}) => {
      if (!this.active.has(token)) return;
      this.observe(state);
      const now = this.sample().atMs;
      this.active.delete(token);
      if (this.recent.size >= 256) this.recent.delete(this.recent.keys().next().value);
      this.recent.set(state.id, { until: now + 300000, upload: state.sequence });
      if (outcome === 'ok') this.completed++;
      else this.failed++;
      this.emit('upload_end', {
        trace: state.id,
        upload: state.sequence,
        outcome: ['ok', 'error', 'aborted'].includes(outcome) ? outcome : 'error',
        phase: state.phase,
        phaseMs: Math.max(0, now - state.phaseStart),
        durationMs: Math.max(0, now - state.start),
        peak: state.peak,
        samples: state.samples,
        metrics: state.metrics,
        ...safeMetrics(values),
      });
      if (!this.active.size) {
        this.clearInterval(this.sampler);
        this.sampler = undefined;
        this.idleUntil = now + this.idleMs;
        this.idle = this.interval(() => {
          this.emit('idle', {}, true);
          if (this.sample().atMs >= this.idleUntil) {
            this.clearInterval(this.idle);
            this.idle = undefined;
          }
        }, 5000);
        this.idle.unref?.();
      }
    };
    return { id: state.id, phase, fields, finish };
  }
  observe(state) {
    try {
      const sample = this.sample();
      state.samples++;
      for (const key of ['rss', 'heapUsed', 'external', 'arrayBuffers'])
        state.peak[key] = Math.max(state.peak[key], sample[key]);
      if (this.service === 'backend') {
        const current = this.container().containerBytes;
        if (Number.isFinite(current))
          state.peak.containerBytes = Math.max(state.peak.containerBytes ?? 0, current);
      }
      return sample;
    } catch {
      return undefined;
    }
  }
  tick() {
    for (const state of this.active.values()) {
      const sample = this.observe(state);
      if (!sample) continue;
      if (sample.atMs - state.lastLog >= 5000) {
        this.emit('upload_sample', {
          trace: state.id,
          upload: state.sequence,
          phase: state.phase,
          peak: { ...state.peak },
          samples: state.samples,
        });
        state.lastLog = sample.atMs;
      }
    }
  }
  clientTransfer(id, metrics, outcome) {
    if (!this.enabled || this.stopped) return false;
    const now = this.sample().atMs,
      known = this.recent.get(id);
    if (!known || known.until < now) return false;
    if (now - this.clientWindow >= 60000) {
      this.clientWindow = now;
      this.clientCount = 0;
    }
    if (this.clientCount >= 120) return false;
    this.clientCount++;
    this.recent.delete(id);
    this.emit('client_transfer', {
      trace: id,
      upload: known.upload,
      ...safeMetrics(metrics),
      outcome: ['ok', 'error', 'network_error'].includes(outcome) ? outcome : 'error',
    });
    return true;
  }
  marker(kind, fields = {}, context = {}) {
    if (
      [
        'shutdown',
        'shutdown_requested',
        'uncaught_exception',
        'child_exit',
        'child_error',
      ].includes(kind)
    )
      this.emit(
        kind,
        {
          ...safeMetrics(fields),
          ...(['backend', 'website', 'crm'].includes(context.child)
            ? { child: context.child }
            : {}),
          ...(['SIGTERM', 'SIGKILL', 'SIGABRT', 'SIGINT'].includes(context.signal)
            ? { signal: context.signal }
            : {}),
        },
        true,
      );
  }
  stop() {
    if (this.stopped) return;
    this.marker('shutdown');
    this.stopped = true;
    for (const timer of [this.baseline, this.sampler, this.idle])
      if (timer) this.clearInterval(timer);
    this.baseline = this.sampler = this.idle = undefined;
    this.active.clear();
    this.recent.clear();
  }
}
const singleton = Symbol.for('anm.runtimeDiagnostics');
export function getProcessDiagnostics(
  service = process.env.RUNTIME_DIAGNOSTICS_SERVICE ?? 'backend',
) {
  const diagnostics = (globalThis[singleton] ??= new ProcessDiagnostics({ service }));
  const monitor = Symbol.for('anm.runtimeDiagnostics.monitor');
  if (diagnostics.enabled && !globalThis[monitor]) {
    globalThis[monitor] = true;
    process.once('exit', () => diagnostics.stop());
    process.on('uncaughtExceptionMonitor', () => diagnostics.marker('uncaught_exception'));
  }
  return diagnostics;
}
