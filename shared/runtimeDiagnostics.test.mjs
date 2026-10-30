import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  ProcessDiagnostics,
  safeMetrics,
  clientMetrics,
  correlationId,
} from './runtimeDiagnostics.mjs';

function fixture(enabled = true, sink) {
  let now = 0,
    rss = 100;
  const logs = [],
    timers = new Set();
  const diagnostics = new ProcessDiagnostics({
    env: { RUNTIME_DIAGNOSTICS: String(enabled) },
    service: 'harness',
    sample: () => ({
      atMs: now,
      uptimeMs: now,
      rss,
      heapUsed: 20,
      heapTotal: 40,
      external: 30,
      arrayBuffers: 10,
      cpuUserUs: now * 100,
      cpuSystemUs: now * 20,
    }),
    sink: sink ?? ((row) => logs.push(structuredClone(row))),
    container: () => ({ containerBytes: 400, containerLimitBytes: 512 }),
    setInterval: (fn, ms) => {
      const timer = { fn, ms, unref() {} };
      timers.add(timer);
      return timer;
    },
    clearInterval: (timer) => timers.delete(timer),
  });
  return {
    diagnostics,
    logs,
    timers,
    time: (value) => (now = value),
    memory: (value) => (rss = value),
  };
}
test('disabled means no logs, samples, timers or retained upload state', () => {
  const f = fixture(false);
  const trace = f.diagnostics.begin('private', { inputBytes: 100 });
  trace.phase('receive');
  trace.finish('ok');
  f.diagnostics.rejection();
  assert.equal(f.logs.length, 0);
  assert.equal(f.timers.size, 0);
  assert.equal(f.diagnostics.active.size, 0);
  assert.equal(f.diagnostics.sequence, 0);
});
test('samples an in-flight peak that is absent at both endpoints', () => {
  const f = fixture(),
    trace = f.diagnostics.begin();
  f.time(250);
  f.memory(900);
  f.diagnostics.tick();
  f.time(500);
  f.memory(110);
  trace.phase('storage');
  trace.finish('ok');
  trace.finish('ok');
  const end = f.logs.find((row) => row.kind === 'upload_end');
  assert.equal(end.peak.rss, 900);
  assert.equal(end.rss, 110);
  assert.equal(end.durationMs, 500);
  assert.equal(end.active, 0);
  assert.equal(end.uploadsCompleted, 1);
  assert.ok(end.samples >= 3);
  assert.equal(end.peakAt.rss.phase, 'lookup');
  assert.equal(end.peakAt.rss.elapsedMs, 250);
  const phase = f.logs.find((row) => row.kind === 'upload_phase');
  assert.equal(phase.phasePeak.rss, 900);
  assert.equal(phase.phasePeakAt.rss.elapsedMs, 250);
  assert.equal(phase.processCpuUserUs, 50000);
  f.diagnostics.stop();
  assert.equal(f.timers.size, 0);
});
test('ten sequential photos across arbitrary editors share global monotonic counters and bounded timers', () => {
  const f = fixture();
  for (let i = 0; i < 10; i++) {
    f.time(i * 1000);
    const trace = f.diagnostics.begin();
    trace.phase('receive', { inputBytes: 200 });
    trace.phase('optimize');
    trace.finish(i === 5 ? 'error' : 'ok');
    assert.equal(f.diagnostics.active.size, 0);
    assert.equal(f.timers.size, 2);
  }
  assert.deepEqual(
    f.logs.filter((row) => row.kind === 'upload_start').map((row) => row.upload),
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  );
  assert.equal(f.diagnostics.completed, 9);
  assert.equal(f.diagnostics.failed, 1);
  f.time(50000);
  [...f.timers].find((t) => t.ms === 5000).fn();
  assert.equal(f.timers.size, 1);
  f.diagnostics.stop();
});
test('initial maxima retain their timestamp and input dimensions survive final dimensions', () => {
  const f = fixture();
  f.memory(900);
  const trace = f.diagnostics.begin();
  trace.fields({ inputWidth: 4000, inputHeight: 3000 });
  f.time(100);
  f.memory(100);
  trace.phase('storage');
  trace.fields({ outputWidth: 1600, outputHeight: 1200 });
  trace.finish('ok');
  const end = f.logs.find((r) => r.kind === 'upload_end');
  assert.equal(end.peakAt.rss.elapsedMs, 0);
  assert.equal(end.peakAt.rss.phase, 'lookup');
  assert.equal(end.metrics.inputWidth, 4000);
  assert.equal(end.metrics.outputWidth, 1600);
  f.diagnostics.stop();
});
test('metadata allowlist rejects strings, paths, nonfinite numbers, images and oversized headers', () => {
  assert.deepEqual(
    safeMetrics({
      inputBytes: 100,
      preparationMs: 12.124,
      path: 'secret',
      vehicleId: 'private',
      buffer: Buffer.alloc(12),
      width: Infinity,
      height: -1,
      status: '200',
    }),
    { inputBytes: 100, preparationMs: 12.12 },
  );
  assert.deepEqual(clientMetrics('x'.repeat(1025)), {});
  assert.deepEqual(clientMetrics('{broken'), {});
  assert.deepEqual(clientMetrics('{"originalBytes":120,"filename":"private.jpg"}'), {
    originalBytes: 120,
  });
  assert.notEqual(correlationId('private'), 'private');
});
test('concurrency is bounded and admission rejection logs are throttled', () => {
  const f = fixture();
  for (let i = 0; i < 100; i++) f.diagnostics.rejection();
  assert.equal(f.logs.filter((r) => r.kind === 'admission_rejected').length, 1);
  assert.equal(f.diagnostics.rejected, 100);
  for (let i = 0; i < 32; i++) f.diagnostics.begin();
  assert.equal(f.diagnostics.begin().id, undefined);
  assert.equal(f.diagnostics.active.size, 32);
  f.diagnostics.stop();
  assert.equal(f.diagnostics.active.size, 0);
  assert.equal(f.timers.size, 0);
});
test('only known completed correlations accept one bounded client report, with a global rate limit', () => {
  const f = fixture();
  assert.equal(f.diagnostics.clientTransfer(correlationId(), { transferMs: 1 }, 'ok'), false);
  for (let i = 0; i < 121; i++) {
    const trace = f.diagnostics.begin();
    trace.finish('ok');
    assert.equal(
      f.diagnostics.clientTransfer(trace.id, { transferMs: 30, path: 'private' }, 'ok'),
      i < 120,
    );
    assert.equal(f.diagnostics.clientTransfer(trace.id, { transferMs: 31 }, 'ok'), false);
  }
  assert.equal(f.logs.filter((row) => row.kind === 'client_transfer').length, 120);
  assert.ok(!JSON.stringify(f.logs).includes('private'));
  f.diagnostics.stop();
});
test('recent summaries are bounded and logger backpressure/errors do not break uploads', () => {
  const f = fixture(true, () => {
    throw Error('stdout unavailable');
  });
  for (let i = 0; i < 300; i++) f.diagnostics.begin().finish('ok');
  assert.equal(f.diagnostics.recent.size, 256);
  assert.ok(f.diagnostics.dropped > 0);
  assert.equal(f.diagnostics.completed, 300);
  f.diagnostics.stop();
  assert.equal(f.diagnostics.recent.size, 0);
});
test('memory categories remain separate rather than being added into an invalid total', () => {
  const f = fixture(),
    boot = f.logs[0];
  assert.equal(boot.external, 30);
  assert.equal(boot.arrayBuffers, 10);
  assert.equal(boot.rss, 100);
  assert.equal(boot.containerBytes, 400);
  assert.equal(boot.totalMemory, undefined);
  const second = fixture();
  assert.notEqual(boot.boot, second.logs[0].boot);
  f.diagnostics.stop();
  second.diagnostics.stop();
});
test('preload reports one boot and one shutdown and does not keep an idle process alive', () => {
  const result = spawnSync(
    process.execPath,
    [
      '--import',
      './deployment/diagnostics-preload.mjs',
      '--input-type=module',
      '-e',
      `import assert from 'node:assert/strict';import {getProcessDiagnostics} from './shared/runtimeDiagnostics.mjs';const a=getProcessDiagnostics();assert.equal(a,getProcessDiagnostics());assert.equal(a.service,'website');assert.equal(process.listenerCount('uncaughtExceptionMonitor'),1);`,
    ],
    {
      cwd: fileURLToPath(new URL('../', import.meta.url)),
      env: { ...process.env, RUNTIME_DIAGNOSTICS: 'true', RUNTIME_DIAGNOSTICS_SERVICE: 'website' },
      encoding: 'utf8',
      timeout: 5000,
    },
  );
  assert.equal(result.status, 0, result.stderr);
  const rows = result.stdout
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line));
  assert.equal(rows.filter((row) => row.kind === 'boot').length, 1);
  assert.equal(rows.filter((row) => row.kind === 'shutdown').length, 1);
});
test('a failing sampler remains best effort and does not break the upload lifecycle', () => {
  const diagnostics = new ProcessDiagnostics({
    env: { RUNTIME_DIAGNOSTICS: 'true' },
    sample: () => {
      throw Error('unavailable');
    },
    sink: () => true,
    container: () => ({}),
  });
  assert.doesNotThrow(() => diagnostics.begin().finish('ok'));
  assert.equal(diagnostics.completed, 1);
  diagnostics.stop();
});
test('worker/loader contexts cannot duplicate RSS baselines or global process counters', () => {
  const moduleUrl = new URL('./runtimeDiagnostics.mjs', import.meta.url).href;
  const workerCode = `import {parentPort} from 'node:worker_threads';import {getProcessDiagnostics} from ${JSON.stringify(moduleUrl)};parentPort.postMessage(getProcessDiagnostics().enabled);`;
  const code = `import assert from 'node:assert/strict';import {Worker} from 'node:worker_threads';import {once} from 'node:events';const worker=new Worker(new URL('data:text/javascript,'+encodeURIComponent(${JSON.stringify(workerCode)})));const [enabled]=await once(worker,'message');assert.equal(enabled,false);await once(worker,'exit');`;
  const result = spawnSync(
    process.execPath,
    ['--import', './deployment/diagnostics-preload.mjs', '--input-type=module', '-e', code],
    {
      cwd: fileURLToPath(new URL('../', import.meta.url)),
      env: { ...process.env, RUNTIME_DIAGNOSTICS: 'true' },
      encoding: 'utf8',
      timeout: 5000,
    },
  );
  assert.equal(result.status, 0, result.stderr);
  const rows = result.stdout
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line));
  assert.equal(rows.filter((row) => row.kind === 'boot').length, 1);
  assert.equal(rows.filter((row) => row.kind === 'shutdown').length, 1);
});
