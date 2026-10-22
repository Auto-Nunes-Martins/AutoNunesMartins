import { browser } from '$app/environment';
import { crmPath } from '$lib/paths';
import { sessionFetch, currentCrmSessionIdentity } from '$lib/auth/session';
import { createNavigationCache, listNavigationCache } from './navigationCache';
import type { VehicleListStream } from '$lib/server/listPages/vehicles';
import type { SaleListStream } from '$lib/server/listPages/sales';
import type { CustomerListStream } from '$lib/server/listPages/customers';

type Kind = 'vehicles' | 'sales' | 'customers';
type Lists = { vehicles: VehicleListStream; sales: SaleListStream; customers: CustomerListStream };
type Identity = { clerkUserId: string; currentUser: { id: string; role: string } };

function failure<T>(status: number): T {
  return {
    items: [], total: 0, page: 1, pageSize: 25, totalPages: 0,
    totals: { count: 0, revenue: '0', vat: '0', expenses: '0', commission: '0', profit: '0', avgMarginPct: 0 },
    _status: status,
    _error: status === 401 ? 'A sessão terminou. Entre novamente para continuar.'
      : status === 403 ? 'A sua conta não tem acesso a estes dados.'
      : 'Não foi possível atualizar os dados. Verifique a ligação e tente novamente.',
  } as T;
}

export function loadListPage<K extends Kind, P extends object>(kind: K,
  event: { url: URL; fetch: typeof fetch }, identity: Identity, filters: P) {
  const cache = browser ? listNavigationCache : createNavigationCache();
  if (browser) currentCrmSessionIdentity();
  cache.scope(JSON.stringify([identity.clerkUserId, identity.currentUser.id, identity.currentUser.role]));
  const url = crmPath(`/listas/${kind}`) + event.url.search;
  // This starts in the background; the universal load returns without awaiting it.
  const response = Promise.resolve().then(async () => {
    const res = await (browser ? sessionFetch(url, { cache: 'no-store' }) : event.fetch(url, { cache: 'no-store' }));
    if (!res.ok) return { list: failure<Lists[K]>(res.status), drafts: failure<VehicleListStream>(res.status) };
    return await res.json() as { list: Lists[K]; drafts?: VehicleListStream };
  });
  const key = JSON.stringify([kind, filters]);
  const list = cache.request<Lists[K]>(key, async () => (await response).list, failure);
  const drafts = cache.request<VehicleListStream>(key + ':drafts', async () =>
    (await response).drafts ?? { items: [], total: 0, page: 1, pageSize: 100, totalPages: 0 }, failure, kind === 'vehicles');
  return { filters, list: list.promise, listView: list.view, drafts: drafts.promise, draftsView: drafts.view };
}
