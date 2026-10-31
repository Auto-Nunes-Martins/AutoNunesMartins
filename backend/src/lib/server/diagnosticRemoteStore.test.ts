import { it, expect } from 'vitest';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import { installRemoteDiagnosticStore } from './diagnosticRemoteStore';
import {
  acceptDiagnosticEvents,
  recordDiagnostic,
  flushDiagnosticEvents,
} from '../../../../shared/diagnosticEvents.mjs';
it('supervisor persists a real child exit independently, retries HTTP failure and preserves event IDs', async () => {
  const batches: any[] = [];
  let calls = 0;
  const server = createServer(async (req, res) => {
    let body = '';
    for await (const part of req) body += part;
    const events = JSON.parse(body).events;
    batches.push(events);
    res.setHeader('Content-Type', 'application/json');
    if (++calls === 1) {
      res.statusCode = 503;
      res.end('{"message":"unavailable"}');
    } else res.end(String(events.length));
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const previous = process.env.RUNTIME_DIAGNOSTICS;
  process.env.RUNTIME_DIAGNOSTICS = 'true';
  const instance = randomUUID();
  const status = installRemoteDiagnosticStore({
    SUPABASE_URL: 'http://127.0.0.1:' + (server.address() as any).port,
    SUPABASE_SECRET_KEY: 'test-only-not-a-real-key',
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
      child.on('message', (message: any) => {
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
    expect(status.schemaAvailable).toBe(true);
    expect(status.eventsSaved).toBeGreaterThanOrEqual(2);
    expect(batches[1].map((row: any) => row.eventId)).toEqual(
      batches[0].map((row: any) => row.eventId),
    );
    expect(batches[1].some((row: any) => row.kind === 'child_exit')).toBe(true);
    expect(batches[1].some((row: any) => row.kind === 'boot' && row.service === 'backend')).toBe(
      true,
    );
  } finally {
    if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
    if (previous === undefined) delete process.env.RUNTIME_DIAGNOSTICS;
    else process.env.RUNTIME_DIAGNOSTICS = previous;
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}, 10000);
