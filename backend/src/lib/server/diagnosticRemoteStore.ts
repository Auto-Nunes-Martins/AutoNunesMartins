import { createClient } from '@supabase/supabase-js';
import { setDiagnosticConsumer, sanitizeDiagnostic } from '../../../../shared/diagnosticEvents.mjs';
import { registerDiagnosticProvider } from '../../../../shared/nativeDiagnostics.mjs';
export function diagnosticRows(rows: unknown[]) {
  return rows
    .map(sanitizeDiagnostic)
    .filter((row): row is Record<string, unknown> => !!row)
    .map((row) => ({
      eventId: row.eventId,
      occurredAt: row.time,
      instance: row.instance,
      boot: row.boot ?? row.collectorBoot,
      service: row.service ?? 'gateway',
      event: row.event,
      kind: row.kind ?? row.stage ?? null,
      processSequence: row.processSequence ?? 0,
      trace: row.trace ?? null,
      payload: row,
    }));
}
export function installRemoteDiagnosticStore(env: NodeJS.ProcessEnv = process.env) {
  const status = {
    enabled: true,
    batches: 0,
    eventsSaved: 0,
    failures: 0,
    lastSuccessEpochMs: 0,
    schemaAvailable: false,
    retentionDays: 7,
    maxEvents: 10000,
    payloadBudgetBytes: 50000000,
  };
  registerDiagnosticProvider('persistence', () => ({ ...status }));
  const key = env.SUPABASE_SECRET_KEY ?? env.SUPABASE_SERVICE_ROLE_KEY;
  const client =
    key && env.SUPABASE_URL
      ? createClient(env.SUPABASE_URL, key, {
          auth: { persistSession: false, autoRefreshToken: false },
          global: {
            fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(3000) }),
          },
        })
      : undefined;
  setDiagnosticConsumer(async (rows) => {
    try {
      if (!client) throw Error('Diagnostic store configuration unavailable');
      const { data, error } = await client.rpc('append_runtime_diagnostics', {
        events: diagnosticRows(rows),
      });
      if (error) throw Error('Diagnostic persistence unavailable');
      status.schemaAvailable = true;
      status.batches++;
      status.eventsSaved += Number(data) || 0;
      status.lastSuccessEpochMs = Date.now();
    } catch {
      status.failures++;
      throw Error('Diagnostic persistence unavailable');
    }
  });
  return status;
}
