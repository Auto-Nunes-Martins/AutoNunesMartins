import type { PageServerLoad } from './$types';
import { loadPublicBrands } from '$lib/server/publicBrands';
import { loadHomepageHighlights } from '$lib/server/homepageHighlights';
import { loadPublicStock } from '$lib/server/publicVehicles';
import { loadReviews } from '$lib/server/reviews';

export const load: PageServerLoad = async ({ setHeaders }) => {
  setHeaders({ 'cache-control': 'no-store' });
  const [brandDirectory, highlights, stock, reviews] = await Promise.all([
    loadPublicBrands(), loadHomepageHighlights(), loadPublicStock(new URLSearchParams({ pageSize: '30' })),
    loadReviews(),
  ]);
  return { brandDirectory, highlights, stock, reviews };
};
