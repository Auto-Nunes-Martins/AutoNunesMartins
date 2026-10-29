import { publicVehicleSchema, publicPhoto, type PublicVehicle } from './publicVehicles';
import { unavailableVehicleSchema, type UnavailableVehicle } from './unavailableVehicle';
export type SelectionIdentity = { brand: string; model: string; year: number; photo: string | null; preview?: HTMLCanvasElement };
export type SelectedVehicle = { id: string; status: number; vehicle: PublicVehicle | null; photoVersions?: string[]; unavailableVehicle?: UnavailableVehicle; lastKnownIdentity?: SelectionIdentity };

/** Identity only, scoped to the open page; never cache price, specifications or availability after failure. */
export function selectionIdentity(entry: SelectedVehicle): SelectionIdentity | undefined {
  const known = entry.vehicle ?? entry.unavailableVehicle;
  return known ? { brand: known.brand, model: known.model, year: known.year,
    photo: entry.vehicle ? entry.vehicle.photos.length ? publicPhoto(entry.vehicle, 0) : null : entry.unavailableVehicle!.photo } : entry.lastKnownIdentity;
}
export function retainSelectionIdentity(fresh: SelectedVehicle[], memory: Map<string, SelectionIdentity>) {
  return fresh.map(entry => {
    if (entry.status === 503) {
      const identity = memory.get(entry.id);
      return identity ? { ...entry, lastKnownIdentity: identity } : entry;
    }
    const identity = selectionIdentity(entry);
    if (identity) memory.set(entry.id, identity); else memory.delete(entry.id);
    return entry;
  });
}
export function rememberSelectionIdentity(entries: SelectedVehicle[], memory: Map<string, SelectionIdentity>, root?: ParentNode | null) {
  for (const entry of entries) {
    const identity = selectionIdentity(entry);
    if (!identity) continue;
    const image = root?.querySelector<HTMLImageElement>(`[data-selection-id="${entry.id}"] img`);
    // Reuse already displayed pixels (including the existing thumbnail cache's blob),
    // without making a new persistent copy or claiming fresh photo authorization.
    if (image?.complete && image.naturalWidth && !image.src.includes('catalog-placeholder')) {
      const photo = image.currentSrc || image.src;
      let preview = memory.get(entry.id)?.photo === photo ? memory.get(entry.id)?.preview : undefined;
      if (!preview) {
        const canvas = document.createElement('canvas'), scale = Math.min(1, 640 / image.naturalWidth);
        canvas.width = Math.round(image.naturalWidth * scale); canvas.height = Math.round(image.naturalHeight * scale);
        try { const context = canvas.getContext('2d'); if (context) { context.drawImage(image,0,0,canvas.width,canvas.height); preview = canvas; } } catch { /* Identification remains usable if pixels cannot be copied. */ }
      }
      memory.set(entry.id, { ...identity, photo, ...(preview ? { preview } : {}) });
    } else memory.set(entry.id, { ...identity, ...(memory.get(entry.id)?.preview ? { preview: memory.get(entry.id)!.preview, photo: memory.get(entry.id)!.photo } : {}) });
  }
  // Bound decoded previews to two favorite pages; older identities remain lightweight.
  const previews = [...memory.values()].filter(identity => identity.preview);
  for (const identity of previews.slice(0, Math.max(0, previews.length - 24))) delete identity.preview;
}

/** The public BFF bounds each request to three IDs. Favorites request only their visible page. */
export async function loadSelectedVehicles(ids: string[], signal: AbortSignal): Promise<SelectedVehicle[]> {
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += 3) chunks.push(ids.slice(i, i + 3));
  return (await Promise.all(chunks.map(async selected => {
    try {
      const params = new URLSearchParams(selected.map(id => ['id', id]));
      const response = await fetch(`/comparar/dados?${params}`, { signal, cache: 'no-store', credentials: 'omit' });
      if (!response.ok) throw new Error('Unavailable');
      const data = await response.json();
      return selected.map(id => {
        const item = Array.isArray(data.items) ? data.items.find((value: { id?: string } | null) => value?.id === id) : null;
        if (item?.status === 404) {
          const parsed = unavailableVehicleSchema.safeParse(item.unavailableVehicle);
          return { id, status: 404, vehicle: null, ...(parsed.success && parsed.data.slug === id ? { unavailableVehicle: parsed.data } : {}) };
        }
        const parsed = publicVehicleSchema.safeParse(item?.vehicle);
        if (item?.status !== 200 || !parsed.success || parsed.data.slug !== id) return { id, status: 503, vehicle: null };
        const versions = item.photoVersions;
        const valid = Array.isArray(versions) && versions.length === parsed.data.photos.length && versions.length <= 20 && versions.every((v: unknown) => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v));
        return { id, status: 200, vehicle: parsed.data, ...(valid ? { photoVersions: versions } : {}) };
      });
    } catch {
      return selected.map(id => ({ id, status: 503, vehicle: null }));
    }
  }))).flat();
}
