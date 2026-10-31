import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { createCgroupReader } from './containerMemory.mjs';
import { recordDiagnostic } from './diagnosticEvents.mjs';

const roles = new Set(['gateway', 'supervisor', 'backend', 'crm', 'website']);
const metrics = [
  'rss',
  'heapUsed',
  'heapTotal',
  'external',
  'arrayBuffers',
  'cpuUserUs',
  'cpuSystemUs',
  'uptimeMs',
  'active',
  'uploadsStarted',
  'uploadsCompleted',
  'uploadsFailed',
  'sampledAtEpochMs',
];
const uuid = (value) => typeof value === 'string' && /^[a-f0-9-]{36}$/i.test(value);
export function safeProcessSnapshot(value, pid, service) {
  if (!value || value.pid !== pid || value.service !== service || !uuid(value.boot)) return null;
  const result = { pid, service, boot: value.boot };
  function numericTree(value, depth = 0) {
    if (depth > 5) return;
    if (value === null || typeof value === 'boolean') return value;
    if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
    if (Array.isArray(value)) return value.slice(0, 32).map((v) => numericTree(v, depth + 1));
    if (value && typeof value === 'object') {
      const out = {};
      for (const [k, v] of Object.entries(value).slice(0, 64)) {
        if (!/^[a-zA-Z][a-zA-Z0-9_]{0,47}$/.test(k)) continue;
        const safe = numericTree(v, depth + 1);
        if (safe !== undefined) out[k] = safe;
      }
      return out;
    }
  }
  if (value.native && typeof value.native === 'object') result.native = numericTree(value.native);
  for (const key of metrics)
    if (typeof value[key] === 'number' && Number.isFinite(value[key]) && value[key] >= 0)
      result[key] = value[key];
  return Number.isFinite(result.rss) && Number.isFinite(result.sampledAtEpochMs) ? result : null;
}
/** A single IPC listener/pending request per registered application child. No public endpoint. */
export function snapshotChannel(child, service, { timeoutMs = 750 } = {}) {
  let pending,
    sending = false,
    stopped = false;
  const finish = (value) => {
    if (!pending) return;
    clearTimeout(pending.timer);
    const resolve = pending.resolve;
    pending = undefined;
    resolve(value);
  };
  const listener = (message) => {
    if (message?.type !== 'anm:memory:snapshot' || message.collection !== pending?.id) return;
    finish(safeProcessSnapshot(message.snapshot, child.pid, service));
  };
  const exited = () => {
    sending = false;
    finish(null);
  };
  child.on('message', listener);
  child.on('exit', exited);
  return {
    request(id) {
      if (pending || sending || stopped) return Promise.resolve(null);
      return new Promise((resolve) => {
        const timer = setTimeout(() => finish(null), timeoutMs);
        timer.unref?.();
        pending = { id, resolve, timer };
        try {
          if (!child.connected) {
            finish(null);
            return;
          }
          sending = true;
          child.send({ type: 'anm:memory:sample', collection: id }, (error) => {
            sending = false;
            if (error && pending?.id === id) finish(null);
          });
        } catch {
          sending = false;
          finish(null);
        }
      });
    },
    stop() {
      stopped = true;
      finish(null);
      child.off('message', listener);
      child.off('exit', exited);
    },
  };
}
function procStat(text) {
  const close = text.lastIndexOf(')');
  if (close < 0) return null;
  const fields = text
    .slice(close + 2)
    .trim()
    .split(/\s+/);
  const startTicks = Number(fields[19]),
    user = Number(fields[11]),
    system = Number(fields[12]);
  return [startTicks, user, system].every((n) => Number.isSafeInteger(n) && n >= 0)
    ? { startTicks, cpuUserTicks: user, cpuSystemTicks: system, cpuUnit: 'kernel_clock_ticks' }
    : null;
}
/** Traverse only a supplied app root's descendants via children files; never lists /proc globally. */
export function appProcessTree(
  rootPid,
  seeds,
  {
    platform = process.platform,
    read = (file) => readFileSync(file, 'utf8'),
    maxProcesses = 64,
    maxDepth = 8,
  } = {},
) {
  if (platform !== 'linux')
    return { processes: [], discovery: 'unsupported_platform', limited: false, unreadable: 0 };
  const text = (file) => {
    try {
      const value = read(file);
      return typeof value === 'string' && value.length < 65536 ? value : null;
    } catch {
      return null;
    }
  };
  const queue = [{ pid: rootPid, service: seeds.get(rootPid) ?? 'gateway', depth: 0 }],
    seen = new Set(),
    result = [];
  let unreadable = 0,
    limited = false;
  while (queue.length && seen.size < Math.min(64, maxProcesses)) {
    const item = queue.shift();
    if (seen.has(item.pid) || !Number.isSafeInteger(item.pid) || item.pid < 1) continue;
    seen.add(item.pid);
    const statText = text(`/proc/${item.pid}/stat`),
      stat = statText && procStat(statText),
      status = text(`/proc/${item.pid}/status`);
    const rss = status?.match(/^VmRSS:\s+(\d+)\s+kB$/m);
    if (stat)
      result.push({
        pid: item.pid,
        service: item.service,
        identity: `${item.pid}:${stat.startTicks}`,
        ...stat,
        rss: rss ? Number(rss[1]) * 1024 : null,
        heapUsed: null,
        heapCoverage: 'requires_cooperative_node_snapshot',
      });
    else unreadable++;
    const children = text(`/proc/${item.pid}/task/${item.pid}/children`);
    if (children === null) {
      unreadable++;
      continue;
    }
    const pids = children
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map(Number)
      .filter((pid) => Number.isSafeInteger(pid) && pid > 0);
    if (item.depth >= Math.min(8, maxDepth)) {
      if (pids.length) limited = true;
      continue;
    }
    const remaining = Math.max(0, Math.min(64, maxProcesses) - seen.size - queue.length);
    for (const pid of pids.slice(0, remaining))
      queue.push({
        pid,
        service: seeds.get(pid) ?? `${item.service.split(':')[0]}:worker`,
        depth: item.depth + 1,
      });
    if (pids.length > remaining) limited = true;
  }
  if (queue.length) limited = true;
  return { processes: result, discovery: 'app_descendants_only', limited, unreadable };
}
export class ApplicationMemoryMonitor {
  constructor({
    diagnostics,
    env = process.env,
    platform = process.platform,
    read,
    container,
    sink,
    interval = setInterval,
    clear = clearInterval,
    now = Date.now,
  } = {}) {
    this.diagnostics = diagnostics;
    this.enabled = diagnostics.enabled;
    this.platform = platform;
    this.read = read;
    this.container = container ?? createCgroupReader({ platform, read });
    this.sink =
      sink ??
      ((row) => {
        recordDiagnostic(row);
        if (process.stdout.writableNeedDrain) return false;
        process.stdout.write(JSON.stringify(row) + '\n');
        return true;
      });
    this.interval = interval;
    this.clear = clear;
    this.now = now;
    this.children = new Map();
    this.previous = new Map();
    this.trends = new Map();
    this.readyAt = null;
    this.lastActivity = null;
    this.sequence = 0;
    this.dropped = 0;
    this.skipped = 0;
    this.stopped = false;
    this.busy = false;
    const requested = Number(env.RUNTIME_DIAGNOSTICS_BASELINE_MS);
    this.period = Number.isFinite(requested) ? Math.max(10000, Math.min(300000, requested)) : 30000;
    if (this.enabled) {
      this.timer = this.interval(() => void this.collect(), this.period);
      this.timer.unref?.();
    }
  }
  register(service, child) {
    if (
      !this.enabled ||
      !roles.has(service) ||
      this.children.size >= 8 ||
      !Number.isSafeInteger(child.pid)
    )
      return;
    this.children.get(service)?.channel.stop();
    this.children.set(service, { child, channel: snapshotChannel(child, service) });
  }
  ready() {
    this.readyAt = this.now();
  }
  async collect() {
    if (!this.enabled || this.stopped) return;
    if (this.busy) {
      this.skipped++;
      return;
    }
    this.busy = true;
    const requestedAt = this.now(),
      collection = randomUUID();
    try {
      const local = this.diagnostics.capture(),
        seeds = new Map([[local.pid, local.service]]);
      for (const [service, { child }] of this.children) seeds.set(child.pid, service);
      const responses = await Promise.all(
        [...this.children].map(async ([service, { child, channel }]) => ({
          service,
          pid: child.pid,
          snapshot: await channel.request(collection),
        })),
      );
      if (this.stopped) return;
      const tree = appProcessTree(local.pid, seeds, { platform: this.platform, read: this.read }),
        cooperative = [local, ...responses.flatMap((row) => (row.snapshot ? [row.snapshot] : []))];
      const processMap = new Map(tree.processes.map((row) => [row.pid, row]));
      for (const snapshot of cooperative) {
        const proc = processMap.get(snapshot.pid);
        processMap.set(snapshot.pid, {
          ...proc,
          ...snapshot,
          identity: proc?.identity ?? `${snapshot.pid}:${snapshot.boot}`,
          sampleSource: 'cooperative_node',
          heapCoverage: 'cooperative_main_isolate',
          sampleAgeMs: Math.max(0, this.now() - snapshot.sampledAtEpochMs),
        });
      }
      for (const response of responses)
        if (!response.snapshot && !processMap.has(response.pid))
          processMap.set(response.pid, {
            pid: response.pid,
            service: response.service,
            identity: `${response.pid}:unavailable`,
            rss: null,
            sampleSource: 'unavailable',
          });
      const processes = [...processMap.values()].slice(0, 64),
        current = new Map(
          processes.map((p) => [
            p.identity,
            { pid: p.pid, service: p.service, identity: p.identity },
          ]),
        );
      const started = [...current].filter(([id]) => !this.previous.has(id)).map(([, p]) => p),
        exited = [...this.previous].filter(([id]) => !current.has(id)).map(([, p]) => p);
      this.previous = current;
      for (const p of exited) this.trends.delete(p.identity);
      let activity = false;
      for (const p of processes) {
        if (!Number.isFinite(p.rss)) continue;
        let trend = this.trends.get(p.identity);
        if (!trend) {
          if (this.trends.size >= 64) this.trends.delete(this.trends.keys().next().value);
          trend = {
            firstRss: p.rss,
            lastRss: p.rss,
            minRss: p.rss,
            maxRss: p.rss,
            firstAt: requestedAt,
            observations: 0,
            previousUploads: p.uploadsStarted ?? 0,
          };
          this.trends.set(p.identity, trend);
        }
        activity ||= (p.active ?? 0) > 0 || (p.uploadsStarted ?? 0) > trend.previousUploads;
        trend.previousUploads = p.uploadsStarted ?? trend.previousUploads;
        trend.observations++;
        trend.lastRss = p.rss;
        trend.minRss = Math.min(trend.minRss, p.rss);
        trend.maxRss = Math.max(trend.maxRss, p.rss);
        p.baselineTrend = {
          firstRss: trend.firstRss,
          deltaRss: p.rss - trend.firstRss,
          minRss: trend.minRss,
          maxRss: trend.maxRss,
          observations: trend.observations,
          elapsedMs: requestedAt - trend.firstAt,
        };
      }
      if (activity) this.lastActivity = requestedAt;
      const stage = activity
        ? 'activity'
        : this.readyAt === null
          ? 'startup'
          : requestedAt - this.readyAt < 60000
            ? 'warmup'
            : this.lastActivity !== null && requestedAt - this.lastActivity < 30000
              ? 'post_activity'
              : 'idle';
      const cgroup = this.container.read(),
        sampleTimes = cooperative.map((p) => p.sampledAtEpochMs).filter(Number.isFinite),
        sumRss = processes.reduce((s, p) => s + (Number.isFinite(p.rss) ? p.rss : 0), 0);
      const row = {
        event: 'application_memory',
        version: 1,
        time: new Date(requestedAt).toISOString(),
        instance: local.instance,
        collectorBoot: local.boot,
        collection: ++this.sequence,
        stage,
        requestedAtEpochMs: requestedAt,
        completedAtEpochMs: this.now(),
        sampleSkewMs: sampleTimes.length
          ? Math.max(...sampleTimes) - Math.min(...sampleTimes)
          : null,
        cgroup,
        sumProcessRssBytes: sumRss,
        sumProcessRssIsContainerTotal: false,
        processes,
        changes: { started, exited },
        coverage: {
          registered: this.children.size,
          missingSnapshots: responses.filter((r) => !r.snapshot).map((r) => r.service),
          discovery: tree.discovery,
          processLimitReached: tree.limited,
          unreadableProcessFiles: tree.unreadable,
          hostProcessesEnumerated: false,
          scope: 'registered_application_tree',
        },
        baselineNormality: 'not_determined',
        collectionsSkipped: this.skipped,
        logsDropped: this.dropped,
      };
      if (this.sink(row) === false) this.dropped++;
    } catch {
      this.dropped++;
    } finally {
      this.busy = false;
    }
  }
  stop() {
    this.stopped = true;
    if (this.timer) this.clear(this.timer);
    for (const { channel } of this.children.values()) channel.stop();
    this.children.clear();
    this.previous.clear();
    this.trends.clear();
  }
}
