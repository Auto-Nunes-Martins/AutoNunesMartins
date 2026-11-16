import { photoGeometry, type PhotoFraming } from '@anm/types';

// Fill only when at least 85% of the photo remains visible along each axis.
const minimumVisibleFraction = 0.85;

export function dashboardPhotoGeometry(
  image: { width: number; height: number },
  frame: { width: number; height: number },
  mobile: boolean,
  framing?: PhotoFraming,
) {
  const position = framing?.[mobile ? 'mobile' : 'desktop'] ?? { x: 50, y: 50 };
  if (image.height > image.width || position.fit === 'contain') {
    return photoGeometry(image, frame, {
      ...position,
      fit: position.fit === 'contain' ? 'contain' : 'auto',
      zoom: 1,
    });
  }

  const cover = photoGeometry(image, frame, { ...position, fit: 'cover', zoom: 1 });
  if (!cover) return;
  const visibleFraction = Math.min(frame.width / cover.width, frame.height / cover.height);
  if (visibleFraction < minimumVisibleFraction) {
    return photoGeometry(image, frame, { ...position, fit: 'contain', zoom: 1 });
  }
  const zoom = Math.min(position.zoom ?? 1, visibleFraction / minimumVisibleFraction);
  return photoGeometry(image, frame, { ...position, fit: 'cover', zoom });
}
/** Recompute after decoding and when the photo panel resizes. */
export function dashboardPhotoFraming(
  node: HTMLImageElement,
  options: { framing?: PhotoFraming; active: boolean },
) {
  const parent = node.parentElement;
  if (!parent) return {};
  const device = window.matchMedia('(max-width: 700px)');
  const render = () => {
    const geometry = dashboardPhotoGeometry(
      { width: node.naturalWidth, height: node.naturalHeight },
      { width: parent.clientWidth, height: parent.clientHeight },
      device.matches,
      options.framing,
    );
    if (!geometry) return;
    for (const key of ['width', 'height', 'left', 'top'] as const)
      node.style[key] = `${geometry[key]}px`;
    if (options.active) {
      const fills = !geometry.backdrop;
      parent.dataset.dashboardFit = fills ? 'fill' : 'safe';
      // Reuse the decoded responsive variant, never request a separate master/backdrop URL.
      parent.style.setProperty(
        '--dashboard-backdrop',
        fills ? 'none' : `url("${node.currentSrc || node.src}")`,
      );
      parent.style.setProperty('--dashboard-backdrop-position', `${geometry.x}% ${geometry.y}%`);
    }
  };
  const observer = new ResizeObserver(render);
  observer.observe(parent);
  node.addEventListener('load', render);
  device.addEventListener('change', render);
  render();
  return {
    update(value: { framing?: PhotoFraming; active: boolean }) {
      options = value;
      if (options.active) {
        parent.dataset.dashboardFit = 'loading';
        parent.style.setProperty('--dashboard-backdrop', 'none');
      }
      render();
    },
    destroy() {
      observer.disconnect();
      node.removeEventListener('load', render);
      device.removeEventListener('change', render);
    },
  };
}
