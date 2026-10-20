import { publicVehicleCanonical } from './vehicleStructuredData';
import type { PublicVehicle } from './publicVehicles';

export function vehicleShareData(
  vehicle: Pick<PublicVehicle, 'slug' | 'brand' | 'model' | 'year'>,
  origin: string,
) {
  return {
    title: `${vehicle.brand} ${vehicle.model} (${vehicle.year})`,
    url: publicVehicleCanonical(vehicle, new URL(origin).origin),
  };
}

type ShareServices = {
  share?: (data: { title: string; url: string }) => Promise<void>;
  copy?: (text: string) => Promise<void>;
};

/** Called only from the visitor's click; never sends to a destination automatically. */
export async function shareVehicle(data: { title: string; url: string }, services: ShareServices) {
  if (services.share) {
    try {
      await services.share(data);
      return 'shared' as const;
    } catch (error) {
      if (error && typeof error === 'object' && 'name' in error && error.name === 'AbortError')
        return 'cancelled' as const;
    }
  }
  if (services.copy) {
    try {
      await services.copy(data.url);
      return 'copied' as const;
    } catch {
      /* Manual recovery below. */
    }
  }
  return 'manual' as const;
}
