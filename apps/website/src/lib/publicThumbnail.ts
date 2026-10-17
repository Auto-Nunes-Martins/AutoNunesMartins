import { catalogPlaceholder } from './localAssets';

// Exact public thumbnail bytes, in this document only; no cached authorization or persistent store.
const MAX_BYTES = 4 * 1024 * 1024, MAX_ENTRIES = 120, MAX_AGE = 10 * 60 * 1000;
type Entry = { version: string; width: number; bytes: number; slug: string; used: number; blobUrl: string; refs: number };
const entries = new Map<string, Entry>();
const available = (slug: string) => [...entries.values()].some(e => e.slug === slug && e.used > Date.now() - MAX_AGE);
function remember(slug: string, version: string, width: number, blob: Blob) {
  if (blob.size > 800_000 || !['image/webp', 'image/jpeg', 'image/png'].includes(blob.type)) return;
  const key = `${version}/${width}`, previous = entries.get(key);
  if (previous) { previous.used = Date.now(); previous.slug = slug; return; }
  let size = [...entries.values()].reduce((n, e) => n + e.bytes, 0);
  for (const [id, entry] of [...entries].sort((a, b) => a[1].used - b[1].used)) {
    if (size + blob.size <= MAX_BYTES && entries.size < MAX_ENTRIES && entry.used > Date.now() - MAX_AGE) continue;
    if (entry.refs) continue;
    entries.delete(id); size -= entry.bytes; URL.revokeObjectURL(entry.blobUrl);
  }
  if (size + blob.size > MAX_BYTES || entries.size >= MAX_ENTRIES) return;
  entries.set(key, { version, width, bytes: blob.size, slug, used: Date.now(), refs: 0, blobUrl: URL.createObjectURL(blob) });
}

/** One fresh permission snapshot per gallery; requests never reuse approval from an earlier visit. */
export function createThumbnailSession(slug: string) {
  const reuse = available(slug);
  let promise: Promise<string[]> | undefined, controller = new AbortController(), users = 0;
  return {
    slug,
    hasPixels: () => reuse,
    attach() { if (controller.signal.aborted) { controller = new AbortController(); promise = undefined; } users++; },
    detach() { if (--users <= 0) controller.abort(); },
    access() {
      return promise ??= fetch(`/viaturas/${slug}/photos/access`, { cache: 'no-store', credentials: 'omit', signal: controller.signal }).then(async response => {
        if (!response.ok) throw Error('Photos unavailable');
        const data = await response.json();
        if (!Array.isArray(data.versions) || data.versions.length > 20 || !data.versions.every((v: unknown) => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v))) throw Error('Invalid photo access');
        return data.versions as string[];
      });
    },
  };
}
type Source = { session: ReturnType<typeof createThumbnailSession>; index: number; src: string; srcset?: string; sizes: string };

/** Avoid N conditional requests during warm client navigation; initial SSR retains native URLs. */
export function thumbnailAttrs(session: ReturnType<typeof createThumbnailSession>, src: string, srcset?: string) {
  return typeof window !== 'undefined' && session.hasPixels() ? { src: undefined, srcset: undefined } : { src, srcset };
}

export function publicThumbnail(node: HTMLImageElement, initial: Source) {
  let source = initial, alive = true, revision = 0, waiting = false, failed = false, lease: Entry | undefined;
  const unpin = () => { if (lease) { lease.refs--; lease = undefined; } };
  function native() { waiting = false; unpin(); if (source.srcset) node.srcset = source.srcset; else node.removeAttribute('srcset'); node.sizes = source.sizes; node.src = source.src; }
  function error() { if (waiting || failed) return; failed = true; unpin(); node.removeAttribute('srcset'); node.src = catalogPlaceholder; }
  async function loaded() {
    if (waiting || failed || !alive || node.currentSrc.startsWith('blob:')) return;
    const current = source, token = revision, url = new URL(node.currentSrc || node.src, location.href), width = Number(url.searchParams.get('w'));
    if (url.origin !== location.origin || ![320, 800].includes(width) || !url.pathname.endsWith(`/photos/${source.index}`)) return;
    try {
      // The native image just completed its own live authorization. Read those exact cached bytes.
      const response = await fetch(url, { cache: 'force-cache', credentials: 'omit' });
      const version = response.headers.get('x-photo-version');
      if (!response.ok || !version || !/^[a-f0-9]{64}$/.test(version) || !alive || token !== revision) return;
      remember(current.session.slug, version, width, await response.blob());
    } catch { /* Native delivery remains available when the browser cannot retain a response. */ }
  }
  async function start() {
    const token = ++revision; failed = false; source.session.attach();
    if (!source.session.hasPixels()) { if (node.complete && node.naturalWidth === 0) error(); else if (node.complete) void loaded(); return; }
    waiting = true;
    if (!(node.complete && node.naturalWidth > 0)) { node.removeAttribute('srcset'); node.removeAttribute('src'); }
    try {
      const versions = await source.session.access(); if (!alive || token !== revision) return;
      const needed = node.getBoundingClientRect().width * devicePixelRatio;
      const entry = [...entries.values()].filter(e => e.version === versions[source.index] && e.width >= needed && e.used > Date.now() - MAX_AGE).sort((a, b) => a.width - b.width)[0];
      if (!entry) { native(); return; }
      entry.refs++; entry.used = Date.now(); lease = entry; waiting = false; failed = false;
      node.removeAttribute('srcset'); node.src = entry.blobUrl;
    } catch { if (alive && token === revision) native(); }
  }
  function resize() { if (lease && node.getBoundingClientRect().width * devicePixelRatio > lease.width) native(); }
  node.addEventListener('load', loaded); node.addEventListener('error', error);
  const observer = new ResizeObserver(resize); observer.observe(node); window.addEventListener('resize', resize);
  void start();
  return {
    update(next: Source) { if (next.session === source.session && next.index === source.index && next.src === source.src && next.srcset === source.srcset && next.sizes === source.sizes) return; source.session.detach(); unpin(); source = next; native(); void start(); },
    destroy() { alive = false; ++revision; source.session.detach(); unpin(); observer.disconnect(); window.removeEventListener('resize', resize); node.removeEventListener('load', loaded); node.removeEventListener('error', error); },
  };
}
