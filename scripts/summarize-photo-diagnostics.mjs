import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';
const processes = new Map();
const finite = (n) => (typeof n === 'number' && Number.isFinite(n) ? n : 0);
const mib = (n) => Math.round((finite(n) / 1048576) * 10) / 10;
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
        peakRssMiB: mib(row.peak?.rss),
        peakExternalMiB: mib(row.peak?.external),
        peakArrayBuffersMiB: mib(row.peak?.arrayBuffers),
        samples: row.samples,
        inputBytes: row.metrics?.inputBytes,
        outputBytes: row.metrics?.outputBytes,
        preparationMs: row.metrics?.preparationMs,
        width: row.metrics?.width,
        height: row.metrics?.height,
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
      processes: [...processes.values()].map((p) => ({
        service: p.service,
        boot: p.boot,
        pid: p.pid,
        events: p.events,
        completed: p.completed,
        failed: p.failed,
        rejected: p.rejected,
        logsDropped: p.dropped,
        firstRssMiB: mib(p.firstRss),
        lastRssMiB: mib(p.lastRss),
        maxObservedRssMiB: mib(p.maxRss),
        lastIdleRssMiB: p.lastIdleRss === undefined ? null : mib(p.lastIdleRss),
        maxExternalMiB: mib(p.maxExternal),
        maxArrayBuffersMiB: mib(p.maxArrayBuffers),
        maxObservedContainerMiB: p.containerMax ? mib(p.containerMax) : null,
        cpuUserMs: Math.round((finite(p.cpuUser) - finite(p.cpuUserStart)) / 1000),
        cpuSystemMs: Math.round((finite(p.cpuSystem) - finite(p.cpuSystemStart)) / 1000),
        lastUploads: [...p.uploads.values()],
      })),
    },
    null,
    2,
  ),
);
