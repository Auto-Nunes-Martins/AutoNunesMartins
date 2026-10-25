/** Curated CDN images and the bounded, authorization-checked local photo endpoints. */
import { sizedPhoto, vehiclePhotoSet, nearestPhotoWidth } from '$lib/vehiclePhotoSources';
export const imageWidths = [320, 480, 640, 960, 1280, 1600, 1920] as const;

// Vite imports are root-relative during SSR but absolute URLs in the browser.
// Only curated Unsplash identifiers should be expanded into CDN URLs.
export const photo = (id: string, width = 1400) =>
  /^photo-[a-zA-Z0-9-]+$/.test(id)
    ? `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${width}&q=85`
    : sizedPhoto(id, nearestPhotoWidth(width));

export function responsivePhoto(id: string, maximum = 1920): string | undefined {
  if (!/^photo-[a-zA-Z0-9-]+$/.test(id)) return vehiclePhotoSet(id);
  return imageWidths
    .filter((width) => width <= maximum)
    .map(
      (width) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${width}&q=80 ${width}w`,
    )
    .join(', ');
}

export const cardImageSizes =
  '(max-width: 700px) calc(100vw - 32px), (max-width: 1050px) 46vw, (min-width: 1920px) 550px, 31vw';

/** Public mobile cards occupy 90vw, with height = width / 1.4 + 60px.
 * Cover must supply the entire uncropped source, not just the visible box width.
 * Leave DPR to the browser; retain the existing desktop and unknown-photo fallback.
 */
export function publicCardImageSizes(dimensions?: { width: number; height: number } | null, catalog = false) {
  if (!dimensions || !Number.isFinite(dimensions.width) || !Number.isFinite(dimensions.height) || dimensions.width <= 0 || dimensions.height <= 0) return cardImageSizes;
  const ratio = dimensions.width / dimensions.height;
  const cover = (vw: number, px: number) => `max(calc(${vw}vw + ${px}px), calc(${(vw / 1.4 * ratio).toFixed(6)}vw + ${((px / 1.4 + 60) * ratio).toFixed(6)}px))`;
  // Catalogue has two columns and a 24px gap between 541 and 700px.
  const mobile = catalog
    ? `(max-width: 540px) ${cover(90, 0)}, (max-width: 700px) ${cover(45, -12)}, `
    : `(max-width: 700px) ${cover(90, 0)}, `;
  return mobile +
    '(max-width: 1050px) 46vw, (min-width: 1920px) 550px, 31vw';
}
export const heroImageSizes =
  '(max-width: 700px) 100vw, (max-width: 1050px) 70vw, (min-width: 1920px) 980px, 56vw';

// Match the permanent hero's grid, including the tablet gap and its capped canvas.
// sizes describes CSS pixels; the browser applies device density.
export const featuredPhotoSizes =
  '(max-width: 700px) calc(100vw - 40px), (max-width: 1050px) 40.022vw, min(38.337vw, 682px)';
