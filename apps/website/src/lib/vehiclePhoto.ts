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
  let decodeGeneration = 0;
  let transition: Animation | undefined;
  let displayed = node.complete && node.naturalWidth > 0 ? node.currentSrc || node.src : '';
  let restoreSnapshot: (() => void) | undefined;
  function clearTransition() {
    transition?.cancel();
    transition = undefined;
    restoreSnapshot?.();
    restoreSnapshot = undefined;
  }
  function retainBackground() {
    const parent = node.parentElement;
    if (
      !source.fade ||
      !displayed ||
      !parent ||
      matchMedia('(prefers-reduced-motion: reduce)').matches
    )
      return;
    const properties = [
      'background-image',
      'background-size',
      'background-position',
      'background-repeat',
    ];
    const previous = properties.map((key): [string, string, string] => [
      key,
      parent.style.getPropertyValue(key),
      parent.style.getPropertyPriority(key),
    ]);
    const opacity = node.style.opacity;
    const fit = getComputedStyle(node);
    parent.style.setProperty('background-image', `url(${JSON.stringify(displayed)})`);
    parent.style.setProperty('background-size', fit.objectFit === 'contain' ? 'contain' : 'cover');
    parent.style.setProperty('background-position', fit.objectPosition);
    parent.style.setProperty('background-repeat', 'no-repeat');
    node.style.opacity = '0';
    restoreSnapshot = () => {
      for (const [key, value, priority] of previous) {
        if (value) parent.style.setProperty(key, value, priority);
        else parent.style.removeProperty(key);
      }
      node.style.opacity = opacity;
    };
  }
  async function loaded() {
    const version = generation;
    const decodeVersion = ++decodeGeneration;
    if (node.decode) {
      try {
        await node.decode();
      } catch {
        /* Error handler provides the fallback. */
      }
    }
    if (version !== generation || decodeVersion !== decodeGeneration) return;
    displayed = node.currentSrc || node.src;
    source.onLoading?.(false);
    // Fade over the last decoded photo, never the page's light background.
    // No cloned image, source observer or pointer-driven transition is retained.
    if (restoreSnapshot && !transition) {
      node.style.opacity = '1';
      const animation = node.animate([{ opacity: 0 }, { opacity: 1 }], {
        duration: 220,
        easing: 'cubic-bezier(.22,.61,.36,1)',
      });
      transition = animation;
      void animation.finished
        .then(() => {
          if (transition === animation) clearTransition();
        })
        .catch(() => {});
    }
  }
  function fallback() {
    decodeGeneration++;
    displayed = '';
    clearTransition();
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
      clearTransition();
      retainBackground();
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
      clearTransition();
    },
  };
}
