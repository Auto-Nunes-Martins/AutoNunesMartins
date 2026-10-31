import { PrismaClient } from '@prisma/client';
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
let client: PrismaClient | undefined;
const sqlStates = new Set([
  '42501',
  '42883',
  '42P01',
  '57014',
  '55P03',
  '53300',
  '08001',
  '08006',
  '23502',
  '23505',
  '22023',
]);
function failureInfo(error: unknown) {
  const value = error as { code?: string; meta?: { code?: string } };
  const sql = sqlStates.has(value?.meta?.code ?? '') ? value.meta!.code! : null;
  const kind =
    sql === '42501'
      ? 'permission'
      : sql === '42883' || sql === '42P01'
        ? 'schema'
        : sql === '57014' || sql === '55P03' || ['P2024', 'P2028'].includes(value?.code ?? '')
          ? 'timeout'
          : ['P1000', 'P1001', 'P1002', 'P1017'].includes(value?.code ?? '')
            ? 'connection'
            : 'database';
  return { kind, sql };
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
    privateSql: true,
    connectionLimit: 1,
    lastAttemptEpochMs: 0,
    lastAttemptDurationMs: 0,
    lastFailureEpochMs: 0,
    lastFailureKind: null as string | null,
    lastFailureSqlState: null as string | null,
  };
  registerDiagnosticProvider('persistence', () => ({ ...status }));
  try {
    const url = new URL(env.DATABASE_URL ?? '');
    if (!['postgres:', 'postgresql:'].includes(url.protocol)) throw Error('Invalid configuration');
    url.searchParams.set('connection_limit', '1');
    url.searchParams.set('pool_timeout', '2');
    url.searchParams.set('connect_timeout', '2');
    client = new PrismaClient({ datasources: { db: { url: url.toString() } }, log: [] });
  } catch {
    status.lastFailureKind = 'configuration';
  }
  setDiagnosticConsumer(async (rows) => {
    const started = performance.now();
    status.lastAttemptEpochMs = Date.now();
    try {
      if (!client) {
        status.lastFailureKind = 'configuration';
        throw Error('Diagnostic store configuration unavailable');
      }
      const data = diagnosticRows(rows);
      if (!data.length) return;
      const result = await client.$transaction(
        async (tx) => {
          await tx.$executeRaw`SELECT set_config('statement_timeout','2500',true)`;
          return tx.$queryRaw<
            { count: number }[]
          >`SELECT public.append_runtime_diagnostics(${JSON.stringify(data)}::jsonb) AS count`;
        },
        { maxWait: 1000, timeout: 5000 },
      );
      status.schemaAvailable = true;
      status.batches++;
      status.eventsSaved += Number(result[0]?.count) || 0;
      status.lastSuccessEpochMs = Date.now();
    } catch (error) {
      status.failures++;
      status.lastFailureEpochMs = Date.now();
      if (client) {
        const info = failureInfo(error);
        status.lastFailureKind = info.kind;
        status.lastFailureSqlState = info.sql;
      }
      throw Error('Diagnostic persistence unavailable');
    } finally {
      status.lastAttemptDurationMs = Math.max(0, performance.now() - started);
    }
  });
  return status;
}
export async function closeRemoteDiagnosticStore() {
  await client?.$disconnect();
  client = undefined;
}
