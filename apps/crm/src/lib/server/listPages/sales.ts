import { salesFilters } from '$lib/listFilters';
import { apiFailure } from '$lib/server/api';
import type { RequestEvent } from '@sveltejs/kit';
import {
  salesApi,
  type SaleListResponse,
} from '$lib/server/sales';

export type SaleListStream = SaleListResponse & { _error?: string; _status?: number };

export const load = (event: RequestEvent) => {
  const params = salesFilters(event.url);

  // Streamed list so the page shell + filter chrome render immediately and
  // the table flows in once the API returns.
  const listPromise: Promise<SaleListStream> = salesApi.list(event, params).catch(
    (err): SaleListStream => ({
      items: [],
      total: 0,
      page: 1,
      pageSize: 25,
      totalPages: 0,
      totals: {
        count: 0,
        revenue: '0',
        vat: '0',
        expenses: '0',
        commission: '0',
        profit: '0',
        avgMarginPct: 0,
      },
      ...apiFailure(err),
    }),
  );

  return {
    filters: params,
    list: listPromise,
  };
};
