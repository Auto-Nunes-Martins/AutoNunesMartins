import { beforeEach, describe, expect, it, vi } from 'vitest';
import { get } from 'svelte/store';
const mocks = vi.hoisted(() => ({ browser: true, fetch: vi.fn(), identity: vi.fn() }));
vi.mock('$app/environment', () => ({ get browser() { return mocks.browser; } }));
vi.mock('$app/paths', () => ({ base: '/crm' }));
vi.mock('$lib/auth/session', () => ({ sessionFetch: mocks.fetch, currentCrmSessionIdentity: mocks.identity }));
import { load as vehicles } from '../../routes/(app)/viaturas/+page';
import { load as sales } from '../../routes/(app)/vendas/+page';
import { load as customers } from '../../routes/(app)/clientes/+page';
import { listNavigationCache } from './navigationCache';
const list = (name: string) => ({ items: [{ id: name }], page: 1, pageSize: 25, total: 1, totalPages: 1 });
const user = { clerkUserId: 'clerk-a', currentUser: { id: 'a', role: 'ADMIN' } };
const event = (route: string, query = '') => ({
  url: new URL(`https://crm.test/crm/${route}${query}`), depends: vi.fn(),
  parent: async () => user, fetch: vi.fn(),
}) as any;
beforeEach(() => { listNavigationCache.clear(); vi.clearAllMocks(); mocks.browser = true; });

describe('universal list navigation loads', () => {
  it.each([['viaturas', vehicles], ['vendas', sales], ['clientes', customers]] as const)(
    '%s returns cached content while its relay response is still pending', async (route, load) => {
      mocks.fetch.mockResolvedValueOnce(Response.json({ list: list('old'), drafts: list('draft') }));
      const first = await load(event(route)) as any;
      await first.list; await first.drafts;
      let resolve!: (response: Response) => void;
      mocks.fetch.mockImplementationOnce(() => new Promise<Response>(done => { resolve = done; }));
      const revisit = await load(event(route)) as any;
      expect(get<any>(revisit.listView)).toMatchObject({ value: list('old'), stale: true, updating: true });
      expect(event(route).fetch).not.toHaveBeenCalled();
      resolve(Response.json({ list: list('new'), drafts: list('new-draft') })); await revisit.list;
      expect(get<any>(revisit.listView)).toMatchObject({ value: list('new'), stale: false, updating: false });
    });
  it('uses the complete parsed filter key and the correct same-origin relay query', async () => {
    mocks.fetch.mockResolvedValue(Response.json({ list: list('filtered'), drafts: list('draft') }));
    const first = await vehicles(event('viaturas', '?q=demo&page=2&sortBy=year&sortDir=asc')) as any;
    await first.list;
    expect(mocks.fetch).toHaveBeenCalledWith('/crm/listas/vehicles?q=demo&page=2&sortBy=year&sortDir=asc', { cache: 'no-store' });
    mocks.fetch.mockImplementation(() => new Promise<Response>(() => {}));
    const other = await vehicles(event('viaturas', '?q=other&page=2&sortBy=year&sortDir=asc')) as any;
    expect(get<any>(other.listView).value).toBeUndefined();
  });
  it('keeps last successful rows with a visible stale/failure state on a network error', async () => {
    mocks.fetch.mockResolvedValueOnce(Response.json({ list: list('old') }));
    const first = await sales(event('vendas')) as any; await first.list;
    mocks.fetch.mockRejectedValueOnce(Error('offline'));
    const failed = await sales(event('vendas')) as any; await failed.list;
    expect(get<any>(failed.listView)).toMatchObject({ value: list('old'), stale: true, updating: false });
    expect(get<any>(failed.listView).error).toBeTruthy();
  });
  it('never uses browser cache/session transport for SSR', async () => {
    mocks.browser = false;
    const serverEvent = event('clientes');
    serverEvent.fetch.mockResolvedValue(Response.json({ list: list('server') }));
    const rendered = await customers(serverEvent) as any; await rendered.list;
    expect(serverEvent.fetch).toHaveBeenCalledWith('/crm/listas/customers', { cache: 'no-store' });
    expect(mocks.fetch).not.toHaveBeenCalled();
    expect(mocks.identity).not.toHaveBeenCalled();
  });
});
