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
  session?.attach();

  function blank() {
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
    const retained = session.hasCopy?.(current.src) ?? false;
    current.onLoading?.(!retained);
    const copy = await session.read(current.src, first && node.getAttribute('src') ? seed : undefined);
    if (!alive || version !== revision) return;
    if (!copy) { blank(); return; }
    node.style.visibility = '';
    const next = { src: copy.url, fade: current.fade, onLoading: (value: boolean) => {
      if (alive && version === revision) current.onLoading?.(retained ? false : value);
    } };
    if (renderer) renderer.update(next);
    else {
      node.src = copy.url;
      node.removeAttribute('srcset');
      renderer = vehiclePhoto(node, next);
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
      cancelSeed?.();
      node.removeEventListener('error', failed);
      renderer?.destroy();
      session?.detach();
    },
  };
}
