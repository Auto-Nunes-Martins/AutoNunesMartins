import { error } from '@sveltejs/kit';
import { loadPublicVehicle, loadRelatedVehicles } from '$lib/server/publicVehicles';
import type { PageServerLoad } from './$types';
export const load: PageServerLoad = async ({ params, setHeaders }) => {
  setHeaders({ 'cache-control': 'no-store' });
  // Suggestions are independent and below the vehicle. They must not delay opening its details.
  const relatedVehicles = loadRelatedVehicles(params.slug);
  const result = await loadPublicVehicle(params.slug);
  if (!result.vehicle) {
    if (result.status === 503) setHeaders({ 'retry-after': '120' });
    error(result.status === 404 ? 404 : 503, {
      message:
        result.status === 404
          ? 'Esta viatura já não está disponível.'
          : 'A ficha está temporariamente indisponível.',
      ...('unavailableVehicle' in result && result.unavailableVehicle
        ? { unavailableVehicle: result.unavailableVehicle }
        : {}),
    });
  }
  return { vehicle: result.vehicle, relatedVehicles };
};
