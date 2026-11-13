/// <reference lib="dom" />
import type { PhotoFraming } from './photoFraming.js';

export type PhotoFit = 'auto' | 'cover' | 'contain';
export type PhotoPosition = PhotoFraming['desktop'];

/** Geometry shared by the editor, public images and dashboard. */
export function photoGeometry(
  image: { width: number; height: number },
  frame: { width: number; height: number },
  position: PhotoPosition,
  defaultFit: PhotoFit = 'cover',
) {
  if (![image.width, image.height, frame.width, frame.height].every(n => Number.isFinite(n) && n > 0))
    return undefined;
  const requested = position.fit ?? defaultFit;
  const fit = requested === 'auto' ? (image.height > image.width ? 'contain' : 'cover') : requested;
  const scale = (fit === 'contain' ? Math.min : Math.max)(
    frame.width / image.width, frame.height / image.height,
  ) * (position.zoom ?? 1);
  const width = image.width * scale;
  const height = image.height * scale;
  const x = requested === 'contain' && image.height > image.width ? 50 : position.x;
  const y = requested === 'contain' && image.width > image.height ? 50 : position.y;
  return {
    fit, scale, width, height, x, y,
    left: (frame.width - width) * x / 100,
    top: (frame.height - height) * y / 100,
    backdrop: width < frame.width - 1 || height < frame.height - 1,
  };
}

type Options = {
  framing?: PhotoFraming;
  defaultFit?: PhotoFit;
  defaultY?: number;
  active?: boolean;
  enabled?: boolean;
  device?: 'desktop' | 'mobile';
};

/** Keeps the existing image box and responsive source; only its contents are fitted. */
export function photoFraming(node: HTMLImageElement, options: Options = {}) {
  const container = node.parentElement?.tagName === 'PICTURE'
    ? node.parentElement.parentElement : node.parentElement;
  if (!container) return {};
  const frame: HTMLElement = container;
  const media = window.matchMedia('(max-width: 700px)');
  let backdrop: HTMLDivElement | undefined;
  const properties = ['object-fit', 'object-position', 'transform', 'transform-origin', 'position'];
  const original = properties.map(name => [name, node.style.getPropertyValue(name), node.style.getPropertyPriority(name)]);
  function clearBackdrop() {
    backdrop?.remove();
    backdrop = undefined;
  }
  function restore() {
    for (const [name, value, priority] of original) {
      if (name) node.style.setProperty(name, value ?? '', priority ?? '');
    }
    backdrop?.remove();
    backdrop = undefined;
  }
  function render() {
    if (options.enabled === false) { restore(); return; }
    const device = options.device ?? (media.matches ? 'mobile' : 'desktop');
    const position = options.framing?.[device] ?? { x: 50, y: options.defaultY ?? 50 };
    const origin = `${position.x}% ${position.y}%`;
    node.style.setProperty('object-position', origin, 'important');
    node.style.setProperty('transform-origin', origin);
    if ((position.zoom ?? 1) !== 1) node.style.transform = `scale(${position.zoom})`;
    else node.style.removeProperty('transform');
    const geometry = photoGeometry(
      { width: node.naturalWidth, height: node.naturalHeight },
      { width: node.clientWidth, height: node.clientHeight }, position, options.defaultFit,
    );
    if (!geometry) { clearBackdrop(); return; }
    const fittedOrigin = `${geometry.x}% ${geometry.y}%`;
    node.style.setProperty('object-position', fittedOrigin, 'important');
    node.style.setProperty('transform-origin', fittedOrigin);
    node.style.setProperty('object-fit', geometry.fit, 'important');
    if (geometry.backdrop && options.active !== false) {
      if (!backdrop) {
        backdrop = document.createElement('div');
        backdrop.setAttribute('aria-hidden', 'true');
        backdrop.dataset.photoBackdrop = '';
        backdrop.style.cssText = 'position:absolute;inset:0;pointer-events:none;overflow:hidden;background-size:cover;background-position:center;filter:blur(12px) brightness(.55);transform:scale(1.08);';
        frame.prepend(backdrop);
      }
      backdrop.style.backgroundImage = `url(${JSON.stringify(node.currentSrc || node.src)})`;
      if (getComputedStyle(node).position === 'static') node.style.position = 'relative';
    } else {
      backdrop?.remove();
      backdrop = undefined;
    }
  }
  const observer = new ResizeObserver(render);
  observer.observe(node);
  node.addEventListener('load', render);
  node.addEventListener('error', clearBackdrop);
  media.addEventListener('change', render);
  render();
  return {
    update(next: Options) { options = next; render(); },
    destroy() {
      observer.disconnect();
      node.removeEventListener('load', render);
      node.removeEventListener('error', clearBackdrop);
      media.removeEventListener('change', render);
      restore();
    },
  };
}
