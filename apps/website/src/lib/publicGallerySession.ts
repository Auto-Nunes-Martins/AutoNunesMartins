import { publicPhoto, type PublicVehicle } from './publicVehicles';

const MAX_PHOTO_BYTES = 20 * 1024 * 1024;
const MAX_SESSION_BYTES = 64 * 1024 * 1024;
type Copy = { url: string; blob: Blob };

/** Retain bytes for this gallery visit. A settled miss never downloads again. */
export function createPublicGallerySession(vehicle: Pick<PublicVehicle, 'slug' | 'photos'>) {
  const approved = new Set(vehicle.photos.map((_, index) => publicPhoto(vehicle, index)));
  const entries = new Map<string, Promise<Copy | undefined>>();
  const copies = new Set<Copy>();
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
    entries.set(key, Promise.resolve(undefined));
    void previous?.then(copy => {
      if (copy && copies.delete(copy)) {
        retainedBytes -= copy.blob.size;
        URL.revokeObjectURL(copy.url);
      }
    });
  }
  return {
    attach() { users++; },
    detach() {
      if (--users > 0) return;
      disposed = true;
      controller.abort();
      for (const copy of copies) URL.revokeObjectURL(copy.url);
      copies.clear();
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
          // New photographs get one authorized download at the largest derivative,
          // then share these bytes with the enlarged viewer and every later visit.
          const url = new URL(key, location.href);
          url.searchParams.set('w', '2560');
          const response = seed ? await seed() : await fetch(url, {
            cache: 'no-store', credentials: 'omit', redirect: 'error', signal: controller.signal,
          });
          if (!response?.ok || !['image/jpeg', 'image/png', 'image/webp'].includes(
            response.headers.get('content-type')?.split(';')[0] ?? '',
          )) return undefined;
          const expectedVersion = url.searchParams.get('v');
          if (expectedVersion && response.headers.get('x-photo-version') !== expectedVersion)
            return undefined;
          const declared = response.headers.get('content-length');
          if (declared && Number(declared) > MAX_PHOTO_BYTES) return undefined;
          const blob = await response.blob();
          if (disposed || blob.size > MAX_PHOTO_BYTES || retainedBytes + blob.size > MAX_SESSION_BYTES)
            return undefined;
          const copy = { blob, url: URL.createObjectURL(blob) };
          copies.add(copy);
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
