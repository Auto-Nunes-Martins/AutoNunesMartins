// Linux Docker build gate; no application/DB imports or credentials required.
import assert from 'node:assert/strict';
process.env.RUNTIME_DIAGNOSTICS = 'true';
const { allocatorDiagnostics } = await import('../dist/lib/server/allocatorDiagnostics.js');
const { nativeDiagnosticSnapshot } = await import('../../shared/nativeDiagnostics.mjs');
const { sanitizeDiagnostic } = await import('../../shared/diagnosticEvents.mjs');
const stats = allocatorDiagnostics.snapshot();
assert.equal(stats.available, 1);
assert.equal(stats.reasonCode, 0);
assert.equal(stats.circuitOpen, 0, 'Fresh-process probe exceeded the 25 ms native-call budget');
assert.ok(stats.arenaCount >= 1);
assert.ok(stats.xmlBytes > 0 && stats.xmlBytes < stats.outputLimitBytes);
assert.equal(
  stats.arenaNonFreeBytes,
  stats.arenaSystemBytes - stats.arenaFreeFastBytes - stats.arenaFreeRestBytes,
);
assert.ok(
  Object.values(stats).every(
    (value) => typeof value === 'number' && Number.isFinite(value) && value >= 0,
  ),
);
const native = nativeDiagnosticSnapshot();
const row = {
  event: 'application_memory',
  instance: '11111111-1111-4111-8111-111111111111',
  collectorBoot: '22222222-2222-4222-8222-222222222222',
  time: new Date().toISOString(),
  processes: [{ service: 'backend', native }],
};
assert.deepEqual(sanitizeDiagnostic(row)?.processes?.[0]?.native?.allocator, native.allocator);
assert.ok(JSON.stringify(row).length < 65536);
console.log(
  JSON.stringify({
    check: 'glibc_allocator_build_smoke',
    available: stats.available,
    arenaCount: stats.arenaCount,
    probeMs: stats.probeMs,
  }),
);
