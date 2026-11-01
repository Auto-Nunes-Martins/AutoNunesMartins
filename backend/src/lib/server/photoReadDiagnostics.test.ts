import { afterEach, expect, it, vi } from 'vitest';
import { createPhotoReadDiagnostics } from './photoReadDiagnostics.js';
import { sanitizeDiagnostic } from '../../../../shared/diagnosticEvents.mjs';
import { nativeDiagnosticSnapshot } from '../../../../shared/nativeDiagnostics.mjs';

afterEach(() => vi.unstubAllEnvs());
it('does not sample memory or clocks when diagnostics are off', async () => {
  const memory = vi.fn(),
    now = vi.fn(),
    d = createPhotoReadDiagnostics({ enabled: () => false, memory, now });
  const result = {};
  d.count('cacheHits');
  expect(await d.measure('masterDownload', async () => result)).toBe(result);
  expect(memory).not.toHaveBeenCalled();
  expect(now).not.toHaveBeenCalled();
  expect(d.snapshot().cacheHits).toBe(0);
  expect(d.snapshot().phases.masterDownload.started).toBe(0);
});
it('keeps signed process-wide deltas, bounded aggregates and independent snapshot copies', async () => {
  let calls = 0,
    time = 0;
  const d = createPhotoReadDiagnostics({
    enabled: () => true,
    now: () => (time += 5),
    memory: () =>
      ++calls % 2
        ? { rss: 100, heapUsed: 50, external: 10 }
        : { rss: Number.MAX_SAFE_INTEGER * 2, heapUsed: 40, external: 30 },
  });
  for (let i = 0; i < 1000; i++) await d.measure('derivativeMetadata', async () => 1);
  const snapshot = d.snapshot(),
    phase = snapshot.phases.derivativeMetadata;
  expect(phase).toMatchObject({
    started: 1000,
    completed: 1000,
    failed: 0,
    active: 0,
    peakActive: 1,
    totalMs: 5000,
    memorySamples: 1000,
    rssDeltaBytes: Number.MAX_SAFE_INTEGER,
    heapDeltaBytes: -10000,
    externalDeltaBytes: 20000,
    positiveRssDeltaBytes: Number.MAX_SAFE_INTEGER,
  });
  expect(JSON.stringify(snapshot).length).toBeLessThan(6000);
  phase.started = 9999;
  expect(d.snapshot().phases.derivativeMetadata.started).toBe(1000);
});
it('marks overlapping measured phases and releases active counts after errors', async () => {
  const d = createPhotoReadDiagnostics({
    enabled: () => true,
    memory: () => ({ rss: 1, heapUsed: 1, external: 1 }),
  });
  let release!: () => void;
  const first = d.measure(
    'derivativeDownload',
    () => new Promise<void>((resolve) => (release = resolve)),
  );
  const error = new Error('fixture');
  await expect(
    d.measure('manifestMetadata', async () => {
      throw error;
    }),
  ).rejects.toBe(error);
  release();
  await first;
  expect(d.snapshot().phases.derivativeDownload).toMatchObject({
    completed: 1,
    active: 0,
    overlappedSamples: 1,
  });
  expect(d.snapshot().phases.manifestMetadata).toMatchObject({
    completed: 1,
    failed: 1,
    active: 0,
    overlappedSamples: 1,
  });
  const brokenSampler = createPhotoReadDiagnostics({
    enabled: () => true,
    memory: () => {
      throw Error('sampler');
    },
  });
  expect(await brokenSampler.measure('masterSanitize', async () => 123)).toBe(123);
  expect(brokenSampler.snapshot().phases.masterSanitize).toMatchObject({
    completed: 1,
    active: 0,
    memorySamples: 0,
  });
});
it('registers the opt-in provider and preserves every numeric phase through real diagnostic sanitization', async () => {
  vi.stubEnv('RUNTIME_DIAGNOSTICS', 'true');
  vi.resetModules();
  const { photoReadDiagnostics: d } = await import('./photoReadDiagnostics.js');
  d.count('cacheHits');
  await d.measure('bufferMaterialize', async () => Buffer.from('fixture'));
  const native = nativeDiagnosticSnapshot();
  expect(native.photoreads).toEqual(d.snapshot());
  const row = {
    event: 'application_memory',
    instance: '11111111-1111-4111-8111-111111111111',
    collectorBoot: '22222222-2222-4222-8222-222222222222',
    time: '2026-11-01T10:00:00.000Z',
    processes: [{ service: 'backend', native }],
  };
  const safe = sanitizeDiagnostic(row)!;
  expect(safe.processes[0].native.photoreads).toEqual(d.snapshot());
  expect(Buffer.byteLength(JSON.stringify(safe))).toBeLessThan(65536);
});
