import { it, expect, vi } from 'vitest';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
const state = vi.hoisted(() => ({
  batches: [] as Record<string, unknown>[][],
  attempts: 0,
  options: undefined as unknown,
  disconnect: vi.fn(),
}));
vi.mock('@prisma/client', () => ({
  PrismaClient: class {
    constructor(options: unknown) {
      state.options = options;
    }
    $disconnect = state.disconnect;
    async $transaction(fn: (tx: unknown) => Promise<unknown>) {
      return fn({
        $executeRaw: async () => 1,
        $queryRaw: async (_sql: unknown, body: string) => {
          const rows = JSON.parse(body);
          state.batches.push(rows);
          if (++state.attempts === 1)
            throw { code: 'P1001', message: 'private details must not enter diagnostics' };
          return [{ count: rows.length }];
        },
      });
    }
  },
}));
import { installRemoteDiagnosticStore, closeRemoteDiagnosticStore } from './diagnosticRemoteStore';
import {
  acceptDiagnosticEvents,
  recordDiagnostic,
  flushDiagnosticEvents,
} from '../../../../shared/diagnosticEvents.mjs';
it('private supervisor SQL survives a real child exit, bounds its pool and retries idempotent batches without a Data API', async () => {
  const previous = process.env.RUNTIME_DIAGNOSTICS;
  process.env.RUNTIME_DIAGNOSTICS = 'true';
  const instance = randomUUID();
  const status = installRemoteDiagnosticStore({
    DATABASE_URL:
      'postgresql://test:fake@localhost:5432/isolated?pgbouncer=true&connection_limit=8',
  });
  const child = spawn(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      `import {getProcessDiagnostics} from '${new URL('../../../../shared/runtimeDiagnostics.mjs', import.meta.url).href}';getProcessDiagnostics('backend');setInterval(()=>{},1000);`,
    ],
    {
      stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
      env: {
        ...process.env,
        RUNTIME_DIAGNOSTICS_MANAGED: 'true',
        RUNTIME_DIAGNOSTICS_INSTANCE: instance,
      },
    },
  );
  try {
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(Error('Child diagnostics timeout')), 5000);
      child.on('message', (message: { type: string; events: unknown }) => {
        if (message.type === 'anm:diagnostic:events') {
          acceptDiagnosticEvents(message.events);
          clearTimeout(timeout);
          resolve();
        }
      });
      child.once('error', reject);
    });
    const exited = once(child, 'exit');
    child.kill('SIGKILL');
    const [code, signal] = await exited;
    recordDiagnostic({
      event: 'runtime_diagnostics',
      kind: 'child_exit',
      time: new Date().toISOString(),
      instance,
      boot: randomUUID(),
      service: 'gateway',
      signal,
      status: code,
    });
    await flushDiagnosticEvents();
    expect(status.failures).toBe(1);
    expect(status.lastFailureKind).toBe('connection');
    expect(status.schemaAvailable).toBe(true);
    expect(status.privateSql).toBe(true);
    expect(status.eventsSaved).toBeGreaterThanOrEqual(2);
    expect(state.batches[1].map((row) => row.eventId)).toEqual(
      state.batches[0].map((row) => row.eventId),
    );
    expect(state.batches[1].some((row) => row.kind === 'child_exit')).toBe(true);
    expect(JSON.stringify(status)).not.toContain('private details');
    const url = new URL(
      (state.options as { datasources: { db: { url: string } } }).datasources.db.url,
    );
    expect(url.searchParams.get('connection_limit')).toBe('1');
    expect(url.searchParams.get('connect_timeout')).toBe('2');
    expect(url.searchParams.get('pgbouncer')).toBe('true');
    await closeRemoteDiagnosticStore();
    expect(state.disconnect).toHaveBeenCalledTimes(1);
  } finally {
    if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
    if (previous === undefined) delete process.env.RUNTIME_DIAGNOSTICS;
    else process.env.RUNTIME_DIAGNOSTICS = previous;
  }
}, 10000);
