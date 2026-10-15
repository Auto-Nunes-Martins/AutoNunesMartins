import { standDefaults, type StandIndex, type StandProfile } from './heroStandSettings';
export type ResponsiveStandFrame = { width: number; left: number; top: number };
const unit = (value: number) => Math.min(1, Math.max(0, value));
const referenceProfiles = standDefaults().profiles;
/** Keep the approved 2K reference untouched; interpolate toward the facade on smaller screens. */
export function responsiveStandFraming(profile: StandProfile, index: StandIndex, viewport: number, frameWidth: number, frameHeight: number): ResponsiveStandFrame | null {
  if (viewport >= 2560) return null;
  const progress = unit((2560 - viewport) / 1280);
  const blend = 1 - (1 - progress) ** 2;
  const portrait = unit((900 - viewport) / 470);
  const { zoom: referenceZoom, x: referenceX, y: referenceY } = referenceProfiles[index] as StandProfile & { x: number; y: number };
  const x = (profile.x ?? referenceX) / 100, y = (profile.y ?? referenceY) / 100;
  const originalWidth = Math.max(frameWidth, frameHeight * 4 / 3) * profile.zoom / 100;
  const originalLeft = x * (frameWidth - originalWidth);
  const originalTop = y * (frameHeight - originalWidth * 3 / 4);
  const heightFloor = (index === 0 ? 1.4 : 1.45) - portrait * .25;
  const zoomRatio = profile.zoom / referenceZoom;
  const targetWidth = Math.max(originalWidth, frameWidth * 1.1 * zoomRatio, frameHeight * heightFloor * 4 / 3 * zoomRatio);
  const sourceX = index === 0 ? .43 : .5;
  const sourceY = index === 0 ? .42 : .44;
  const targetX = index === 0 ? .48 : .45;
  const targetY = .18 - (index === 1 ? portrait * .02 : 0);
  const targetLeft = frameWidth * targetX - targetWidth * sourceX + (x - referenceX / 100) * (frameWidth - targetWidth);
  const targetTop = frameHeight * targetY - targetWidth * .75 * sourceY + (y - referenceY / 100) * (frameHeight - targetWidth * .75);
  const mix = (from: number, to: number) => Math.round((from + (to - from) * blend) * 1000) / 1000;
  return { width: mix(originalWidth, targetWidth), left: mix(originalLeft, targetLeft), top: mix(originalTop, targetTop) };
}
