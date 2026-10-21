import { describe, it, expect, vi } from 'vitest';
vi.mock('$app/paths', () => ({ base: '/crm' }));
vi.mock('svelte-clerk/server', () => ({
  withClerkHandler:
    () =>
    async ({ event, resolve }: any) =>
      resolve(event),
}));
vi.mock('@sveltejs/kit/hooks', () => ({
  sequence:
    (...handlers: any[]) =>
    ({ event, resolve }: any) => {
      const run = (index: number, current: any): any =>
        handlers[index]
          ? handlers[index]({ event: current, resolve: (next: any) => run(index + 1, next) })
          : resolve(current);
      return run(0, event);
    },
}));
import { handle } from './hooks.server';
import { crmPath, crmRoute } from './lib/paths';
const invoke = (path: string, userId: string | null = null, method = 'GET', origin?: string) =>
  handle({
    event: {
      url: new URL('https://trial.onrender.com' + path),
      request: new Request('https://trial.onrender.com' + path, {
        method,
        headers: { accept: 'text/html', ...(origin ? { origin } : {}) },
      }),
      locals: { auth: () => ({ userId }) },
    },
    resolve: async () => new Response('fixture'),
  } as any);
describe('CRM prefix and server security', () => {
  it('returns explicit 401 for relays and enhanced actions without redirecting to login HTML', async () => {
    for (const action of [false, true]) {
      const result = await handle({
        event: {
          url: new URL('https://trial.onrender.com/crm/api/users'),
          request: new Request('https://trial.onrender.com/crm/api/users', {
            headers: { accept: 'application/json', ...(action ? { 'x-sveltekit-action': 'true' } : {}) },
          }),
          locals: { auth: () => ({ userId: null }) },
        },
        resolve: vi.fn(() => { throw new Error('must not resolve'); }),
      } as any);
      expect(result.status).toBe(401);
      expect(result.headers.has('location')).toBe(false);
      expect(result.headers.get('content-type')).toContain('application/json');
      expect(result.headers.get('cache-control')).toBe('private, no-store');
      const body = await result.json();
      if (action) expect(body).toMatchObject({ type: 'error', status: 401 });
    }
  });
  it('prefixes links, assets, actions and strips only the exact base boundary', () => {
    for (const path of [
      '/dashboard',
      '/a-entrar',
      '/viaturas/car/photos',
      '/logo-transparent.png',
      '/api/users',
    ])
      expect(crmPath(path)).toBe('/crm' + path);
    expect(crmPath('/')).toBe('/crm/');
    expect(crmRoute('/crm/viaturas')).toBe('/viaturas');
    expect(crmRoute('/crmobile')).toBe('/crmobile');
    expect(() => crmPath('//evil.test')).toThrow();
  });
  it('guards private endpoints as well as pages without invoking resolve', async () => {
    for (const path of [
      '/crm/dashboard',
      '/crm/a-entrar',
      '/crm/api/users',
      '/crm/tarefas/a/status',
    ]) {
      const result = await invoke(path);
      expect(result.status).toBe(303);
      expect(result.headers.get('location')).toBe('/crm/');
      expect(result.headers.get('x-robots-tag')).toBe('noindex, nofollow');
      expect(result.headers.get('cache-control')).toBe('private, no-store');
    }
    expect((await invoke('/crm/')).status).toBe(200);
  });
  it('permits authenticated invited users and rejects cross-origin actions', async () => {
    expect((await invoke('/crm/dashboard', 'user_admin')).status).toBe(200);
    expect((await invoke('/crm/a-entrar', 'user_admin')).status).toBe(200);
    expect((await invoke('/crm/dashboard', 'user_other')).status).toBe(200);
    expect((await invoke('/crm/api/users', 'user_other')).status).toBe(200);
    expect((await invoke('/crm/api/tasks', 'user_admin', 'POST', 'https://evil.test')).status).toBe(
      403,
    );
    expect(
      (await invoke('/crm/api/tasks', 'user_admin', 'POST', 'https://trial.onrender.com')).status,
    ).toBe(200);
    expect((await invoke('/crm/api/tasks', 'user_admin', 'POST')).status).toBe(403);
  });
});
