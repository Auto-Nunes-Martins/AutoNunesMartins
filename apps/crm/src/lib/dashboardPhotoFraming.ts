import { photoGeometry, type PhotoFraming } from '@anm/types';

/** Use the same fit, zoom and focal position as the shared framing editor. */
export function dashboardPhotoGeometry(
  image: { width: number; height: number },
  frame: { width: number; height: number },
  mobile: boolean,
  framing?: PhotoFraming,
) {
  const position = framing?.[mobile ? 'mobile' : 'desktop'] ?? { x: 50, y: 53 };
  return photoGeometry(image, frame, position, 'auto');
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
      const fills =
        geometry.width >= parent.clientWidth - 1 &&
        geometry.height >= parent.clientHeight - 1 &&
        geometry.left <= 1 &&
        geometry.top <= 1;
      parent.dataset.dashboardFit = fills ? 'fill' : 'safe';
      // Reuse the decoded responsive variant, never request a separate master/backdrop URL.
      parent.style.setProperty(
        '--dashboard-backdrop',
        fills ? 'none' : `url("${node.currentSrc || node.src}")`,
      );
      const position = options.framing?.[device.matches ? 'mobile' : 'desktop'] ?? { x: 50, y: 53 };
      parent.style.setProperty('--dashboard-backdrop-position', `${position.x}% ${position.y}%`);
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
