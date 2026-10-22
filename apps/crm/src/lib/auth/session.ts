import { writable } from 'svelte/store';
import { crmPath } from '$lib/paths';
import { listNavigationCache } from '$lib/lists/navigationCache';

export type SessionState = 'ready' | 'recovering' | 'expired' | 'unavailable';
export const crmSessionState = writable<SessionState>('ready');
type TokenGetter = (options: { skipCache: boolean }) => Promise<string | null>;
let tokenGetter: TokenGetter | null = null;
let sessionIdentity: (() => string | null | undefined) | null = null;
let pending: Promise<string> | null = null;
let navigationDeferred = false;
let lastIdentity: string | null | undefined;
const bindingWaiters = new Set<() => void>();

/** Universal loads run before SessionRecovery mounts during browser hydration. */
async function waitForSessionBinding(signal?: AbortSignal | null): Promise<void> {
  signal?.throwIfAborted();
  if (tokenGetter) return;
  await new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      clearTimeout(timeout);
      bindingWaiters.delete(ready);
      signal?.removeEventListener('abort', abort);
    };
    const ready = () => { cleanup(); resolve(); };
    const abort = () => { cleanup(); reject(signal?.reason ?? new DOMException('Aborted', 'AbortError')); };
    const timeout = setTimeout(() => { cleanup(); reject(new SessionUnavailable(503)); }, 12000);
    bindingWaiters.add(ready);
    signal?.addEventListener('abort', abort, { once: true });
  });
  if (!tokenGetter) throw new SessionUnavailable(401);
}
export function currentCrmSessionIdentity() {
  const identity = sessionIdentity?.();
  if (lastIdentity !== undefined && identity !== lastIdentity) listNavigationCache.clear(401);
  lastIdentity = identity;
  return identity;
}
export function deferSessionNavigation(value: boolean) { navigationDeferred = value; }
export function isSessionNavigationDeferred() { return navigationDeferred; }

export class SessionUnavailable extends Error {
  constructor(public readonly status: number) {
    super(status === 401
      ? 'A sessão terminou. Entre novamente para continuar.'
      : 'Não foi possível validar a sessão. Verifique a ligação e tente novamente.');
  }
}

export function bindCrmSession(getter: TokenGetter, identity: () => string | null | undefined = () => null) {
  tokenGetter = getter;
  sessionIdentity = identity;
  pending = null;
  crmSessionState.set('ready');
  for (const ready of bindingWaiters) ready();
  return () => {
    if (tokenGetter === getter) {
      tokenGetter = null;
      sessionIdentity = null;
      pending = null;
      lastIdentity = undefined;
      listNavigationCache.clear(401);
    }
  };
}

/** Refresh via Clerk only; no tokens are persisted by the CRM. */
export async function refreshCrmSession(force = true): Promise<string | null> {
  if (!tokenGetter) return null; // SSR and isolated component previews.
  if (pending) return pending;
  const getter = tokenGetter;
  pending = (async () => {
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      if (force) crmSessionState.set('recovering');
      const token = await Promise.race([
        getter({ skipCache: force }),
        new Promise<never>((_, reject) => {
          timeout = setTimeout(() => reject(new SessionUnavailable(503)), 12000);
        }),
      ]);
      if (tokenGetter !== getter) throw new SessionUnavailable(503);
      if (!token) throw new SessionUnavailable(401);
      currentCrmSessionIdentity();
      if (tokenGetter === getter) crmSessionState.set('ready');
      return token;
    } catch (error) {
      const failure = error instanceof SessionUnavailable ? error : new SessionUnavailable(503);
      if (failure.status === 401) listNavigationCache.clear(401);
      if (tokenGetter === getter) crmSessionState.set(failure.status === 401 ? 'expired' : 'unavailable');
      throw failure;
    } finally {
      clearTimeout(timeout);
      if (tokenGetter === getter) pending = null;
    }
  })();
  return pending;
}

export function sessionRejected() {
  listNavigationCache.clear(401);
  crmSessionState.set('expired');
}

/** Same-origin CRM relays only. Reads get one recovery attempt; writes never replay. */
export async function sessionFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const url = new URL(input, window.location.href);
  const prefix = crmPath('/');
  if (url.origin !== window.location.origin || !url.pathname.startsWith(prefix)) {
    throw new Error('Authenticated requests must target this CRM.');
  }
  // Never start with a null provider and then mistake its initial mount for an
  // account switch when the response arrives. Token/SDK readiness is checked next.
  if (!tokenGetter) await waitForSessionBinding(init.signal);
  const headers = new Headers(init.headers);
  const send = async (force: boolean) => {
    const token = await refreshCrmSession(force);
    init.signal?.throwIfAborted();
    const getter = tokenGetter;
    const identity = sessionIdentity?.();
    if (token) headers.set('authorization', `Bearer ${token}`);
    if (!headers.has('accept')) headers.set('accept', 'application/json');
    const response = await fetch(input, { ...init, headers, redirect: 'manual' });
    if (getter !== tokenGetter || identity !== sessionIdentity?.()) {
      throw new SessionUnavailable(503);
    }
    return response;
  };
  let response = await send(false);
  if (response.status === 401 && ['GET', 'HEAD'].includes((init.method ?? 'GET').toUpperCase())) {
    response = await send(true);
  }
  if (response.status === 401) sessionRejected();
  if (response.status === 403 || (response.ok && !['GET', 'HEAD', 'OPTIONS'].includes((init.method ?? 'GET').toUpperCase()))) {
    listNavigationCache.clear();
  }
  return response;
}
