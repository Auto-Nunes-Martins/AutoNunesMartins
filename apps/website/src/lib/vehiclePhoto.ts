import { catalogPlaceholder } from './localAssets';

type Source = { src: string; srcset?: string };

/** Keep the original vehicle placeholder when a photo cannot be decoded. */
export function vehiclePhoto(node: HTMLImageElement, initial: Source) {
  let source = initial;
  let failed = false;
  function fallback() {
    if (failed || source.src === catalogPlaceholder) return;
    failed = true;
    node.removeAttribute('srcset');
    node.src = catalogPlaceholder;
  }
  node.addEventListener('error', fallback);
  // Loading can finish before hydration installs the error listener.
  if (node.complete && node.naturalWidth === 0) fallback();
  return {
    update(next: Source) {
      if (next.src === source.src && next.srcset === source.srcset) return;
      source = next;
      failed = false;
      if (next.srcset) node.setAttribute('srcset', next.srcset);
      else node.removeAttribute('srcset');
      node.src = next.src;
    },
    destroy() {
      node.removeEventListener('error', fallback);
    },
  };
}
