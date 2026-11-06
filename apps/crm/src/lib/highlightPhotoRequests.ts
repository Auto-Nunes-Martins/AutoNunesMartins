import type { SignedVariantPhoto } from './vehicleImage';

export type HighlightPreview = { path: string; url: string | null; originalUrl: string | null };
export type HighlightGalleryPhoto = Omit<SignedVariantPhoto, 'url'> & { url: string | null };
export type HighlightGalleryState =
  | { status: 'loading' | 'error' }
  | { status: 'ready'; photos: HighlightGalleryPhoto[] };

function untilAborted<T>(work: () => Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) return Promise.reject(signal.reason);
  return new Promise<T>((resolve, reject) => {
    const abort = () => reject(signal.reason);
    signal.addEventListener('abort', abort, { once: true });
    Promise.resolve().then(work).then(resolve, reject).finally(() => signal.removeEventListener('abort', abort));
  });
}

/** Wait on the actual card image, not just on the delivery of its signed URL. */
export async function decodeHighlightPreview(
  image: HTMLImageElement,
  original: string | null,
  signal: AbortSignal,
): Promise<string | null> {
  async function decoded() {
    await untilAborted(() => image.decode(), signal);
    return image.naturalWidth ? image.getAttribute('src') : null;
  }
  try {
    const source = await decoded();
    if (source) return source;
  } catch { /* Try the same photograph's original below. */ }
  if (signal.aborted || !original || original === image.getAttribute('src')) return null;
  image.src = original;
  try { return await decoded(); } catch { return null; }
}

export function createHighlightPhotoRequests(options: {
  previews: (paths: string[], signal: AbortSignal) => Promise<HighlightPreview[]>;
  gallery: (id: string, signal: AbortSignal) => Promise<HighlightGalleryPhoto[]>;
  onPreview: (path: string, photo: HighlightPreview | null) => void;
  onGallery: (id: string, state: HighlightGalleryState) => void;
}) {
  const scope = new AbortController();
  const queue = new Set<string>();
  const pending = new Set<string>();
  const loaded = new Map<string, number>();
  const galleries = new Map<string, { status: HighlightGalleryState['status']; until: number }>();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let batchPending = false;

  async function loadPreviewBatch(paths: string[], signal: AbortSignal) {
    let photos: HighlightPreview[] = [];
    try {
      photos = await untilAborted(() => options.previews(paths, signal), signal);
    } catch { /* Keep failed previews retryable. */ }
    if (signal.aborted) return;
    const byPath = new Map(photos.map((photo) => [photo.path, photo]));
    for (const path of paths) {
      const photo = byPath.get(path);
      if (photo?.url) loaded.set(path, Date.now() + 5 * 60_000);
      options.onPreview(path, photo?.url ? photo : null);
    }
  }

  function schedule() {
    if (!scope.signal.aborted && queue.size && !batchPending && timer === undefined)
      timer = setTimeout(() => { timer = undefined; void flush(); }, 25);
  }

  async function flush() {
    if (scope.signal.aborted || !queue.size) return;
    batchPending = true;
    const paths = [...queue].slice(0, 12);
    for (const path of paths) { queue.delete(path); pending.add(path); }
    try {
      await loadPreviewBatch(paths, scope.signal);
    } finally {
      if (!scope.signal.aborted) {
        for (const path of paths) pending.delete(path);
        batchPending = false;
        schedule();
      }
    }
  }

  return {
    async preparePreviews(paths: string[], signal: AbortSignal) {
      const unique = [...new Set(paths)];
      const combined = AbortSignal.any([scope.signal, signal]);
      let offset = 0;
      await Promise.all(Array.from({ length: Math.min(3, Math.ceil(unique.length / 12)) }, async () => {
        while (!combined.aborted && offset < unique.length) {
          const batch = unique.slice(offset, offset + 12);
          offset += 12;
          await loadPreviewBatch(batch, combined);
        }
      }));
    },
    preview(path: string, retry = false) {
      if (scope.signal.aborted || pending.has(path) || (!retry && (loaded.get(path) ?? 0) > Date.now())) return;
      queue.add(path);
      schedule();
    },
    rememberPreview(path: string) {
      loaded.set(path, Date.now() + 5 * 60_000);
      queue.delete(path);
    },
    async gallery(id: string, retry = false) {
      const existing = galleries.get(id);
      if (scope.signal.aborted || existing?.status === 'loading' ||
        (!retry && (existing?.until ?? 0) > Date.now())) return;
      galleries.set(id, { status: 'loading', until: 0 });
      options.onGallery(id, { status: 'loading' });
      let state: HighlightGalleryState = { status: 'error' };
      try {
        const photos = await options.gallery(id, scope.signal);
        if (photos.some((photo) => photo.url)) state = { status: 'ready', photos };
      } catch {
        // Errors belong to the vehicle requested, never to another open row.
      }
      if (scope.signal.aborted) return;
      galleries.set(id, { status: state.status, until: state.status === 'ready' ? Date.now() + 5 * 60_000 : 0 });
      options.onGallery(id, state);
    },
    destroy() {
      scope.abort();
      clearTimeout(timer);
    },
  };
}
