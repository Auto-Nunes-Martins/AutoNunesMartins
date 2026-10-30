import { publicPhoto, type PublicVehicle } from './publicVehicles';
import {
  publicPhotoWidth,
  detailPhotoWidth,
  nearestPhotoWidth,
  detailPhotoRatio,
  detailPhotoDimensions,
} from './vehiclePhotoSources';
import {
  retainedPublicPhoto,
  hasPublicPhotoPixels,
  remember,
  retainedPhotoWidth,
} from './publicThumbnail';
import { takeCardPhotoPreview } from './cardPhotoPreview';

const MAX_PHOTO_BYTES = 20 * 1024 * 1024;
const MAX_SESSION_BYTES = 64 * 1024 * 1024;
type Copy = { url: string; blob: Blob };

/** Retain bytes for this gallery visit. A settled miss never downloads again. */
export function createPublicGallerySession(
  vehicle: Pick<PublicVehicle, 'slug' | 'photos' | 'photoDimensions' | 'coverPhotoDimensions'>,
) {
  const approved = new Set(vehicle.photos.map((_, index) => publicPhoto(vehicle, index)));
  const entries = new Map<string, Promise<Copy | undefined>>();
  const copies = new Set<Copy>();
  const readyCopies = new Map<string, Copy>();
  const controller = new AbortController();
  let users = 0,
    disposed = false,
    retainedBytes = 0;
  const discarded = new Set<string>();
  const resolutions = new Map<string, number>();
  const ratios = new Map<string, number>(),
    listeners = new Set<() => void>();
  const baseWidth = (src = publicPhoto(vehicle, 0)) => {
    const id = identity(src) ?? '',
      index = Number(
        new URL(src, typeof location === 'undefined' ? 'http://localhost' : location.href).pathname
          .split('/')
          .pop(),
      );
    const next =
      typeof window === 'undefined' || !Number.isFinite(window.innerWidth)
        ? publicPhotoWidth
        : detailPhotoWidth(
            window.innerWidth,
            window.devicePixelRatio || 1,
            detailPhotoRatio(vehicle, index) || ratios.get(id),
          );
    const version =
      new URL(
        src,
        typeof location === 'undefined' ? 'http://localhost' : location.href,
      ).searchParams.get('v') ?? '';
    const width = Math.max(resolutions.get(id) ?? 0, retainedPhotoWidth(version, next));
    resolutions.set(id, width);
    return width;
  };
  const resolutionKey = (src: string, resolution = baseWidth(src)) => {
    const id = identity(src);
    return id ? `${id}&w=${resolution}` : undefined;
  };

  function identity(src: string) {
    const url = new URL(src, location.href);
    url.searchParams.delete('w');
    return url.origin === location.origin && approved.has(url.pathname + url.search)
      ? url.pathname + url.search
      : undefined;
  }
  function discard(src: string) {
    const id = identity(src);
    if (id) discarded.add(id);
    const key = resolutionKey(src);
    if (!key) return;
    const previous = entries.get(key);
    readyCopies.delete(key);
    entries.set(key, Promise.resolve(undefined));
    void previous?.then((copy) => {
      if (copy && copies.delete(copy)) {
        readyCopies.delete(key);
        retainedBytes -= copy.blob.size;
        URL.revokeObjectURL(copy.url);
      }
    });
  }
  return {
    preview(src: string) {
      return identity(src) ? takeCardPhotoPreview(src) : undefined;
    },
    width: baseWidth,
    maximum(src: string) {
      return detailPhotoDimensions(
        vehicle,
        Number(new URL(src, location.href).pathname.split('/').pop()),
      )?.width;
    },
    attrs(src: string, srcset?: string) {
      return typeof window !== 'undefined' && hasPublicPhotoPixels(vehicle.slug)
        ? { src: undefined, srcset: undefined }
        : { src, srcset };
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    observe(src: string, ratio: number) {
      const id = identity(src);
      if (!id || !Number.isFinite(ratio) || ratio <= 0 || ratios.has(id)) return false;
      const before = baseWidth(src);
      ratios.set(id, ratio);
      if (baseWidth(src) <= before) return false;
      for (const listener of listeners) listener();
      return true;
    },
    hasCopy(src: string) {
      const key = resolutionKey(src);
      return !!key && readyCopies.has(key);
    },
    attach() {
      users++;
    },
    detach() {
      if (--users > 0) return;
      disposed = true;
      controller.abort();
      for (const copy of copies) URL.revokeObjectURL(copy.url);
      copies.clear();
      entries.clear();
      listeners.clear();
      ratios.clear();
      resolutions.clear();
      readyCopies.clear();
      retainedBytes = 0;
    },
    discard,
    read(
      src: string,
      seed?: () => Promise<Response | undefined>,
      requestedWidth?: number,
    ): Promise<Copy | undefined> {
      const selected = requestedWidth ? nearestPhotoWidth(requestedWidth) : baseWidth(src);
      const key = resolutionKey(src, selected);
      if (disposed || !key || discarded.has(identity(src)!)) return Promise.resolve(undefined);
      const previous = entries.get(key);
      if (previous) return previous;
      const pending = (async () => {
        try {
          // The SSR image already made its initial request: seed cache-only.
          // Thumbnails and cards already use this same derivative. Prefer their
          // retained pixels/cache; never revalidate a copy during this gallery visit.
          const url = new URL(key, location.href);
          url.searchParams.set('w', String(selected));
          const expectedVersion = url.searchParams.get('v');
          const index = Number(url.pathname.split('/').pop());
          const retained = expectedVersion
            ? await retainedPublicPhoto(vehicle.slug, index, expectedVersion, selected)
            : undefined;
          let response = retained
            ? new Response(retained, {
                headers: {
                  'content-type': retained.type,
                  'x-photo-version': expectedVersion!,
                },
              })
            : seed
              ? await seed()
              : undefined;
          if (!retained && !seed) {
            try {
              response = await fetch(url, {
                cache: 'only-if-cached',
                mode: 'same-origin',
                credentials: 'omit',
              });
            } catch {
              /* A new image still needs its authorized first download. */
            }
            if (!response?.ok)
              response = await fetch(url, {
                cache: 'no-store',
                credentials: 'omit',
                redirect: 'error',
                signal: controller.signal,
              });
          }
          if (
            !response?.ok ||
            !['image/jpeg', 'image/png', 'image/webp'].includes(
              response.headers.get('content-type')?.split(';')[0] ?? '',
            )
          )
            return undefined;
          if (expectedVersion && response.headers.get('x-photo-version') !== expectedVersion)
            return undefined;
          const declared = response.headers.get('content-length');
          if (declared && Number(declared) > MAX_PHOTO_BYTES) return undefined;
          const blob = await response.blob();
          if (
            disposed ||
            blob.size > MAX_PHOTO_BYTES ||
            retainedBytes + blob.size > MAX_SESSION_BYTES
          )
            return undefined;
          const copy = { blob, url: URL.createObjectURL(blob) };
          if (expectedVersion) remember(vehicle.slug, expectedVersion, selected, blob);
          copies.add(copy);
          readyCopies.set(key, copy);
          retainedBytes += blob.size;
          return copy;
        } catch {
          return undefined;
        }
      })();
      entries.set(key, pending);
      return pending;
    },
  };
}
export type PublicGallerySession = ReturnType<typeof createPublicGallerySession>;
