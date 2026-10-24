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
export const heroImageSizes =
  '(max-width: 700px) 100vw, (max-width: 1050px) 70vw, (min-width: 1920px) 980px, 56vw';

// Match the permanent hero's grid, including the tablet gap and its capped canvas.
// sizes describes CSS pixels; the browser applies device density.
export const featuredPhotoSizes =
  '(max-width: 700px) calc(100vw - 40px), (max-width: 1050px) 40.022vw, min(38.337vw, 682px)';
