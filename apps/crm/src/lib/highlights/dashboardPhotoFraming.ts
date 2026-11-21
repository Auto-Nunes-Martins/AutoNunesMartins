import { photoGeometry, type PhotoFraming } from '@anm/types';

export function dashboardPhotoGeometry(
  image: { width: number; height: number },
  frame: { width: number; height: number },
  mobile: boolean,
  framing?: PhotoFraming,
) {
  const position = framing?.[mobile ? 'mobile' : 'desktop'] ?? { x: 50, y: 50 };
  // Recreate the detail gallery crop before fitting its visible image to the dashboard.
  const detailFrame = { width: (mobile ? 1.3 : 1.5) * frame.height, height: frame.height };
  const detail = photoGeometry(image, detailFrame, position);
  if (!detail || !Number.isFinite(frame.width) || frame.width <= 0) return;

  const cropLeft = Math.max(0, -detail.left);
  const cropTop = Math.max(0, -detail.top);
  const cropRight = Math.max(0, detail.left + detail.width - detailFrame.width);
  const cropBottom = Math.max(0, detail.top + detail.height - detailFrame.height);
  const cropWidth = detail.width - cropLeft - cropRight;
  const cropHeight = detail.height - cropTop - cropBottom;
  const scale = Math.min(frame.width / cropWidth, frame.height / cropHeight);
  const remainingWidth = frame.width - cropWidth * scale;
  const remainingHeight = frame.height - cropHeight * scale;

  return {
    width: detail.width * scale,
    height: detail.height * scale,
    left: (remainingWidth * detail.x) / 100 - cropLeft * scale,
    top: (remainingHeight * detail.y) / 100 - cropTop * scale,
    clipPath: `inset(${cropTop * scale}px ${cropRight * scale}px ${cropBottom * scale}px ${cropLeft * scale}px)`,
    backdrop: remainingWidth > 1 || remainingHeight > 1,
    x: detail.x,
    y: detail.y,
  };
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
    node.style.clipPath = geometry.clipPath;
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
