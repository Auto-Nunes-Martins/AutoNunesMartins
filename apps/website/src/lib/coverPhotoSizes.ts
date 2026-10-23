import { coverSourceWidth } from './coverImageSizes';
import { scrollFrame } from './components/stand-concepts/scrollFrame';

/** A cover crop can need more source pixels than the image element's width.
 * Keep sizes in CSS pixels; the browser applies density and selects a candidate.
 */
export function coverPhotoSizes(node: HTMLImageElement) {
  const task = scrollFrame(() => {
    if (!node.srcset || !node.naturalWidth || !node.naturalHeight) return;
    if (getComputedStyle(node).objectFit !== 'cover') return;
    const bounds = node.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    const sizes = `${coverSourceWidth(bounds.width, bounds.height, node.naturalWidth / node.naturalHeight)}px`;
    if (node.sizes === sizes) return;
    return () => { node.sizes = sizes; };
  });
  const measure = () => task.schedule();
  const observer = new ResizeObserver(measure);
  observer.observe(node);
  node.addEventListener('load', measure);
  window.addEventListener('resize', measure);
  measure();
  return {
    destroy() {
      task.cancel();
      observer.disconnect();
      node.removeEventListener('load', measure);
      window.removeEventListener('resize', measure);
    },
  };
}
