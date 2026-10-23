export function coverSourceWidth(width: number, height: number, aspectRatio: number) {
  return Math.ceil(Math.max(width, height * aspectRatio));
}

type Framing = { desktop: number; portrait: number };
/** Lazy backgrounds can use their actual cover area before entering the viewport.
 * sizes is in CSS pixels: the browser applies its own device pixel ratio.
 */
export function coverImageSizes(picture: HTMLPictureElement, framing: Framing) {
  const measure = () => {
    const image = picture.querySelector('img');
    if (!image) return;
    const bounds = image.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    const ratio = innerWidth <= 700 ? framing.portrait : framing.desktop;
    const sizes = `${coverSourceWidth(bounds.width, bounds.height, ratio)}px`;
    for (const node of picture.querySelectorAll<HTMLImageElement | HTMLSourceElement>(
      'img, source',
    )) {
      if (node.sizes !== sizes) node.sizes = sizes;
    }
  };
  const observer = new ResizeObserver(measure);
  observer.observe(picture);
  const image = picture.querySelector('img');
  if (image) observer.observe(image);
  window.addEventListener('resize', measure);
  measure();
  return {
    update(next: Framing) {
      framing = next;
      measure();
    },
    destroy() {
      observer.disconnect();
      window.removeEventListener('resize', measure);
    },
  };
}
