import { publicPhoto, type PublicVehicle } from './publicVehicles';
import { publicPhotoWidth } from './vehiclePhotoSources';
import { retainedPublicPhoto } from './publicThumbnail';
import { takeCardPhotoPreview } from './cardPhotoPreview';

const MAX_PHOTO_BYTES = 20 * 1024 * 1024;
const MAX_SESSION_BYTES = 64 * 1024 * 1024;
type Copy = { url: string; blob: Blob };

/** Retain bytes for this gallery visit. A settled miss never downloads again. */
export function createPublicGallerySession(vehicle: Pick<PublicVehicle, 'slug' | 'photos'>) {
  const approved = new Set(vehicle.photos.map((_, index) => publicPhoto(vehicle, index)));
  const entries = new Map<string, Promise<Copy | undefined>>();
  const copies = new Set<Copy>();
  const readyCopies = new Map<string, Copy>();
  const controller = new AbortController();
  let users = 0, disposed = false, retainedBytes = 0;

  function identity(src: string) {
    const url = new URL(src, location.href);
    url.searchParams.delete('w');
    return url.origin === location.origin && approved.has(url.pathname + url.search)
      ? url.pathname + url.search : undefined;
  }
  function discard(src: string) {
    const key = identity(src);
    if (!key) return;
    const previous = entries.get(key);
    readyCopies.delete(key);
    entries.set(key, Promise.resolve(undefined));
    void previous?.then(copy => {
      if (copy && copies.delete(copy)) {
        readyCopies.delete(key);
        retainedBytes -= copy.blob.size;
        URL.revokeObjectURL(copy.url);
      }
    });
  }
  return {
    preview(src: string) { return identity(src) ? takeCardPhotoPreview(src) : undefined; },
    hasCopy(src: string) { const key = identity(src); return !!key && readyCopies.has(key); },
    attach() { users++; },
    detach() {
      if (--users > 0) return;
      disposed = true;
      controller.abort();
      for (const copy of copies) URL.revokeObjectURL(copy.url);
      copies.clear();
      readyCopies.clear();
      retainedBytes = 0;
    },
    discard,
    read(src: string, seed?: () => Promise<Response | undefined>): Promise<Copy | undefined> {
      const key = identity(src);
      if (disposed || !key) return Promise.resolve(undefined);
      const previous = entries.get(key);
      if (previous) return previous;
      const pending = (async () => {
        try {
          // The SSR image already made its initial request: seed cache-only.
          // Thumbnails and cards already use this same derivative. Prefer their
          // retained pixels/cache; never revalidate a copy during this gallery visit.
          const url = new URL(key, location.href);
          url.searchParams.set('w', String(publicPhotoWidth));
          const expectedVersion = url.searchParams.get('v');
          const index = Number(url.pathname.split('/').pop());
          const retained = expectedVersion
            ? await retainedPublicPhoto(vehicle.slug, index, expectedVersion) : undefined;
          let response = retained ? new Response(retained, { headers: {
            'content-type': retained.type, 'x-photo-version': expectedVersion!,
          } }) : seed ? await seed() : undefined;
          if (!retained && !seed) {
            try { response = await fetch(url, {
              cache: 'only-if-cached', mode: 'same-origin', credentials: 'omit',
            }); } catch { /* A new image still needs its authorized first download. */ }
            if (!response?.ok) response = await fetch(url, {
              cache: 'no-store', credentials: 'omit', redirect: 'error', signal: controller.signal,
            });
          }
          if (!response?.ok || !['image/jpeg', 'image/png', 'image/webp'].includes(
            response.headers.get('content-type')?.split(';')[0] ?? '',
          )) return undefined;
          if (expectedVersion && response.headers.get('x-photo-version') !== expectedVersion)
            return undefined;
          const declared = response.headers.get('content-length');
          if (declared && Number(declared) > MAX_PHOTO_BYTES) return undefined;
          const blob = await response.blob();
          if (disposed || blob.size > MAX_PHOTO_BYTES || retainedBytes + blob.size > MAX_SESSION_BYTES)
            return undefined;
          const copy = { blob, url: URL.createObjectURL(blob) };
          copies.add(copy);
          readyCopies.set(key, copy);
          retainedBytes += blob.size;
          return copy;
        } catch { return undefined; }
      })();
      entries.set(key, pending);
      return pending;
    },
  };
}
export type PublicGallerySession = ReturnType<typeof createPublicGallerySession>;
