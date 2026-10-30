import { sessionFetch } from '$lib/auth/session';

type Metrics = Record<string, number>;
const prepared = new WeakMap<Blob, Metrics>();
/** Explicit browser opt-in. No file names, paths, plates, user IDs or image data. */
export function photoDiagnosticsEnabled() {
  try {
    return (
      typeof window !== 'undefined' &&
      (import.meta.env.VITE_PHOTO_DIAGNOSTICS === 'true' ||
        localStorage.getItem('anm:photo-diagnostics') === 'true')
    );
  } catch {
    return false;
  }
}
function sendTransfer(
  input: string,
  metrics: { trace: string; transferMs: number; status?: number; outcome: string },
) {
  // One bounded best-effort event. It must never delay/retry the photo or hold its File.
  void sessionFetch(input + '/diagnostics', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(metrics),
  }).catch(() => {});
}
export function recordPreparation(
  original: File,
  output: File | undefined,
  queuedAt: number,
  startedAt: number,
  dimensions: Metrics = {},
) {
  if (!photoDiagnosticsEnabled()) return;
  const metrics = {
    originalBytes: original.size,
    preparedBytes: output?.size ?? 0,
    queueMs: Math.max(0, startedAt - queuedAt),
    preparationMs: Math.max(0, performance.now() - startedAt),
    ...dimensions,
  };
  if (output) prepared.set(output, metrics);
  console.info(
    JSON.stringify({
      event: 'photo_client_diagnostics',
      kind: 'preparation',
      outcome: output ? 'ok' : 'error',
      ...metrics,
    }),
  );
}
export async function photoUpload(input: string, init: RequestInit): Promise<Response> {
  if (!photoDiagnosticsEnabled()) return sessionFetch(input, init);
  const trace = crypto.randomUUID(),
    started = performance.now(),
    headers = new Headers(init.headers);
  const file = init.body instanceof Blob ? init.body : undefined;
  headers.set('x-photo-trace-id', trace);
  headers.set(
    'x-photo-metrics',
    JSON.stringify({ ...((file && prepared.get(file)) ?? {}), preparedBytes: file?.size ?? 0 }),
  );
  try {
    const response = await sessionFetch(input, { ...init, headers });
    const transferMs = performance.now() - started,
      outcome = response.ok ? 'ok' : 'error';
    console.info(
      JSON.stringify({
        event: 'photo_client_diagnostics',
        kind: 'transfer',
        trace,
        transferMs,
        status: response.status,
        outcome,
        serverEnabled: response.headers.get('x-photo-diagnostics-enabled') === 'true',
      }),
    );
    if (response.headers.get('x-photo-diagnostics-enabled') === 'true')
      sendTransfer(input, { trace, transferMs, status: response.status, outcome });
    return response;
  } catch (error) {
    const transferMs = performance.now() - started;
    console.info(
      JSON.stringify({
        event: 'photo_client_diagnostics',
        kind: 'transfer',
        trace,
        transferMs,
        outcome: 'network_error',
      }),
    );
    sendTransfer(input, { trace, transferMs, outcome: 'network_error' });
    throw error;
  }
}
