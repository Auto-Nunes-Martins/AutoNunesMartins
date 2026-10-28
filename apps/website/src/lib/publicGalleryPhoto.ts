import { vehiclePhoto } from './vehiclePhoto';
import type { PublicGallerySession } from './publicGallerySession';

type Source = {
  src: string; srcset?: string; fade?: boolean;
  onLoading?: (loading: boolean) => void; session?: PublicGallerySession;
};

/** Own src/srcset after hydration; templates must not assign network URLs again. */
export function publicGalleryPhoto(node: HTMLImageElement, initial: Source): {
  update(next: Source): void; destroy(): void;
} {
  let source = initial, session = initial.session, revision = 0, alive = true;
  let renderer: ReturnType<typeof vehiclePhoto> | undefined;
  let cancelSeed: (() => void) | undefined;
  let clearPreview: (() => void) | undefined;
  session?.attach();

  function blank() {
    clearPreview?.(); clearPreview = undefined;
    renderer?.destroy(); renderer = undefined;
    node.style.visibility = 'hidden';
    node.removeAttribute('srcset');
    node.removeAttribute('src');
    source.onLoading?.(false);
  }
  function failed(event: Event) {
    if (!session || !node.src.startsWith('blob:')) return;
    // A discarded/broken local copy is a terminal miss for this visit.
    event.stopImmediatePropagation();
    session.discard(source.src);
    blank();
  }
  node.addEventListener('error', failed);

  async function seed(): Promise<Response | undefined> {
    if (!node.complete) await new Promise<void>(resolve => {
      const done = () => {
        node.removeEventListener('load', done);
        node.removeEventListener('error', done);
        cancelSeed = undefined;
        resolve();
      };
      cancelSeed = done;
      node.addEventListener('load', done, { once: true });
      node.addEventListener('error', done, { once: true });
    });
    if (!alive || !node.naturalWidth || !node.currentSrc) return undefined;
    try {
      // This mode cannot contact the server, including on a cache miss.
      return await fetch(node.currentSrc, {
        cache: 'only-if-cached', mode: 'same-origin', credentials: 'omit',
      });
    } catch { return undefined; }
  }

  async function show(first = false) {
    if (!session) return;
    const version = ++revision, current = source;
    clearPreview?.(); clearPreview = undefined;
    const preview = first ? session.preview?.(current.src) : undefined;
    if (preview && node.parentElement) {
      const layer = document.createElement('img');
      layer.src = preview;
      layer.alt = '';
      layer.setAttribute('data-card-photo-preview', '');
      layer.setAttribute('aria-hidden', 'true');
      layer.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:1';
      layer.style.objectFit = getComputedStyle(node).objectFit;
      layer.style.objectPosition = getComputedStyle(node).objectPosition;
      node.parentElement.append(layer);
      clearPreview = () => layer.remove();
    }
    const retained = session.hasCopy?.(current.src) ?? false;
    current.onLoading?.(!retained && !preview);
    const copy = await session.read(current.src, first && node.getAttribute('src') ? seed : undefined);
    if (!alive || version !== revision) return;
    if (!copy) { blank(); return; }
    node.style.visibility = '';
    const next = { src: copy.url, fade: current.fade, onLoading: (value: boolean) => {
      if (alive && version === revision) {
        current.onLoading?.(retained || preview ? false : value);
        if (!value) { clearPreview?.(); clearPreview = undefined; }
      }
    } };
    if (renderer) renderer.update(next);
    else {
      node.src = copy.url;
      node.removeAttribute('srcset');
      renderer = vehiclePhoto(node, next);
    }
    if (preview) {
      try { await node.decode(); } catch { /* Normal error handling owns failures. */ }
      if (alive && version === revision) { clearPreview?.(); clearPreview = undefined; }
    }
  }
  if (session) void show(true);
  else renderer = vehiclePhoto(node, initial);
  return {
    update(next: Source) {
      if (next.src === source.src && next.session === session) return;
      cancelSeed?.();
      if (!next.session) {
        revision++;
        if (session) { session.detach(); session = undefined; renderer?.destroy(); renderer = undefined; }
        source = next;
        node.style.visibility = '';
        if (renderer) renderer.update(next);
        else {
          node.src = next.src;
          if (next.srcset) node.srcset = next.srcset; else node.removeAttribute('srcset');
          renderer = vehiclePhoto(node, next);
        }
        return;
      }
      if (next.session !== session) {
        session?.detach();
        renderer?.destroy(); renderer = undefined;
        session = next.session; session.attach();
      }
      source = next;
      void show();
    },
    destroy() {
      alive = false; revision++;
      clearPreview?.();
      cancelSeed?.();
      node.removeEventListener('error', failed);
      renderer?.destroy();
      session?.detach();
    },
  };
}
