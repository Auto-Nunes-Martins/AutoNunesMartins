import { vehiclesFilters } from '$lib/listFilters';
import type { RequestEvent } from '@sveltejs/kit';
import { apiFailure } from '$lib/server/api';
import {
  vehiclesApi,
  type VehicleListResponse,
} from '$lib/server/vehicles';

export type VehicleListStream =
  | (VehicleListResponse & { _error?: undefined; _status?: undefined })
  | {
      items: VehicleListResponse['items'];
      total: number;
      page: number;
      pageSize: number;
      totalPages: number;
      _error: string;
      _status: number;
    };

export const load = (event: RequestEvent) => {
  const params = vehiclesFilters(event.url);

  // Streamed: returning a promise (not awaiting) lets SvelteKit render the page
  // shell + skeleton immediately, then stream the data into the {#await}.
  const listPromise: Promise<VehicleListStream> = vehiclesApi.list(event, params).catch(
    (err): VehicleListStream => ({
      items: [],
      total: 0,
      page: 1,
      pageSize: 25,
      totalPages: 0,
      ...apiFailure(err),
    }),
  );

  // Fetch DRAFTs em paralelo, no-pagination (cap a 100 — para um stand
  // pequeno é mais do que suficiente). Mostrados em secção destacada
  // entre os filtros e a tabela principal para o vendedor não esquecer
  // que tem viaturas por publicar.
  const draftsPromise: Promise<VehicleListStream> =
    params.status || params.agedStock
      ? Promise.resolve({ items: [], total: 0, page: 1, pageSize: 100, totalPages: 0 })
      : vehiclesApi
          .list(event, {
            status: 'DRAFT',
            page: 1,
            pageSize: 100,
            sortBy: 'createdAt',
            sortDir: 'desc',
          })
          .catch(
            (err): VehicleListStream => ({
              items: [],
              total: 0,
              page: 1,
              pageSize: 100,
              totalPages: 0,
              ...apiFailure(err),
            }),
          );

  return {
    filters: params,
    list: listPromise,
    drafts: draftsPromise,
  };
};
