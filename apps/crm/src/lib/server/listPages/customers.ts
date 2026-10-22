import { customersFilters } from '$lib/listFilters';
import { apiFailure } from '$lib/server/api';
import type { RequestEvent } from '@sveltejs/kit';
import {
  customersApi,
  type CustomerListResponse,
} from '$lib/server/customers';

export type CustomerListStream = CustomerListResponse & { _error?: string; _status?: number };

export const load = (event: RequestEvent) => {
  const params = customersFilters(event.url);

  const listPromise: Promise<CustomerListStream> = customersApi.list(event, params).catch(
    (err): CustomerListStream => ({
      items: [],
      total: 0,
      page: 1,
      pageSize: 25,
      totalPages: 0,
      ...apiFailure(err),
    }),
  );

  return {
    filters: params,
    list: listPromise,
  };
};
