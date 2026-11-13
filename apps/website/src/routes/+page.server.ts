import type { PageServerLoad } from './$types';
import { loadPublicBrands } from '$lib/server/publicBrands';
import { loadHomepageHighlights } from '$lib/server/homepageHighlights';
import type { PublicHighlights } from '$lib/homepageHighlights';
import { loadPublicCampaigns, loadPublicStock } from '$lib/server/publicVehicles';
import { loadReviews } from '$lib/server/reviews';

export const load: PageServerLoad = async ({ setHeaders }) => {
  setHeaders({ 'cache-control': 'no-store' });
  let readyHighlights: PublicHighlights | undefined;
  const highlights = loadHomepageHighlights().then((result) => (readyHighlights = result));
  const [brandDirectory, stock, reviews, campaigns] = await Promise.all([
    loadPublicBrands(),
    loadPublicStock(new URLSearchParams({ pageSize: '30' })),
    loadReviews(),
    loadPublicCampaigns(),
  ]);
  // Keep the server-rendered card and photo preload when the data is already available.
  return { brandDirectory, highlights: readyHighlights ?? highlights, stock, reviews, campaigns };
};
