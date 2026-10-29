import { json } from '@sveltejs/kit';
import { publicRequest } from '$lib/server/publicVehicles';
import { publicVehicleSchema } from '$lib/publicVehicles';
import { slugPattern } from '$lib/publicVehicles';
import type { RequestHandler } from './$types';
import { unavailableVehicleSchema } from '$lib/unavailableVehicle';

// Reuse the same permission-checked summary and surviving photo as the old detail URL.
// No snapshot is stored and no private vehicle endpoint is consulted.
async function unavailableSummary(id: string) {
  try {
    const response = await publicRequest(`/${id}`);
    if (response.status !== 404) return;
    const data = await response.json();
    const parsed = unavailableVehicleSchema.safeParse(data?.unavailableVehicle);
    if (parsed.success && parsed.data.slug === id) return parsed.data;
  } catch { /* The favorite remains saved even if its identifying data is unavailable. */ }
}

export const GET: RequestHandler = async ({ url }) => {
  const ids = url.searchParams.getAll('id');
  const headers = { 'cache-control': 'no-store' };
  if ([...url.searchParams.keys()].some(key => key !== 'id') || ids.length > 3 ||
      new Set(ids).size !== ids.length || ids.some(id => id.length > 180 || !slugPattern.test(id))) {
    return json({ error: 'Seleção inválida.' }, { status: 400, headers });
  }
  if (!ids.length) return json({ items: [] }, { headers });
  try {
    const response = await publicRequest(`/selection?${new URLSearchParams(ids.map(id => ['id', id]))}`);
    if (!response.ok) throw Error('Unavailable');
    const data = await response.json();
    const items = await Promise.all(ids.map(async id => {
      const item = Array.isArray(data.items) ? data.items.find((entry: { id?: string } | null) => entry?.id === id) : null;
      if (item?.status === 404) {
        const unavailableVehicle = await unavailableSummary(id);
        return { id, status: 404, vehicle: null, ...(unavailableVehicle ? { unavailableVehicle } : {}) };
      }
      const parsed = publicVehicleSchema.safeParse(item?.vehicle);
      if (item?.status !== 200 || !parsed.success || parsed.data.slug !== id) return { id, status: 503, vehicle: null };
      const versions = item.photoVersions;
      const valid = Array.isArray(versions) && versions.length === parsed.data.photos.length && versions.length <= 20 && versions.every((v: unknown) => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v));
      return { id, status: 200, vehicle: parsed.data, ...(valid ? { photoVersions: versions } : {}) };
    }));
    return json({ items }, { headers });
  } catch { return json({ items: ids.map(id => ({ id, status: 503, vehicle: null })) }, { headers }); }
};
