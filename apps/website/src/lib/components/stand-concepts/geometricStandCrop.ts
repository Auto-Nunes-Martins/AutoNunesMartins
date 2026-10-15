export type GeometricCrop = { left: number; right: number; possible: boolean };
/** Percentages are relative to the unchanged full photograph, not its clipped width. */
export function geometricStandCrop(imageLeft: number, imageRight: number, visibleLeft: number, visibleRight: number, centre: number): GeometricCrop {
  const width = imageRight - imageLeft;
  const leftDistance = centre - visibleLeft;
  const rightDistance = visibleRight - centre;
  if (width <= 0 || leftDistance <= 0 || rightDistance <= 0) return { left: 0, right: 0, possible: false };
  if (Math.abs(leftDistance - rightDistance) <= 1) return { left: 0, right: 0, possible: true };
  const left = leftDistance > rightDistance ? (centre - rightDistance - imageLeft) / width * 100 : 0;
  const right = rightDistance > leftDistance ? (imageRight - centre - leftDistance) / width * 100 : 0;
  // Respect the widget's safe range and avoid pretending an impossible framing is balanced.
  if (left > 45 || right > 45) return { left: 0, right: 0, possible: false };
  return { left: Math.round(Math.max(0, left) * 1000) / 1000, right: Math.round(Math.max(0, right) * 1000) / 1000, possible: true };
}

export function measureGeometricStandCrop(image: HTMLImageElement): GeometricCrop {
  const bounds = image.getBoundingClientRect();
  const pageWidth = document.documentElement.clientWidth;
  let left = Math.max(0, bounds.left), right = Math.min(pageWidth, bounds.right);
  for (let parent = image.parentElement; parent; parent = parent.parentElement) {
    if (!['hidden', 'clip', 'scroll', 'auto'].includes(getComputedStyle(parent).overflowX)) continue;
    const box = parent.getBoundingClientRect();
    const clipLeft = box.left + parent.clientLeft;
    left = Math.max(left, clipLeft);
    right = Math.min(right, clipLeft + parent.clientWidth);
  }
  return geometricStandCrop(bounds.left, bounds.right, left, right, pageWidth / 2);
}
