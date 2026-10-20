import { catalogPlaceholder } from './localAssets';

type Source = {
  src: string;
  srcset?: string;
  fade?: boolean;
  onLoading?: (loading: boolean) => void;
};

/** Keep the original vehicle placeholder when a photo cannot be decoded. */
export function vehiclePhoto(node: HTMLImageElement, initial: Source) {
  let source = initial;
  let failed = false;
  let generation = 0;
  let displayed = node.complete && node.naturalWidth > 0 ? node.currentSrc || node.src : '';
  let cover: HTMLImageElement | undefined;
  let transition: Animation | undefined;
  function clearCover() {
    transition?.cancel();
    transition = undefined;
    cover?.remove();
    cover = undefined;
  }
  function retainDisplayed() {
    if (!source.fade || !displayed || matchMedia('(prefers-reduced-motion: reduce)').matches)
      return;
    clearCover();
    cover = node.cloneNode(false) as HTMLImageElement;
    cover.removeAttribute('srcset');
    cover.removeAttribute('sizes');
    cover.src = displayed;
    cover.alt = '';
    cover.setAttribute('aria-hidden', 'true');
    cover.classList.add('photo-transition-cover');
    Object.assign(cover.style, {
      position: 'absolute',
      inset: '0',
      width: '100%',
      height: '100%',
      pointerEvents: 'none',
      zIndex: '0',
    });
    node.after(cover);
  }
  async function loaded() {
    const version = generation;
    if (node.decode) {
      try {
        await node.decode();
      } catch {
        /* Error handler provides the fallback. */
      }
    }
    if (version !== generation) return;
    displayed = node.currentSrc || node.src;
    source.onLoading?.(false);
    if (cover) {
      const previous = cover;
      transition?.cancel();
      transition = previous.animate([{ opacity: 1 }, { opacity: 0 }], {
        duration: 220,
        easing: 'cubic-bezier(.22,.61,.36,1)',
        fill: 'forwards',
      });
      void transition.finished
        .then(() => {
          if (cover === previous) {
            previous.remove();
            cover = undefined;
            transition = undefined;
          }
        })
        .catch(() => {});
    }
  }
  function fallback() {
    clearCover();
    displayed = '';
    source.onLoading?.(false);
    if (failed || source.src === catalogPlaceholder) return;
    failed = true;
    node.removeAttribute('srcset');
    node.src = catalogPlaceholder;
  }
  node.addEventListener('error', fallback);
  node.addEventListener('load', loaded);
  source.onLoading?.(!node.complete);
  // Loading can finish before hydration installs the error listener.
  if (node.complete && node.naturalWidth === 0) fallback();
  return {
    update(next: Source) {
      if (next.src === source.src && next.srcset === source.srcset) return;
      source = next;
      generation++;
      failed = false;
      retainDisplayed();
      source.onLoading?.(true);
      if (next.srcset) node.setAttribute('srcset', next.srcset);
      else node.removeAttribute('srcset');
      node.src = next.src;
      if (node.complete && node.naturalWidth > 0) void loaded();
    },
    destroy() {
      node.removeEventListener('error', fallback);
      node.removeEventListener('load', loaded);
      generation++;
      clearCover();
    },
  };
}
