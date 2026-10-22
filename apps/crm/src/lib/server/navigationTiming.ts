import { appendFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

interface Call { stage: string; ms: number; status?: number }
interface Trace { start: number; calls: Call[]; pending: Set<Promise<unknown>> }
const traces = new WeakMap<object, Trace>();
const enabled = process.env.NODE_ENV === 'development';

export function beginNavigationTiming(locals: object) {
  if (enabled) traces.set(locals, { start: performance.now(), calls: [], pending: new Set() });
}

export async function measureNavigation<T>(locals: object, stage: string, work: () => Promise<T>): Promise<T> {
  const trace = traces.get(locals);
  if (!trace) return work();
  const start = performance.now();
  const pending = work();
  trace.pending.add(pending);
  try { return await pending; }
  finally {
    trace.calls.push({ stage, ms: Math.round((performance.now() - start) * 10) / 10 });
    trace.pending.delete(pending);
  }
}

export function backendNavigationTiming(locals: object, header: string | null) {
  const trace = traces.get(locals);
  if (!trace || !header) return;
  for (const name of ['backend-auth', 'backend-clerk', 'backend-db', 'backend-total']) {
    const value = header.match(new RegExp(`(?:^|,)\\s*${name};dur=([\\d.]+)`))?.[1];
    if (value) trace.calls.push({ stage: name, ms: Number(value) });
  }
}

export function finishNavigationTiming(locals: object, response: Response, route: string | null, data: boolean, resolveMs: number) {
  const trace = traces.get(locals);
  if (!trace) return;
  const headersMs = performance.now() - trace.start;
  response.headers.append('Server-Timing', `crm-headers;dur=${headersMs.toFixed(1)}, crm-resolve;dur=${resolveMs.toFixed(1)}, crm-clerk;dur=${Math.max(0, headersMs - resolveMs).toFixed(1)}`);
  const write = async (phase: string) => {
    const entry = { at: new Date().toISOString(), route, data, phase, status: response.status, headersMs: Math.round(headersMs), elapsedMs: Math.round(performance.now() - trace.start), calls: [...trace.calls] };
    const directory = resolve('.cache');
    await mkdir(directory, { recursive: true });
    // Route templates only: never URL parameters, IDs, user data, tokens or payloads.
    await appendFile(resolve(directory, 'crm-navigation.ndjson'), JSON.stringify(entry) + '\n');
  };
  void write('headers').catch(() => {});
  if (trace.pending.size) void Promise.allSettled([...trace.pending]).then(() => write('complete')).catch(() => {});
}
