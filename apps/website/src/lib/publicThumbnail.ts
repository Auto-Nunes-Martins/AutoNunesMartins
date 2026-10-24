import { catalogPlaceholder } from './localAssets';
import { nearestPhotoWidth } from './vehiclePhotoSources';

type NavigationWarmup = {
  slug: string;
  controller: AbortController;
  ready: Promise<void>;
  photos: Map<number, Promise<void>>;
};
let navigationWarmup: NavigationWarmup | undefined;

export const navigationThumbnailWidth = (viewport: number, density: number) =>
  nearestPhotoWidth((viewport <= 701 ? 112 : 128) * Math.max(1, density || 1));

function photoVersions(data: unknown): string[] {
  const versions = (data as { versions?: unknown })?.versions;
  if (
    !Array.isArray(versions) ||
    versions.length > 20 ||
    !versions.every((v: unknown) => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v))
  )
    throw Error('Invalid photo access');
  return versions;
}

/** Called only for an actual link navigation, never hover, focus or intersection. */
export function warmNavigationThumbnails(
  slug: string,
  viewport: number,
  density: number,
  count?: number,
) {
  cancelNavigationThumbnails();
  const width = navigationThumbnailWidth(viewport, density);
  if (width > 800) return; // Keep native responsive delivery for unusually dense screens.
  const controller = new AbortController();
  const work: NavigationWarmup = { slug, controller, ready: Promise.resolve(), photos: new Map() };
  navigationWarmup = work;
  const deadline = setTimeout(() => controller.abort(), 8000);
  // A public card's count is only a scheduling hint, never permission. Every
  // image request is authorized by the backend and arrival access remains fresh.
  // On revisits, discover current identities first so retained pixels can avoid
  // redundant downloads. The count shortcut targets a first visit only.
  const knownCount = !available(slug) && Number.isInteger(count) && count! >= 0 && count! <= 20;
  const discovery = knownCount
    ? Promise.resolve<string[] | undefined>(undefined)
    : fetch(`/viaturas/${slug}/photos/access`, {
        cache: 'no-store',
        credentials: 'omit',
        signal: controller.signal,
      }).then(async (response) => {
        if (!response.ok) throw Error('Photos unavailable');
        return photoVersions(await response.json());
      });
  work.ready = discovery
    .then(async (versions) => {
      if (controller.signal.aborted) return;
      // Each image still performs its own live authorization. This first query
      // discovers the count/identities; it is not reused as permission on arrival.
      let next = 0;
      const finish: Array<() => void> = [];
      for (let index = 0; index < Math.min(9, knownCount ? count! : versions!.length); index++) {
        work.photos.set(
          index,
          new Promise<void>((resolve) => {
            finish[index] = resolve;
          }),
        );
      }
      const worker = async () => {
        while (next < finish.length && !controller.signal.aborted) {
          const index = next++;
          try {
            const cached = versions ? entries.get(`${versions[index]}/${width}`) : undefined;
            if (cached && cached.used > Date.now() - MAX_AGE) continue;
            const version = versions?.[index];
            const image = await fetch(`/viaturas/${slug}/photos/${index}?w=${width}${version ? '&v=' + version : ''}`, {
              cache: 'default',
              credentials: 'omit',
              signal: controller.signal,
            });
            const receivedVersion = image.headers.get('x-photo-version');
            if (!image.ok || !receivedVersion || !/^[a-f0-9]{64}$/.test(receivedVersion)) continue;
            const blob = await image.blob();
            if (!controller.signal.aborted) remember(slug, receivedVersion, width, blob);
          } catch {
            /* Native image delivery remains the fallback. */
          } finally {
            finish[index]?.();
          }
        }
      };
      // Nine small thumbnails in two waves, rather than three. Keep the total
      // bounded and leave the principal photograph on its native high priority.
      void Promise.all(Array.from({ length: 6 }, worker)).finally(() => {
        for (const resolve of finish) resolve();
        clearTimeout(deadline);
        if (navigationWarmup === work) navigationWarmup = undefined;
      });
    })
    .catch(() => {
      clearTimeout(deadline);
      if (navigationWarmup === work) navigationWarmup = undefined;
    });
}

export function cancelNavigationThumbnails() {
  navigationWarmup?.controller.abort();
  navigationWarmup = undefined;
}

// Exact public thumbnail bytes, in this document only; no cached authorization or persistent store.
const MAX_BYTES = 4 * 1024 * 1024,
  MAX_ENTRIES = 120,
  MAX_AGE = 10 * 60 * 1000;
type Entry = {
  version: string;
  width: number;
  bytes: number;
  slug: string;
  used: number;
  blobUrl: string;
  refs: number;
};
const entries = new Map<string, Entry>();
const available = (slug: string) =>
  [...entries.values()].some((e) => e.slug === slug && (e.refs > 0 || e.used > Date.now() - MAX_AGE));
function remember(slug: string, version: string, width: number, blob: Blob) {
  if (blob.size > 800_000 || !['image/webp', 'image/jpeg', 'image/png'].includes(blob.type)) return;
  const key = `${version}/${width}`,
    previous = entries.get(key);
  if (previous) {
    previous.used = Date.now();
    previous.slug = slug;
    return;
  }
  let size = [...entries.values()].reduce((n, e) => n + e.bytes, 0);
  for (const [id, entry] of [...entries].sort((a, b) => a[1].used - b[1].used)) {
    if (
      size + blob.size <= MAX_BYTES &&
      entries.size < MAX_ENTRIES &&
      entry.used > Date.now() - MAX_AGE
    )
      continue;
    if (entry.refs) continue;
    entries.delete(id);
    size -= entry.bytes;
    URL.revokeObjectURL(entry.blobUrl);
  }
  if (size + blob.size > MAX_BYTES || entries.size >= MAX_ENTRIES) return;
  entries.set(key, {
    version,
    width,
    bytes: blob.size,
    slug,
    used: Date.now(),
    refs: 0,
    blobUrl: URL.createObjectURL(blob),
  });
}

/** One fresh permission snapshot per gallery; requests never reuse approval from an earlier visit. */
export function createThumbnailSession(slug: string, freshVersions?: string[], cacheOnly = false) {
  const warming = navigationWarmup?.slug === slug ? navigationWarmup : undefined;
  const reuse = available(slug) || !!warming;
  let promise: Promise<string[]> | undefined,
    controller = new AbortController(),
    users = 0;
  return {
    slug,
    hasPixels: () => reuse || cacheOnly,
    cacheOnly,
    async prepared(index: number) {
      if (!warming) return;
      await warming.ready;
      await warming.photos.get(index);
    },
    attach() {
      if (controller.signal.aborted) {
        controller = new AbortController();
        promise = undefined;
      }
      users++;
    },
    detach() {
      if (--users <= 0) controller.abort();
    },
    access() {
      // Comparison supplies identities from its just-completed no-store selection query.
      // Never pass versions retained from an earlier mount/visit here.
      if (freshVersions) return (promise ??= Promise.resolve(freshVersions));
      return (promise ??= fetch(`/viaturas/${slug}/photos/access`, {
        cache: 'no-store',
        credentials: 'omit',
        signal: controller.signal,
      }).then(async (response) => {
        if (!response.ok) throw Error('Photos unavailable');
        return photoVersions(await response.json());
      }));
    },
  };
}
type Source = {
  session: ReturnType<typeof createThumbnailSession>;
  index: number;
  src: string;
  srcset?: string;
  sizes: string;
  onReady?: () => void;
  minimumWidth?: number;
};

/** Avoid N conditional requests during warm client navigation; initial SSR retains native URLs. */
export function thumbnailAttrs(
  session: ReturnType<typeof createThumbnailSession>,
  src: string,
  srcset?: string,
) {
  return typeof window !== 'undefined' && session.hasPixels()
    ? { src: undefined, srcset: undefined }
    : { src, srcset };
}

export function publicThumbnail(node: HTMLImageElement, initial: Source) {
  let source = initial,
    alive = true,
    revision = 0,
    waiting = false,
    failed = false,
    lease: Entry | undefined;
  const unpin = () => {
    if (lease) {
      lease.refs--;
      lease = undefined;
    }
  };
  function native() {
    waiting = false;
    unpin();
    if (source.session.cacheOnly) {
      node.removeAttribute('srcset');
      node.removeAttribute('src');
      source.onReady?.();
      return;
    }
    if (source.srcset) node.srcset = source.srcset;
    else node.removeAttribute('srcset');
    node.sizes = source.sizes;
    node.src = source.src;
  }
  function error() {
    if (waiting || failed) return;
    failed = true;
    unpin();
    node.removeAttribute('srcset');
    if (source.session.cacheOnly) node.removeAttribute('src');
    else node.src = catalogPlaceholder;
    source.onReady?.();
  }
  async function loaded() {
    if (waiting || failed || !alive || node.currentSrc.startsWith('blob:')) return;
    const current = source,
      token = revision,
      url = new URL(node.currentSrc || node.src, location.href),
      width = Number(url.searchParams.get('w'));
    if (
      url.origin !== location.origin ||
      ![320, 384, 800].includes(width) ||
      !url.pathname.endsWith(`/photos/${source.index}`)
    )
      return;
    try {
      // The native image just completed its own live authorization. Read those exact cached bytes.
      const response = await fetch(url, { cache: 'only-if-cached', mode: 'same-origin', credentials: 'omit' });
      const version = response.headers.get('x-photo-version');
      if (
        !response.ok ||
        !version ||
        !/^[a-f0-9]{64}$/.test(version) ||
        !alive ||
        token !== revision
      )
        return;
      remember(current.session.slug, version, width, await response.blob());
      // Retain the current page's thumbnails until their nodes leave the page.
      // Their viewer reuse has no expiry timer and cannot evict a navigable copy.
      if (alive && token === revision && !lease) {
        const entry = entries.get(`${version}/${width}`);
        if (entry) { entry.refs++; lease = entry; }
      }
    } catch {
      /* Native delivery remains available when the browser cannot retain a response. */
    }
  }
  async function start() {
    const token = ++revision;
    failed = false;
    source.session.attach();
    if (!source.session.hasPixels()) {
      if (node.complete && node.naturalWidth === 0) error();
      else if (node.complete) void loaded();
      return;
    }
    waiting = true;
    if (!(node.complete && node.naturalWidth > 0)) {
      node.removeAttribute('srcset');
      node.removeAttribute('src');
    }
    try {
      const versions = await source.session.access();
      await source.session.prepared(source.index);
      if (!alive || token !== revision) return;
      const needed = Math.max(node.getBoundingClientRect().width, source.minimumWidth ?? 0) * devicePixelRatio;
      const entry = [...entries.values()]
        .filter(
          (e) =>
            e.version === versions[source.index] &&
            e.width >= needed &&
            (e.refs > 0 || e.used > Date.now() - MAX_AGE),
        )
        .sort((a, b) => a.width - b.width)[0];
      if (!entry) {
        native();
        return;
      }
      entry.refs++;
      entry.used = Date.now();
      lease = entry;
      waiting = false;
      failed = false;
      node.removeAttribute('srcset');
      node.src = entry.blobUrl;
      if (source.onReady) {
        try { await node.decode(); } catch { /* Missing copies stay unavailable. */ }
        if (alive && token === revision) source.onReady();
      }
    } catch {
      if (alive && token === revision) native();
    }
  }
  function resize() {
    if (lease && node.getBoundingClientRect().width * devicePixelRatio > lease.width) native();
  }
  node.addEventListener('load', loaded);
  node.addEventListener('error', error);
  const observer = new ResizeObserver(resize);
  observer.observe(node);
  window.addEventListener('resize', resize);
  void start();
  return {
    update(next: Source) {
      if (
        next.session === source.session &&
        next.index === source.index &&
        next.src === source.src &&
        next.srcset === source.srcset &&
        next.sizes === source.sizes
      )
        return;
      source.session.detach();
      unpin();
      source = next;
      native();
      void start();
    },
    destroy() {
      alive = false;
      ++revision;
      source.session.detach();
      unpin();
      observer.disconnect();
      window.removeEventListener('resize', resize);
      node.removeEventListener('load', loaded);
      node.removeEventListener('error', error);
    },
  };
}
