import { expect, it, vi } from 'vitest';
import { createAllocatorDiagnostics } from './allocatorDiagnostics.js';
import {
  registerDiagnosticProvider,
  nativeDiagnosticSnapshot,
} from '../../../../shared/nativeDiagnostics.mjs';
import { sanitizeDiagnostic } from '../../../../shared/diagnosticEvents.mjs';

const native = () => ({
  available: 1,
  reasonCode: 0,
  arenaCount: 2,
  arenaSystemBytes: 1000,
  arenaFreeFastBytes: 100,
  arenaFreeRestBytes: 200,
  arenaNonFreeBytes: 700,
  mmapBytes: 4096,
  mmapCount: 1,
  xmlBytes: 512,
  outputLimitBytes: 65536,
});
it.each([
  ['disabled', false, 'linux', 8],
  ['unsupported', true, 'win32', 1],
] as const)('%s does not load an addon or read the clock', (_name, enabled, platform, reason) => {
  const load = vi.fn(),
    clock = vi.fn();
  const d = createAllocatorDiagnostics({ enabled: () => enabled, platform, load, clock });
  expect(d.snapshot()).toMatchObject({ available: 0, reasonCode: reason, samples: 0 });
  expect(load).not.toHaveBeenCalled();
  expect(clock).not.toHaveBeenCalled();
});
it('samples at most once per 30 seconds with independent bounded numeric snapshots', () => {
  let time = 0;
  const snapshot = vi.fn(native),
    load = vi.fn(() => ({ snapshot }));
  const d = createAllocatorDiagnostics({
    enabled: () => true,
    platform: 'linux',
    load,
    clock: () => time,
  });
  expect(d.snapshot()).toMatchObject({
    available: 1,
    samples: 1,
    sampleAgeMs: 0,
    arenaNonFreeBytes: 700,
  });
  time = 29999;
  const cached = d.snapshot();
  cached.arenaCount = 999;
  expect(d.snapshot()).toMatchObject({ arenaCount: 2, samples: 1, sampleAgeMs: 29999 });
  expect(snapshot).toHaveBeenCalledTimes(1);
  time = 30000;
  expect(d.snapshot().samples).toBe(2);
  expect(snapshot).toHaveBeenCalledTimes(2);
  expect(load).toHaveBeenCalledTimes(1);
});
it('starts the sampling cadence at the native call, excluding first-load delay', () => {
  let time = 0;
  const snapshot = vi.fn(native);
  const d = createAllocatorDiagnostics({
    enabled: () => true,
    platform: 'linux',
    clock: () => time,
    load: () => {
      time += 50;
      return { snapshot };
    },
  });
  d.snapshot();
  time = 30000;
  d.snapshot();
  expect(snapshot).toHaveBeenCalledTimes(1);
  time = 30050;
  d.snapshot();
  expect(snapshot).toHaveBeenCalledTimes(2);
});
it('does not retry missing bindings or load with an alternate allocator detected', () => {
  const load = vi.fn(() => {
    throw Error('not present');
  });
  const d = createAllocatorDiagnostics({ enabled: () => true, platform: 'linux', load });
  expect(d.snapshot()).toMatchObject({ available: 0, reasonCode: 2 });
  d.snapshot();
  expect(load).toHaveBeenCalledTimes(1);
  const other = createAllocatorDiagnostics({
    enabled: () => true,
    platform: 'linux',
    load,
    alternateAllocator: () => true,
  });
  expect(other.snapshot()).toMatchObject({ available: 0, reasonCode: 9 });
  expect(load).toHaveBeenCalledTimes(1);
});
it('contains native exceptions and keeps explicit output-cap failures unavailable', () => {
  const d = createAllocatorDiagnostics({
    enabled: () => true,
    platform: 'linux',
    load: () => ({
      snapshot: () => {
        throw Error('fixture');
      },
    }),
  });
  expect(d.snapshot()).toMatchObject({ available: 0, reasonCode: 3, samples: 1 });
  const cap = createAllocatorDiagnostics({
    enabled: () => true,
    platform: 'linux',
    load: () => ({ snapshot: () => ({ ...native(), available: 0, reasonCode: 4 }) }),
  });
  expect(cap.snapshot()).toMatchObject({ available: 0, reasonCode: 4 });
});
it.each([
  { mmapBytes: Infinity },
  { xmlBytes: 65536 },
  { arenaCount: -1 },
  { arenaSystemBytes: Number.MAX_SAFE_INTEGER + 1 },
  { arenaFreeFastBytes: 1001 },
  { arenaNonFreeBytes: 701 },
  { available: 0, reasonCode: 0 },
])('rejects malformed or unsafe native data %o', (bad) => {
  const d = createAllocatorDiagnostics({
    enabled: () => true,
    platform: 'linux',
    load: () => ({ snapshot: () => ({ ...native(), ...bad }) }),
  });
  expect(d.snapshot()).toMatchObject({ available: 0, reasonCode: 6 });
});
it('opens a circuit after one slow probe without claiming a hard first-call timeout', () => {
  let time = 0;
  const snapshot = vi.fn(() => {
    time += 30;
    return native();
  });
  const d = createAllocatorDiagnostics({
    enabled: () => true,
    platform: 'linux',
    load: () => ({ snapshot }),
    clock: () => time,
  });
  expect(d.snapshot()).toMatchObject({ available: 1, samples: 1, probeMs: 30, circuitOpen: 1 });
  time = 100;
  expect(d.snapshot().available).toBe(1);
  time = 30000;
  expect(d.snapshot()).toMatchObject({
    available: 0,
    reasonCode: 7,
    samples: 1,
    sampleAgeMs: 30000,
  });
  expect(snapshot).toHaveBeenCalledTimes(1);
});
it('allow-lists numeric fields and preserves them through the actual provider and sanitizer', () => {
  const d = createAllocatorDiagnostics({
    enabled: () => true,
    platform: 'linux',
    clock: () => 0,
    load: () => ({
      snapshot: () => ({ ...native(), path: 'private', xml: '<raw/>', unexpected: 123 }),
    }),
  });
  registerDiagnosticProvider('allocator', () => d.snapshot());
  const snapshot = nativeDiagnosticSnapshot();
  expect(snapshot.allocator).toEqual(d.snapshot());
  expect(snapshot.allocator).not.toHaveProperty('xml');
  expect(snapshot.allocator).not.toHaveProperty('unexpected');
  const row = {
    event: 'application_memory',
    instance: '11111111-1111-4111-8111-111111111111',
    collectorBoot: '22222222-2222-4222-8222-222222222222',
    time: '2026-11-01T11:00:00.000Z',
    processes: [{ service: 'backend', native: snapshot }],
  };
  expect(sanitizeDiagnostic(row)?.processes?.[0]?.native?.allocator).toEqual(d.snapshot());
  expect(Buffer.byteLength(JSON.stringify(row))).toBeLessThan(65536);
});
