import { afterEach, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import {
  installDiagnosticStore,
  flushDiagnosticEvents,
  diagnosticStoreStatus,
} from './diagnosticStore';
import { acceptDiagnosticEvents } from '../../../../shared/diagnosticEvents.mjs';
afterEach(() => vi.unstubAllEnvs());
it('persists only sanitized events using an idempotent batch and scoped bounded retention', async () => {
  vi.stubEnv('RUNTIME_DIAGNOSTICS', 'true');
  const execute = vi.fn().mockResolvedValue(1),
    query = vi.fn().mockResolvedValue([{ count: 1 }]);
  const db = { $transaction: vi.fn(async (fn) => fn({ $executeRaw: execute, $queryRaw: query })) };
  installDiagnosticStore(db as any);
  acceptDiagnosticEvents([
    {
      event: 'runtime_diagnostics',
      time: new Date().toISOString(),
      instance: randomUUID(),
      boot: randomUUID(),
      eventId: randomUUID(),
      service: 'backend',
      kind: 'upload_end',
      processSequence: 1,
      token: 'not-stored',
    },
  ]);
  await flushDiagnosticEvents();
  expect(execute).toHaveBeenCalledTimes(1);
  expect(String(query.mock.calls[0][0])).toContain('append_runtime_diagnostics');
  expect(JSON.stringify(query.mock.calls)).not.toContain('not-stored');
  expect(diagnosticStoreStatus.eventsSaved).toBeGreaterThan(0);
});
