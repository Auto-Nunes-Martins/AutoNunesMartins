import { env } from '$env/dynamic/private';
import { PUBLIC_BACKEND_URL } from '$env/static/public';
import { error as httpError, type RequestEvent } from '@sveltejs/kit';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: unknown,
    message?: string,
  ) {
    super(message ?? `API error ${status}`);
    this.name = 'ApiError';
  }
}

export function apiErrorMessage(status?: number): string {
  if (status === 401) return 'Não foi possível validar a sessão. Tente novamente ou entre na sua conta.';
  if (status === 403) return 'A sua conta não tem acesso a estes dados.';
  return 'Não foi possível carregar os dados. Verifique a ligação e tente novamente.';
}

export function apiFailure(error: unknown) {
  const status = error instanceof ApiError ? error.status : 503;
  return { _error: apiErrorMessage(status), _status: status };
}

/** Optional UI data may be absent, but access failures must never mean empty data. */
export function rethrowAuthError(error: unknown): void {
  if (error instanceof ApiError && [401, 403].includes(error.status)) {
    httpError(error.status, apiErrorMessage(error.status));
  }
}

// Share a refresh only within this request, never across users or requests.
const refreshedTokens = new WeakMap<App.Locals, Promise<string | null>>();
export async function getApiToken(event: Pick<RequestEvent, 'locals'>, force = false) {
  const auth = event.locals.auth();
  if (!auth.userId) return null;
  const expires = auth.sessionClaims?.exp;
  if (!force && (typeof expires !== 'number' || expires * 1000 > Date.now() + 15000)) {
    return auth.getToken();
  }
  let pending = refreshedTokens.get(event.locals);
  if (!pending) {
    // Server getToken() otherwise returns the original request JWT. This SDK
    // option asks Clerk to mint a fresh token for the already verified session.
    pending = auth.getToken({ expiresInSeconds: 60 });
    refreshedTokens.set(event.locals, pending);
  }
  return pending;
}

/**
 * Authenticated server-side fetch from a SvelteKit load function or form action.
 * Pulls the Clerk session token via `locals.auth()` and attaches it as Bearer.
 */
export async function apiFetch(
  event: Pick<RequestEvent, 'locals' | 'fetch'>,
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const token = await getApiToken(event);
  if (!token) return Response.json({ error: apiErrorMessage(401) }, { status: 401 });

  const headers = new Headers(init.headers);
  headers.set('authorization', `Bearer ${token}`);
  headers.delete('cookie');
  if (!headers.has('accept')) headers.set('accept', 'application/json');
  if (init.body && !headers.has('content-type')) {
    headers.set('content-type', 'application/json');
  }

  const url = `${env.INTERNAL_BACKEND_URL || PUBLIC_BACKEND_URL}${path}`;
  const send = () => event.fetch(url, { ...init, headers, credentials: 'omit', redirect: 'manual' });
  let response = await send();
  // A JWT can expire between the CRM and the API. Retry a read once using
  // Clerk, but never replay a mutation or a streamed upload.
  if (response.status === 401 && ['GET', 'HEAD'].includes((init.method ?? 'GET').toUpperCase())) {
    const freshToken = await getApiToken(event, true);
    if (freshToken && freshToken !== token) {
      headers.set('authorization', `Bearer ${freshToken}`);
      response = await send();
    }
  }
  return response;
}

export async function apiJson<T>(
  event: Pick<RequestEvent, 'locals' | 'fetch'>,
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const res = await apiFetch(event, path, init);
  if (!res.ok) {
    const text = await res.text();
    let body: unknown = text;
    try {
      body = JSON.parse(text);
    } catch { /* Non-JSON errors still retain their HTTP status. */ }
    const status = res.status >= 400 ? res.status : 502;
    throw new ApiError(status, body, apiErrorMessage(status));
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
