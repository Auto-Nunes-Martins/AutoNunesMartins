import { standDefaults, type StandIndex, type StandProfile } from './heroStandSettings';
export type ResponsiveStandFrame = { width: number; left: number; top: number };
const unit = (value: number) => Math.min(1, Math.max(0, value));
const referenceProfiles = standDefaults().profiles;
// Approved desktop canvas: 2560x1440, with a 740px stage plus 4svh.
export const standDesktopReference = { width: 2560, height: 797.6 };
// Facade landmarks already used by the unchanged tablet/mobile art direction.
export const standFocalPoints = [
  { x: 0.43, y: 0.42 },
  { x: 0.5, y: 0.44 },
] as const;
/** Separate the horizontal source landmark from its screen anchor, calibrated to the saved 2K view. */
export function desktopStandAnchor(profile: StandProfile, index: StandIndex) {
  const frameWidth = (standDesktopReference.width * profile.width) / 100;
  const frameHeight = (standDesktopReference.height * profile.height) / 100;
  const imageWidth = (Math.max(frameWidth, (frameHeight * 4) / 3) * profile.zoom) / 100;
  const x = (profile.x ?? 50) / 100;
  const focal = standFocalPoints[index];
  return {
    x: 100 * (x + ((focal.x - x) * imageWidth) / frameWidth),
    focalX: focal.x * 100,
  };
}
/** cqh width for a uniform cover of the approved canvas, including custom profiles. */
export function desktopStandRatioZoom(profile: StandProfile): number {
  const width = (standDesktopReference.width * profile.width) / 100;
  const height = (standDesktopReference.height * profile.height) / 100;
  return Math.max(height > 0 ? width / height : 0, 4 / 3) * profile.zoom;
}
/** Desktop uses the approved profile directly in CSS from the first paint.
 * Keep the existing tablet/mobile art direction below the navigation breakpoint. */
export function responsiveStandFraming(
  profile: StandProfile,
  index: StandIndex,
  viewport: number,
  frameWidth: number,
  frameHeight: number
): ResponsiveStandFrame | null {
  if (viewport > 1000) return null;
  const progress = unit((2560 - viewport) / 1280);
  const blend = 1 - (1 - progress) ** 2;
  const portrait = unit((900 - viewport) / 470);
  const {
    zoom: referenceZoom,
    x: referenceX,
    y: referenceY,
  } = referenceProfiles[index] as StandProfile & { x: number; y: number };
  const x = (profile.x ?? referenceX) / 100,
    y = (profile.y ?? referenceY) / 100;
  const originalWidth = (Math.max(frameWidth, (frameHeight * 4) / 3) * profile.zoom) / 100;
  const originalLeft = x * (frameWidth - originalWidth);
  const originalTop = y * (frameHeight - (originalWidth * 3) / 4);
  const heightFloor = (index === 0 ? 1.4 : 1.45) - portrait * 0.25;
  const zoomRatio = profile.zoom / referenceZoom;
  const targetWidth = Math.max(
    originalWidth,
    frameWidth * 1.1 * zoomRatio,
    ((frameHeight * heightFloor * 4) / 3) * zoomRatio
  );
  const sourceX = index === 0 ? 0.43 : 0.5;
  const sourceY = index === 0 ? 0.42 : 0.44;
  const targetX = index === 0 ? 0.48 : 0.45;
  const targetY = 0.18 - (index === 1 ? portrait * 0.02 : 0);
  const targetLeft =
    frameWidth * targetX -
    targetWidth * sourceX +
    (x - referenceX / 100) * (frameWidth - targetWidth);
  const targetTop =
    frameHeight * targetY -
    targetWidth * 0.75 * sourceY +
    (y - referenceY / 100) * (frameHeight - targetWidth * 0.75);
  const mix = (from: number, to: number) => Math.round((from + (to - from) * blend) * 1000) / 1000;
  return {
    width: mix(originalWidth, targetWidth),
    left: mix(originalLeft, targetLeft),
    top: mix(originalTop, targetTop),
  };
}
