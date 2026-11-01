import type { PhotoFraming } from '@anm/types';

const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value));

/** Translate the chosen public crop's centre into the dashboard's smaller safe area.
 * No subject detection: framing is the owner's focal hint, not a car bounding box.
 */
export function dashboardPhotoGeometry(
  image: { width: number; height: number },
  frame: { width: number; height: number },
  mobile: boolean,
  framing?: PhotoFraming,
) {
  const dimensions = [image.width, image.height, frame.width, frame.height];
  if (dimensions.some((value) => !Number.isFinite(value) || value <= 0)) return undefined;
  const position = framing?.[mobile ? 'mobile' : 'desktop'] ?? { x: 50, y: 53 };
  const imageRatio = image.width / image.height;
  const frameRatio = frame.width / frame.height;
  // Horizontal photos with a similar ratio can fill the panel directly: at most
  // 8% of their area is cropped. Do not add an inset when it solves nothing.
  if (imageRatio >= 1 && Math.min(imageRatio / frameRatio, frameRatio / imageRatio) >= 0.92) {
    const scale = Math.max(frame.width / image.width, frame.height / image.height);
    const width = image.width * scale,
      height = image.height * scale;
    return {
      width,
      height,
      scale,
      left: ((frame.width - width) * clamp(position.x, 0, 100)) / 100,
      top: ((frame.height - height) * clamp(position.y, 0, 100)) / 100,
    };
  }
  // These are the existing chooser/public viewport ratios, not new persisted settings.
  const referenceRatio = mobile ? 1.85 : 1.65;
  const cropWidth = Math.min(image.width, image.height * referenceRatio);
  const cropHeight = cropWidth / referenceRatio;
  const focalX = ((image.width - cropWidth) * clamp(position.x, 0, 100)) / 100 + cropWidth / 2;
  const focalY = ((image.height - cropHeight) * clamp(position.y, 0, 100)) / 100 + cropHeight / 2;
  const side = frame.width * 0.05;
  const top = Math.min(frame.height * 0.2, clamp(frame.height * 0.08, 24, 56));
  const bottom = Math.min(frame.height * 0.3, clamp(frame.height * 0.16, 80, 88));
  const safeWidth = frame.width - side * 2;
  const safeHeight = frame.height - top - bottom;
  const scale = Math.min(safeWidth / cropWidth, safeHeight / cropHeight);
  const width = image.width * scale,
    height = image.height * scale;
  const fitAxis = (offset: number, size: number, start: number, end: number) =>
    clamp(offset, Math.min(start, end - size), Math.max(start, end - size));
  return {
    width,
    height,
    left: fitAxis(frame.width / 2 - focalX * scale, width, side, frame.width - side),
    top: fitAxis(top + safeHeight / 2 - focalY * scale, height, top, frame.height - bottom),
    scale,
  };
}

/** Recompute after decoding, viewport changes and copy-driven carousel height changes. */
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
