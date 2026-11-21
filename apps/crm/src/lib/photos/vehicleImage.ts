export type SignedVariantPhoto = {
  path: string;
  url: string;
  width?: number;
  height?: number;
  variants?: { width: number; height: number; url: string }[];
};
export function photoAttrs(
  _photo: { url: string | null; width?: number; variants?: { width: number; url: string }[] },
  _width: number,
  sizes: string,
) {
  // The action owns src/srcset. A spread containing undefined keys lets Svelte
  // remove attributes set by the action when a crop or another prop changes.
  return { sizes };
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
