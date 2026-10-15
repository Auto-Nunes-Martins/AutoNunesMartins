import type { PageServerLoad } from './$types';
import { loadPublicBrands } from '$lib/server/publicBrands';
import { loadHomepageHighlights } from '$lib/server/homepageHighlights';
import { loadPublicStock } from '$lib/server/publicVehicles';

export const load: PageServerLoad = async ({ setHeaders }) => {
  setHeaders({ 'cache-control': 'no-store' });
  const [brandDirectory, highlights, stock] = await Promise.all([
    loadPublicBrands(), loadHomepageHighlights(), loadPublicStock(new URLSearchParams({ pageSize: '30' })),
  ]);
  return { brandDirectory, highlights, stock };
};
