export const photoWidths = Object.freeze([320, 384, 800, 1280, 1600, 2560]);
export const nearestPhotoWidth = (pixels) => photoWidths.find((width) => width >= pixels) ?? 2560;
/** Matches the public detail's frame, gap and photography column. */
export function detailPhotoSlot(viewport) {
  if (viewport <= 700) return viewport;
  const frame = Math.min(viewport * 0.96, viewport - 48, viewport > 1920 ? 1440 : 1320);
  const gap = Math.min(72, Math.max(32, viewport * 0.04));
  return viewport <= 1050
    ? Math.min(((frame - gap) * 1.8) / 2.8, frame - gap - 260)
    : Math.min(((frame - gap) * 2.6) / 3.6, frame - gap - 280);
}
export const detailPhotoSizes =
  '(max-width: 700px) 100vw, (max-width: 1050px) calc((min(96vw, 100vw - 48px) - clamp(32px, 4vw, 72px)) * 0.642857), calc((min(96vw, 100vw - 48px, 1320px) - clamp(32px, 4vw, 72px)) * 0.722222)';
export function detailPhotoWidth(viewport, density = 1, ratio = 0) {
  return nearestPhotoWidth(
    detailPhotoSlot(viewport) *
      Math.max(1, density) *
      Math.max(1, ratio / (viewport <= 700 ? 4 / 3 : 1.4)),
  );
}
export function detailPhotoSizesForRatio(ratio = 0) {
  const mobile = Math.max(1, ratio / (4 / 3)),
    desktop = Math.max(1, ratio / 1.4);
  return `(max-width: 700px) calc(100vw * ${mobile}), (max-width: 1050px) calc((min(96vw, 100vw - 48px) - clamp(32px, 4vw, 72px)) * ${0.642857 * desktop}), (min-width: 1921px) calc(1368px * ${0.722222 * desktop}), calc((min(96vw, 100vw - 48px, 1320px) - clamp(32px, 4vw, 72px)) * ${0.722222 * desktop})`;
}
/** A larger fullscreen copy only earns a transfer when it adds at least 20% detail. */
export function fullscreenPhotoWidth(width, height, ratio, density, loadedWidth) {
  const pixels = Math.min(width, height * Math.max(0.1, ratio || 1.5)) * Math.max(1, density);
  return pixels > loadedWidth * 1.2 ? nearestPhotoWidth(pixels) : loadedWidth;
}
