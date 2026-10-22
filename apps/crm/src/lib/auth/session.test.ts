import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { get } from 'svelte/store';
vi.mock('$app/paths', () => ({ base: '/crm' }));
import { bindCrmSession, crmSessionState, refreshCrmSession, sessionFetch } from './session';
import { listNavigationCache } from '$lib/lists/navigationCache';

let cleanup: () => void;
beforeEach(() => {
  vi.stubGlobal('window', { location: new URL('https://crm.example.test/crm/viaturas') });
  vi.stubGlobal('fetch', vi.fn(async () => Response.json({ items: [1] })));
});
afterEach(() => { cleanup?.(); vi.unstubAllGlobals(); vi.useRealTimers(); });
describe('Clerk session recovery', () => {
  it('bounds waiting for the provider during hydration and allows a later retry', async () => {
    vi.useFakeTimers();
    const request = sessionFetch('/crm/api/tasks');
    const rejected = expect(request).rejects.toMatchObject({ status: 503 });
    await vi.advanceTimersByTimeAsync(12000);
    await rejected;
    expect(fetch).not.toHaveBeenCalled();
    cleanup = bindCrmSession(async () => 'token');
    expect((await sessionFetch('/crm/api/tasks')).status).toBe(200);
  });
  it('cancels a read while waiting for hydration without sending it after the provider mounts', async () => {
    const controller = new AbortController();
    const request = sessionFetch('/crm/api/tasks', { signal: controller.signal });
    const rejected = expect(request).rejects.toMatchObject({ name: 'AbortError' });
    controller.abort();
    await rejected;
    cleanup = bindCrmSession(async () => 'token');
    await Promise.resolve();
    expect(fetch).not.toHaveBeenCalled();
  });
  it.each(['POST', 'PATCH', 'DELETE'])('clears saved list snapshots after a successful %s', async method => {
    cleanup = bindCrmSession(async () => 'token');
    const clear = vi.spyOn(listNavigationCache, 'clear');
    await sessionFetch('/crm/api/test', { method });
    expect(clear).toHaveBeenCalledOnce();
    clear.mockRestore();
  });
  it('clears cached lists when the provider unbinds or the session identity changes', async () => {
    let identity = 'session-a';
    cleanup = bindCrmSession(async () => 'token', () => identity);
    await refreshCrmSession(false);
    const clear = vi.spyOn(listNavigationCache, 'clear');
    identity = 'session-b';
    await refreshCrmSession(false);
    expect(clear).toHaveBeenCalledOnce();
    cleanup();
    expect(clear).toHaveBeenCalledTimes(2);
    clear.mockRestore();
  });
  it('discards a token completed after the provider/session binding changes', async () => {
    let resolve!: (value: string) => void;
    cleanup = bindCrmSession(() => new Promise<string>((done) => { resolve = done; }));
    const request = sessionFetch('/crm/api/tasks');
    cleanup();
    cleanup = bindCrmSession(async () => 'new-user-token');
    resolve('old-user-token');
    await expect(request).rejects.toMatchObject({ status: 503 });
    expect(fetch).not.toHaveBeenCalled();
    expect(await refreshCrmSession()).toBe('new-user-token');
  });
  it('discards an in-flight response after switching accounts', async () => {
    let identity = 'session-1';
    let resolve!: (value: Response) => void;
    cleanup = bindCrmSession(async () => 'token', () => identity);
    vi.mocked(fetch).mockImplementationOnce(() => new Promise<Response>((done) => { resolve = done; }));
    const request = sessionFetch('/crm/api/tasks');
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    identity = 'session-2';
    resolve(Response.json({ items: ['old-user-data'] }));
    await expect(request).rejects.toMatchObject({ status: 503 });
  });
  it('does not send a request cancelled while the token was renewing', async () => {
    const controller = new AbortController();
    cleanup = bindCrmSession(async () => { controller.abort(); return 'token'; });
    await expect(sessionFetch('/crm/api/tasks', { signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' });
    expect(fetch).not.toHaveBeenCalled();
  });
  it('shares concurrent refreshes without storing tokens', async () => {
    let resolve!: (token: string) => void;
    const getter = vi.fn(() => new Promise<string>((done) => { resolve = done; }));
    cleanup = bindCrmSession(getter);
    const first = refreshCrmSession();
    const second = refreshCrmSession();
    expect(getter).toHaveBeenCalledTimes(1);
    expect(getter).toHaveBeenCalledWith({ skipCache: true });
    resolve('new-token');
    expect(await Promise.all([first, second])).toEqual(['new-token', 'new-token']);
    expect(get(crmSessionState)).toBe('ready');
  });
  it('retries a read once after401 with a fresh Clerk token', async () => {
    const getter = vi.fn().mockResolvedValueOnce('old').mockResolvedValueOnce('fresh');
    cleanup = bindCrmSession(getter);
    vi.mocked(fetch).mockResolvedValueOnce(Response.json({}, { status: 401 }));
    expect((await sessionFetch('/crm/api/vehicles')).status).toBe(200);
    expect(getter.mock.calls).toEqual([[{ skipCache: false }], [{ skipCache: true }]]);
    expect(fetch).toHaveBeenCalledTimes(2);
  });
  it.each(['POST', 'PATCH', 'DELETE'])('never replays %s and makes expired sessions visible', async (method) => {
    cleanup = bindCrmSession(async () => 'token');
    vi.mocked(fetch).mockResolvedValue(Response.json({}, { status: 401 }));
    expect((await sessionFetch('/crm/api/tasks', { method, body: '{}' })).status).toBe(401);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(get(crmSessionState)).toBe('expired');
  });
  it('keeps403 distinct from an expired session and does not retry', async () => {
    const getter = vi.fn(async () => 'token');
    cleanup = bindCrmSession(getter);
    vi.mocked(fetch).mockResolvedValue(Response.json({}, { status: 403 }));
    expect((await sessionFetch('/crm/api/tasks')).status).toBe(403);
    expect(getter).toHaveBeenCalledTimes(1);
    expect(get(crmSessionState)).toBe('ready');
  });
  it('does not submit without a live session', async () => {
    cleanup = bindCrmSession(async () => null);
    await expect(sessionFetch('/crm/api/tasks', { method: 'POST' })).rejects.toMatchObject({ status: 401 });
    expect(fetch).not.toHaveBeenCalled();
  });
  it('reports offline failures as unavailable, then recovers without logout', async () => {
    const getter = vi.fn().mockRejectedValueOnce(new TypeError('offline')).mockResolvedValueOnce('fresh');
    cleanup = bindCrmSession(getter);
    await expect(refreshCrmSession()).rejects.toMatchObject({ status: 503 });
    expect(get(crmSessionState)).toBe('unavailable');
    await refreshCrmSession();
    expect(get(crmSessionState)).toBe('ready');
  });
  it('bounds a hung SDK request and permits a subsequent retry', async () => {
    vi.useFakeTimers();
    const getter = vi.fn().mockImplementationOnce(() => new Promise(() => {})).mockResolvedValueOnce('fresh');
    cleanup = bindCrmSession(getter);
    const rejected = expect(refreshCrmSession()).rejects.toMatchObject({ status: 503 });
    await vi.advanceTimersByTimeAsync(12000);
    await rejected;
    expect(await refreshCrmSession()).toBe('fresh');
  });
  it('never sends authentication to an external origin or outside the CRM', async () => {
    cleanup = bindCrmSession(async () => 'private-token');
    for (const path of ['https://evil.test/crm/api/tasks', '/public', '/crmobile/api/tasks']) {
      await expect(sessionFetch(path)).rejects.toThrow('this CRM');
    }
    expect(fetch).not.toHaveBeenCalled();
  });
});
