import { coverSourceWidth } from './coverImageSizes';
import { scrollFrame } from './components/stand-concepts/scrollFrame';
import {
  cardPhoto,
  cardPhotoSet,
  detailPhotoDimensions,
  type PhotoDimensions,
} from './vehiclePhotoSources';

export type CoverPhotoSizeHint = { source: string; dimensions: PhotoDimensions };

/** A cover crop can need more source pixels than the image element's width.
 * Keep sizes in CSS pixels; the browser applies density and selects a candidate.
 */
export function coverPhotoSizes(node: HTMLImageElement, hint?: CoverPhotoSizeHint) {
  const resourceKey = () => `${node.getAttribute('src') ?? ''}\n${node.srcset}`;
  let resource = resourceKey();
  // naturalWidth/Height are density-corrected integer CSS pixels. Reading their
  // ratio again after writing sizes can feed that rounding back into another load.
  // Without canonical metadata, retain a conservative ratio for this resource.
  const decodedRatio = () =>
    node.srcset &&
    node.complete &&
    !/^(?:data|blob):/.test(node.currentSrc) &&
    node.naturalWidth > 0 &&
    node.naturalHeight > 0
      ? (node.naturalWidth + 1) / node.naturalHeight
      : undefined;
  let inferredRatio = decodedRatio();
  const syncResource = () => {
    const next = resourceKey();
    if (next !== resource) {
      resource = next;
      inferredRatio = undefined;
    }
  };
  const task = scrollFrame(() => {
    syncResource();
    if (!node.srcset) return;
    const dimensions =
      hint &&
      node.getAttribute('src') === cardPhoto(hint.source) &&
      node.srcset === cardPhotoSet(hint.source)
        ? detailPhotoDimensions({ photos: [hint.source], coverPhotoDimensions: hint.dimensions }, 0)
        : undefined;
    const ratio = dimensions ? dimensions.width / dimensions.height : inferredRatio;
    if (!ratio) return;
    if (getComputedStyle(node).objectFit !== 'cover') return;
    const bounds = node.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    const sizes = `${coverSourceWidth(bounds.width, bounds.height, ratio)}px`;
    if (node.sizes === sizes) return;
    const measuredResource = resource;
    return () => {
      if (resourceKey() === measuredResource) node.sizes = sizes;
    };
  });
  const measure = () => task.schedule();
  const loaded = () => {
    syncResource();
    inferredRatio ??= decodedRatio();
    measure();
  };
  const failed = () => {
    resource = resourceKey();
    inferredRatio = undefined;
    task.cancel();
  };
  const observer = new ResizeObserver(measure);
  observer.observe(node);
  node.addEventListener('load', loaded);
  node.addEventListener('error', failed);
  window.addEventListener('resize', measure);
  measure();
  return {
    update(next?: CoverPhotoSizeHint) {
      hint = next;
      syncResource();
      task.cancel();
      measure();
    },
    destroy() {
      task.cancel();
      observer.disconnect();
      node.removeEventListener('load', loaded);
      node.removeEventListener('error', failed);
      window.removeEventListener('resize', measure);
    },
  };
}
