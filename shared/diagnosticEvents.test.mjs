import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import {
  sanitizeDiagnostic,
  acceptDiagnosticEvents,
  setDiagnosticConsumer,
  flushDiagnosticEvents,
  diagnosticTransportStats,
  recordDiagnostic,
} from './diagnosticEvents.mjs';
const base = () => ({
  event: 'runtime_diagnostics',
  time: new Date().toISOString(),
  boot: randomUUID(),
  instance: randomUUID(),
  service: 'backend',
  kind: 'upload_end',
  eventId: randomUUID(),
  processSequence: 1,
});
test('strict event boundary retains chronology and numerical native metrics, strips private material', () => {
  const row = sanitizeDiagnostic({
    ...base(),
    native: { smapsAnonBytes: 120, sharp: { queue: 1 } },
    metrics: { inputWidth: 800 },
    password: 123,
    token: 'secret',
    url: 'private',
    body: { secret: 'private' },
    bad: Infinity,
  });
  assert.equal(row.native.smapsAnonBytes, 120);
  assert.equal(row.metrics.inputWidth, 800);
  assert.equal(row.password, undefined);
  assert.ok(!JSON.stringify(row).includes('private'));
  assert.equal(sanitizeDiagnostic({ ...base(), event: 'http_request' }), undefined);
  assert.equal(sanitizeDiagnostic({ ...base(), time: 'bad' }), undefined);
});
test('collector bounds queue and preserves producer identities/order, consumer failures remain visible', async () => {
  const rows = Array.from({ length: 32 }, () => base());
  for (let i = 0; i < 10; i++) acceptDiagnosticEvents(rows);
  assert.equal(diagnosticTransportStats().transportQueued, 256);
  assert.ok(diagnosticTransportStats().transportDropped >= 64);
  const saved = [];
  setDiagnosticConsumer(async (batch) => {
    saved.push(...batch);
  });
  for (let i = 0; i < 8; i++) await flushDiagnosticEvents();
  assert.equal(saved.length, 256);
  assert.equal(saved[0].eventId, rows[0].eventId);
  assert.equal(diagnosticTransportStats().transportQueued, 0);
});
test('disabled runtime does not retain or publish events', () => {
  const previous = process.env.RUNTIME_DIAGNOSTICS;
  delete process.env.RUNTIME_DIAGNOSTICS;
  const before = diagnosticTransportStats().transportQueued;
  recordDiagnostic(base());
  assert.equal(diagnosticTransportStats().transportQueued, before);
  if (previous !== undefined) process.env.RUNTIME_DIAGNOSTICS = previous;
});
