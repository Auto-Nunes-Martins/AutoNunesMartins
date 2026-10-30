import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';
const processes = new Map();
const instances = new Map();
const finite = (n) => (typeof n === 'number' && Number.isFinite(n) ? n : 0);
const mb = (n) =>
  n === null || n === undefined ? null : Math.round((finite(n) / 1000000) * 10) / 10;
function aligned(row) {
  const key = row.collectorBoot;
  if (typeof key !== 'string') return;
  if (!instances.has(key)) {
    if (instances.size >= 128) return;
    instances.set(key, {
      instance: row.instance,
      collectorBoot: key,
      observations: 0,
      first: row.time,
      last: row.time,
      firstTotal: row.cgroup?.currentBytes ?? null,
      lastTotal: null,
      maxTotal: null,
      minTotal: null,
      minHeadroom: null,
      stages: {},
      recent: [],
    });
  }
  const a = instances.get(key);
  a.observations++;
  a.last = row.time;
  a.lastTotal = row.cgroup?.currentBytes ?? null;
  if (Number.isFinite(a.lastTotal)) {
    a.maxTotal = Math.max(a.maxTotal ?? a.lastTotal, a.lastTotal);
    a.minTotal = Math.min(a.minTotal ?? a.lastTotal, a.lastTotal);
  }
  const headroom = row.cgroup?.effectiveHeadroomBytes;
  if (Number.isFinite(headroom)) a.minHeadroom = Math.min(a.minHeadroom ?? headroom, headroom);
  a.stages[row.stage] = (a.stages[row.stage] ?? 0) + 1;
  a.recent.push({
    time: row.time,
    stage: row.stage,
    totalMB: mb(a.lastTotal),
    limitMB: mb(row.cgroup?.limitBytes),
    effectiveLimitMB: mb(row.cgroup?.effectiveLimitBytes),
    cgroupUnavailableReason: row.cgroup?.reason,
    componentsMB: Object.fromEntries(
      Object.entries(row.cgroup?.components ?? {}).map(([key, value]) => [
        key.replace(/Bytes$/, 'MB'),
        mb(value),
      ]),
    ),
    effectiveHeadroomMB: mb(headroom),
    cgroupPeakMB: mb(row.cgroup?.peakBytes),
    sumProcessRssMB: mb(row.sumProcessRssBytes),
    sumProcessRssIsContainerTotal: false,
    sampleSkewMs: row.sampleSkewMs,
    coverage: row.coverage,
    changes: row.changes,
    processes: (row.processes ?? []).slice(0, 64).map((p) => ({
      service: p.service,
      pid: p.pid,
      identity: p.identity,
      rssMB: mb(p.rss),
      heapUsedMB: mb(p.heapUsed),
      externalMB: mb(p.external),
      arrayBuffersMB: mb(p.arrayBuffers),
      baselineDeltaMB: mb(p.baselineTrend?.deltaRss),
      baselineMinMB: mb(p.baselineTrend?.minRss),
      baselineMaxMB: mb(p.baselineTrend?.maxRss),
    })),
  });
  if (a.recent.length > 50) a.recent.shift();
}
for (const file of process.argv.slice(2)) {
  for await (const line of createInterface({
    input: createReadStream(file),
    crlfDelay: Infinity,
  })) {
    let row;
    try {
      row = JSON.parse(line);
    } catch {
      continue;
    }
    if (row.event === 'application_memory') {
      aligned(row);
      continue;
    }
    if (
      row.event !== 'runtime_diagnostics' ||
      typeof row.boot !== 'string' ||
      !['backend', 'crm', 'website', 'gateway', 'harness'].includes(row.service)
    )
      continue;
    const key = row.boot;
    if (!processes.has(key)) {
      if (processes.size >= 128) continue;
      processes.set(key, {
        service: row.service,
        boot: row.boot,
        pid: row.pid,
        firstRss: row.rss,
        lastRss: 0,
        maxRss: 0,
        maxExternal: 0,
        maxArrayBuffers: 0,
        lastIdleRss: undefined,
        rejected: 0,
        completed: 0,
        failed: 0,
        dropped: 0,
        containerMax: 0,
        cpuUserStart: row.cpuUserUs,
        cpuSystemStart: row.cpuSystemUs,
        cpuUser: 0,
        cpuSystem: 0,
        uploads: new Map(),
        events: 0,
      });
    }
    const p = processes.get(key);
    p.events++;
    p.lastRss = row.rss;
    p.maxRss = Math.max(p.maxRss, finite(row.rss), finite(row.peak?.rss));
    p.maxExternal = Math.max(p.maxExternal, finite(row.external), finite(row.peak?.external));
    p.maxArrayBuffers = Math.max(
      p.maxArrayBuffers,
      finite(row.arrayBuffers),
      finite(row.peak?.arrayBuffers),
    );
    p.containerMax = Math.max(
      p.containerMax,
      finite(row.containerBytes),
      finite(row.peak?.containerBytes),
    );
    p.rejected = Math.max(p.rejected, finite(row.rejected));
    p.completed = Math.max(p.completed, finite(row.uploadsCompleted));
    p.failed = Math.max(p.failed, finite(row.uploadsFailed));
    p.dropped = Math.max(p.dropped, finite(row.logsDropped));
    p.cpuUser = row.cpuUserUs;
    p.cpuSystem = row.cpuSystemUs;
    if (row.kind === 'idle') p.lastIdleRss = row.rss;
    if (row.kind === 'upload_end') {
      if (p.uploads.size >= 50) p.uploads.delete(p.uploads.keys().next().value);
      p.uploads.set(row.trace, {
        upload: row.upload,
        outcome: row.outcome,
        status: row.status,
        serverMs: Math.round(finite(row.durationMs)),
        peakRssMB: mb(row.peak?.rss),
        peakExternalMB: mb(row.peak?.external),
        peakArrayBuffersMB: mb(row.peak?.arrayBuffers),
        peakAt: row.peakAt,
        samples: row.samples,
        inputBytes: row.metrics?.inputBytes,
        outputBytes: row.metrics?.outputBytes,
        preparationMs: row.metrics?.preparationMs,
        width: row.metrics?.width,
        height: row.metrics?.height,
        inputWidth: row.metrics?.inputWidth,
        inputHeight: row.metrics?.inputHeight,
        outputWidth: row.metrics?.outputWidth,
        outputHeight: row.metrics?.outputHeight,
        preparationCoverage: row.metrics?.preparationCoverage ?? 0,
      });
    }
    if (row.kind === 'client_transfer' && p.uploads.has(row.trace))
      Object.assign(p.uploads.get(row.trace), {
        clientTransferMs: row.transferMs,
        clientOutcome: row.outcome,
      });
  }
}
console.log(
  JSON.stringify(
    {
      note: 'Observed samples, not a proof of leak or a Linux/Render capacity measurement. RSS categories overlap; never sum RSS+heap+external+arrayBuffers or process RSS values as container usage.',
      unit: 'MB = 1000000 bytes',
      application: [...instances.values()].map((a) => ({
        instance: a.instance,
        collectorBoot: a.collectorBoot,
        observations: a.observations,
        first: a.first,
        last: a.last,
        firstTotalMB: mb(a.firstTotal),
        lastTotalMB: mb(a.lastTotal),
        deltaTotalMB:
          a.firstTotal === null || a.lastTotal === null ? null : mb(a.lastTotal - a.firstTotal),
        minTotalMB: mb(a.minTotal),
        maxObservedTotalMB: mb(a.maxTotal),
        minObservedHeadroomMB: mb(a.minHeadroom),
        stages: a.stages,
        baselineNormality: 'not_determined',
        recent: a.recent,
      })),
      processes: [...processes.values()].map((p) => ({
        service: p.service,
        boot: p.boot,
        pid: p.pid,
        events: p.events,
        completed: p.completed,
        failed: p.failed,
        rejected: p.rejected,
        logsDropped: p.dropped,
        firstRssMB: mb(p.firstRss),
        lastRssMB: mb(p.lastRss),
        maxObservedRssMB: mb(p.maxRss),
        lastIdleRssMB: mb(p.lastIdleRss),
        maxExternalMB: mb(p.maxExternal),
        maxArrayBuffersMB: mb(p.maxArrayBuffers),
        maxObservedContainerMB: p.containerMax ? mb(p.containerMax) : null,
        cpuUserMs: Math.round((finite(p.cpuUser) - finite(p.cpuUserStart)) / 1000),
        cpuSystemMs: Math.round((finite(p.cpuSystem) - finite(p.cpuSystemStart)) / 1000),
        lastUploads: [...p.uploads.values()],
      })),
    },
    null,
    2,
  ),
);
