import { vehiclePhotoWidths } from '@anm/types/photoWidths';
export { detailPhotoSizes, detailPhotoWidth } from '../../../../shared/photoResolution.mjs';
import { detailPhotoSizesForRatio } from '../../../../shared/photoResolution.mjs';
import { detailPhotoWidth } from '../../../../shared/photoResolution.mjs';
type Dimensions = { version: string; width: number; height: number };
export function detailPhotoDimensions(
  vehicle: {
    photos: string[];
    photoDimensions?: (Dimensions | null)[];
    coverPhotoDimensions?: Dimensions | null;
  },
  index: number,
) {
  const dimensions =
    vehicle.photoDimensions?.[index] ?? (index === 0 ? vehicle.coverPhotoDimensions : undefined);
  return dimensions?.version === vehicle.photos[index]?.match(/\?v=([a-f0-9]{64})$/)?.[1]
    ? dimensions
    : undefined;
}
export const detailPhotoRatio = (
  vehicle: Parameters<typeof detailPhotoDimensions>[0],
  index: number,
) => {
  const dimensions = detailPhotoDimensions(vehicle, index);
  return dimensions ? dimensions.width / dimensions.height : 0;
};
export const galleryPhotoSizes = (vehicle: Parameters<typeof detailPhotoRatio>[0], index: number) =>
  detailPhotoSizesForRatio(detailPhotoRatio(vehicle, index));
export const galleryPhotoWidth = (
  vehicle: Parameters<typeof detailPhotoRatio>[0],
  index: number,
) =>
  typeof window === 'undefined'
    ? 1600
    : detailPhotoWidth(
        window.innerWidth,
        window.devicePixelRatio || 1,
        detailPhotoRatio(vehicle, index),
      );
export const photoWidths = vehiclePhotoWidths;
// Detail main, thumbnails, gallery and fullscreen share one existing derivative.
// The backend retains its native-master fallback for smaller originals.
export const publicPhotoWidth = 1600;
const isPublicPhoto = (url: string) =>
  /^\/(?:api\/public\/vehicles|viaturas)\/[^/?]+\/photos\/\d+(?:\?v=[a-f0-9]{64})?$/.test(url);
export const sizedPhoto = (url: string, width: number) =>
  isPublicPhoto(url) ? `${url}${url.includes('?') ? '&' : '?'}w=${nearestPhotoWidth(width)}` : url;
export const nearestPhotoWidth = (width: number) =>
  photoWidths.find((candidate) => candidate >= width) ?? 2560;
export const vehiclePhotoSet = (url: string): string | undefined => cardPhotoSet(url);

/** Cards alone negotiate derivatives; detail delivery stays fixed at 1600. */
export const cardPhoto = (url: string, width = 800) =>
  isPublicPhoto(url) ? `${url}${url.includes('?') ? '&' : '?'}w=${nearestPhotoWidth(width)}` : url;
export const cardPhotoSet = (url: string): string | undefined =>
  isPublicPhoto(url)
    ? photoWidths.map((width) => `${cardPhoto(url, width)} ${width}w`).join(', ')
    : undefined;
