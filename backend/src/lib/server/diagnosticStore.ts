import type { PrismaClient } from '@prisma/client';
import {
  setDiagnosticConsumer,
  flushDiagnosticEvents,
} from '../../../../shared/diagnosticEvents.mjs';
import { diagnosticRows } from './diagnosticRemoteStore.js';
export const diagnosticStoreStatus = {
  batches: 0,
  eventsSaved: 0,
  failures: 0,
  lastSuccessEpochMs: 0,
  retentionDays: 7,
  maxEvents: 10000,
};
export function installDiagnosticStore(db: PrismaClient) {
  if (
    process.env.RUNTIME_DIAGNOSTICS !== 'true' ||
    process.env.RUNTIME_DIAGNOSTICS_MANAGED === 'true'
  )
    return;
  setDiagnosticConsumer(async (rows) => {
    try {
      const data = diagnosticRows(rows);
      if (!data.length) return;
      const result = await db.$transaction(
        async (tx) => {
          await tx.$executeRaw`SELECT set_config('statement_timeout','2500',true)`;
          return tx.$queryRaw<
            { count: number }[]
          >`SELECT public.append_runtime_diagnostics(${JSON.stringify(data)}::jsonb) AS count`;
        },
        { maxWait: 1000, timeout: 5000 },
      );
      diagnosticStoreStatus.eventsSaved += Number(result[0]?.count) || 0;
      diagnosticStoreStatus.batches++;
      diagnosticStoreStatus.lastSuccessEpochMs = Date.now();
    } catch {
      diagnosticStoreStatus.failures++;
      throw Error('Diagnostic persistence unavailable');
    }
  });
}
export { flushDiagnosticEvents };
