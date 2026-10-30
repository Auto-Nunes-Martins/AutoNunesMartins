import { vehiclePhoto } from './vehiclePhoto';
import type { PublicGallerySession } from './publicGallerySession';
import { fullscreenPhotoWidth, nearestPhotoWidth } from '../../../../shared/photoResolution.mjs';

type Source = {
  src: string;
  srcset?: string;
  fade?: boolean;
  fullscreen?: boolean;
  onLoading?: (loading: boolean) => void;
  session?: PublicGallerySession;
};

/** Own src/srcset after hydration; templates must not assign network URLs again. */
export function publicGalleryPhoto(
  node: HTMLImageElement,
  initial: Source,
): {
  update(next: Source): void;
  destroy(): void;
} {
  let source = initial,
    session = initial.session,
    revision = 0,
    alive = true;
  let renderer: ReturnType<typeof vehiclePhoto> | undefined;
  let cancelSeed: (() => void) | undefined;
  let clearPreview: (() => void) | undefined;
  let displayedWidth = 0;
  let unsubscribe = session?.subscribe?.(() => void show());
  session?.attach();

  function blank() {
    clearPreview?.();
    clearPreview = undefined;
    renderer?.destroy();
    renderer = undefined;
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
    if (!node.complete)
      await new Promise<void>((resolve) => {
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
        cache: 'only-if-cached',
        mode: 'same-origin',
        credentials: 'omit',
      });
    } catch {
      return undefined;
    }
  }

  async function show(first = false) {
    if (!session) return;
    const version = ++revision,
      current = source;
    clearPreview?.();
    clearPreview = undefined;
    const preview = first ? session.preview?.(current.src) : undefined;
    if (preview && node.parentElement) {
      const layer = document.createElement('img');
      layer.src = preview;
      layer.alt = '';
      layer.setAttribute('data-card-photo-preview', '');
      layer.setAttribute('aria-hidden', 'true');
      layer.style.cssText =
        'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:1';
      layer.style.objectFit = getComputedStyle(node).objectFit;
      layer.style.objectPosition = getComputedStyle(node).objectPosition;
      node.parentElement.append(layer);
      clearPreview = () => layer.remove();
    }
    const retained = session.hasCopy?.(current.src) ?? false;
    const visible = node.complete && node.naturalWidth > 0;
    current.onLoading?.(!retained && !preview && !visible);
    const copy = await session.read(
      current.src,
      first && node.getAttribute('src') ? seed : undefined,
    );
    if (!alive || version !== revision) return;
    if (!copy) {
      if (node.complete && node.naturalWidth > 0) {
        current.onLoading?.(false);
        return;
      }
      blank();
      return;
    }
    if (typeof Image !== 'undefined') {
      const ready = new Image();
      ready.src = copy.url;
      try {
        await ready.decode();
      } catch {
        return;
      }
      if (!alive || version !== revision) return;
    }
    node.style.visibility = '';
    const next = {
      src: copy.url,
      fade: current.fade,
      onLoading: (value: boolean) => {
        if (alive && version === revision) {
          current.onLoading?.(retained || preview || visible ? false : value);
          if (!value) {
            clearPreview?.();
            clearPreview = undefined;
          }
        }
      },
    };
    if (renderer) renderer.update(next);
    else {
      node.src = copy.url;
      node.removeAttribute('srcset');
      renderer = vehiclePhoto(node, next);
    }
    if (preview) {
      try {
        await node.decode();
      } catch {
        /* Normal error handling owns failures. */
      }
      if (alive && version === revision) {
        clearPreview?.();
        clearPreview = undefined;
      }
    }
    displayedWidth = session.width?.(current.src) ?? 1600;
    if (session.observe?.(current.src, node.naturalWidth / node.naturalHeight)) return;
    if (source.fullscreen) void upgrade(version);
  }
  async function upgrade(version = revision) {
    if (!session || !source.fullscreen || !node.naturalWidth) return;
    const maximum = session.maximum?.(source.src);
    if (maximum && maximum <= node.naturalWidth * 1.2) return;
    const box = node.getBoundingClientRect();
    const width = Math.min(
      maximum ? nearestPhotoWidth(maximum) : 2560,
      fullscreenPhotoWidth(
        box.width,
        box.height,
        node.naturalWidth / node.naturalHeight,
        (window.devicePixelRatio || 1) * (window.visualViewport?.scale ?? 1),
        displayedWidth,
      ),
    );
    if (width <= displayedWidth) return;
    const copy = await session.read(source.src, undefined, width);
    if (!copy || !alive || version !== revision) return;
    const ready = new Image();
    ready.src = copy.url;
    try {
      await ready.decode();
    } catch {
      return;
    }
    if (!alive || version !== revision || !source.fullscreen) return;
    displayedWidth = width;
    renderer?.update({ src: copy.url, onLoading: () => source.onLoading?.(false) });
  }
  function resized() {
    if (source.fullscreen) void upgrade();
    else if (session) void show();
  }
  if (typeof window !== 'undefined') window.addEventListener('resize', resized);
  if (typeof window !== 'undefined') window.visualViewport?.addEventListener('resize', resized);
  if (session) void show(true);
  else renderer = vehiclePhoto(node, initial);
  return {
    update(next: Source) {
      if (
        next.src === source.src &&
        next.session === session &&
        next.fullscreen === source.fullscreen
      )
        return;
      if (next.src === source.src && next.session === session) {
        source = next;
        if (!displayedWidth || !node.naturalWidth) {
          void show();
          return;
        }
        revision++;
        if (next.fullscreen) void upgrade();
        return;
      }
      cancelSeed?.();
      if (!next.session) {
        revision++;
        unsubscribe?.();
        unsubscribe = undefined;
        if (session) {
          session.detach();
          session = undefined;
          renderer?.destroy();
          renderer = undefined;
        }
        source = next;
        node.style.visibility = '';
        if (renderer) renderer.update(next);
        else {
          node.src = next.src;
          if (next.srcset) node.srcset = next.srcset;
          else node.removeAttribute('srcset');
          renderer = vehiclePhoto(node, next);
        }
        return;
      }
      if (next.session !== session) {
        unsubscribe?.();
        session?.detach();
        renderer?.destroy();
        renderer = undefined;
        session = next.session;
        session.attach();
        unsubscribe = session.subscribe?.(() => void show());
      }
      source = next;
      void show();
    },
    destroy() {
      alive = false;
      revision++;
      clearPreview?.();
      cancelSeed?.();
      node.removeEventListener('error', failed);
      if (typeof window !== 'undefined') window.removeEventListener('resize', resized);
      if (typeof window !== 'undefined')
        window.visualViewport?.removeEventListener('resize', resized);
      renderer?.destroy();
      unsubscribe?.();
      session?.detach();
    },
  };
}
