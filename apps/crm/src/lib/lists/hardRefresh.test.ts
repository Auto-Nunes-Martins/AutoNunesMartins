import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { get } from 'svelte/store';
vi.mock('$app/environment', () => ({ browser: true }));
vi.mock('$app/paths', () => ({ base: '/crm' }));
import { load as customers } from '../../routes/(app)/clientes/+page';
import { load as vehicles } from '../../routes/(app)/viaturas/+page';
import { load as sales } from '../../routes/(app)/vendas/+page';
import { bindCrmSession } from '$lib/auth/session';
import { listNavigationCache } from './navigationCache';

let cleanup: (() => void) | undefined;
const payload = {
  list: { items: [{ id: 'synthetic' }], total: 1, page: 2, pageSize: 25, totalPages: 2 },
  drafts: { items: [], total: 0, page: 1, pageSize: 100, totalPages: 0 },
};
beforeEach(() => {
  listNavigationCache.clear();
  vi.stubGlobal('window', { location: new URL('https://crm.test/crm/clientes') });
  vi.stubGlobal('fetch', vi.fn(async () => Response.json(payload)));
});
afterEach(() => { cleanup?.(); cleanup = undefined; vi.unstubAllGlobals(); });

describe('hard refresh before the root session component hydrates', () => {
  it('accepts the initial successful response when the session component mounts during loading', async () => {
    let respond!: (response: Response) => void;
    vi.mocked(fetch).mockImplementation(() => new Promise<Response>(done => { respond = done; }));
    const event = {
      url: new URL('https://crm.test/crm/clientes'), depends: vi.fn(), fetch: vi.fn(),
      parent: async () => ({ clerkUserId: 'clerk-a', currentUser: { id: 'a', role: 'ADMIN' } }),
    } as any;
    const data = await customers(event) as any;
    await new Promise<void>(done => setImmediate(done));
    cleanup = bindCrmSession(async () => 'synthetic-token', () => 'session-a');
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledOnce());
    respond(Response.json(payload));
    expect(await data.list).toEqual(payload.list);
  });
  it.each([['clientes', customers, 'customers'], ['viaturas', vehicles, 'vehicles'], ['vendas', sales, 'sales']] as const)(
    '%s waits for session binding without blocking its page shell or losing filters', async (route, load, relay) => {
      const event = {
        url: new URL(`https://crm.test/crm/${route}?q=demo&page=2&sortDir=asc`),
        parent: async () => ({ clerkUserId: 'clerk-a', currentUser: { id: 'a', role: 'ADMIN' } }),
        depends: vi.fn(), fetch: vi.fn(),
      } as any;
      // SvelteKit runs universal loads before mounting SessionRecovery on a hard refresh.
      const data = await load(event) as any;
      await new Promise<void>(done => setImmediate(done));
      expect(fetch).not.toHaveBeenCalled();
      expect(get<any>(data.listView)).toMatchObject({ value: undefined, updating: true });
      cleanup = bindCrmSession(async () => 'synthetic-token', () => 'session-a');
      await data.list;
      expect(fetch).toHaveBeenCalledWith(`/crm/listas/${relay}?q=demo&page=2&sortDir=asc`,
        expect.objectContaining({ headers: expect.any(Headers) }));
      const headers = vi.mocked(fetch).mock.calls[0]![1]!.headers as Headers;
      expect(headers.get('authorization')).toBe('Bearer synthetic-token');
      expect(get<any>(data.listView)).toMatchObject({ value: payload.list, updating: false, stale: false });
      expect(get<any>(data.listView).error).toBeUndefined();
      // The initial result still seeds the immediate-revisit cache.
      vi.mocked(fetch).mockImplementationOnce(() => new Promise<Response>(() => {}));
      const revisit = await load(event) as any;
      expect(get<any>(revisit.listView)).toMatchObject({ value: payload.list, stale: true, updating: true });
    });
});
