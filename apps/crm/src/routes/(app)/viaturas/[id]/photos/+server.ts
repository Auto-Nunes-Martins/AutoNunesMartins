import { json, type RequestHandler } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { PUBLIC_BACKEND_URL } from '$env/static/public';
import { getApiToken } from '$lib/server/api';
import { getProcessDiagnostics, clientMetrics } from '$lib/server/runtimeDiagnostics';
const diagnostics = getProcessDiagnostics('crm');
export const POST: RequestHandler = async (event) => {
  const token = await getApiToken(event);
  if (!token) return json({ error: 'Unauthorized' }, { status: 401 });
  const trace = diagnostics.begin(
    event.request.headers.get('x-photo-trace-id') ?? undefined,
    clientMetrics(event.request.headers.get('x-photo-metrics')),
  );
  let outcome: 'ok' | 'error' = 'error',
    status = 502;
  try {
    trace.phase('receive');
    // Stream through the relay; global admission and byte/pixel limits live in Express.
    const response = await fetch(
      new URL(
        '/api/vehicles/' + event.params.id + '/photos',
        env.INTERNAL_BACKEND_URL || PUBLIC_BACKEND_URL,
      ),
      {
        method: 'POST',
        redirect: 'manual',
        credentials: 'omit',
        body: event.request.body,
        duplex: 'half',
        headers: {
          'content-type': event.request.headers.get('content-type') || '',
          authorization: 'Bearer ' + token,
          ...(event.request.headers.has('x-upload-id')
            ? { 'x-upload-id': event.request.headers.get('x-upload-id')! }
            : {}),
          ...(event.request.headers.get('x-edit-stage') === 'true'
            ? { 'x-edit-stage': 'true' }
            : {}),
          ...(trace.id
            ? { 'x-photo-trace-id': trace.id }
            : event.request.headers.get('x-photo-trace-id')?.length === 36
              ? { 'x-photo-trace-id': event.request.headers.get('x-photo-trace-id')! }
              : {}),
          ...(event.request.headers.get('x-photo-metrics') &&
          event.request.headers.get('x-photo-metrics')!.length <= 1024
            ? { 'x-photo-metrics': event.request.headers.get('x-photo-metrics')! }
            : {}),
        },
        signal: AbortSignal.timeout(180000),
      } as RequestInit & { duplex: string },
    );
    status = response.status;
    outcome = response.ok ? 'ok' : 'error';
    trace.phase('finalize');
    return json(await response.json().catch(() => ({})), {
      status: response.status,
      headers: {
        ...(response.headers.has('retry-after')
          ? { 'retry-after': response.headers.get('retry-after')! }
          : {}),
        ...(response.headers.has('x-photo-trace-id')
          ? { 'x-photo-trace-id': response.headers.get('x-photo-trace-id')! }
          : {}),
        ...(response.headers.get('x-photo-diagnostics-enabled') === 'true'
          ? { 'x-photo-diagnostics-enabled': 'true' }
          : {}),
      },
    });
  } finally {
    trace.finish(event.request.signal.aborted ? 'aborted' : outcome, { status });
  }
};
