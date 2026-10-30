export type SignedVariantPhoto = {
  path: string;
  url: string;
  width?: number;
  height?: number;
  variants?: { width: number; height: number; url: string }[];
};
export function photoAttrs(
  photo: { url: string | null; width?: number; variants?: { width: number; url: string }[] },
  width: number,
  sizes: string,
) {
  // The private CRM action chooses once after layout; SSR must not start a
  // different thumbnail candidate before the shared gallery group is measured.
  return { src: undefined, srcset: undefined, sizes };
}
/** Missing/expired derivative falls back once to the original, before component error UI. */
export function photoFallback(node: HTMLImageElement, original: string | null) {
  let fallback = false;
  function error(event: Event) {
    if (!fallback && original && node.currentSrc !== new URL(original, document.baseURI).href) {
      event.stopImmediatePropagation();
      fallback = true;
      node.removeAttribute('srcset');
      node.src = original;
    }
  }
  node.addEventListener('error', error, true);
  // A server-rendered image can fail before hydration installs the listener.
  if (node.complete && node.naturalWidth === 0) error(new Event('error'));
  return {
    update(next: string | null) {
      if (next !== original) {
        original = next;
        fallback = false;
      }
    },
    destroy() {
      node.removeEventListener('error', error, true);
    },
  };
}
