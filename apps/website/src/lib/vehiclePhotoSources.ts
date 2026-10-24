import { vehiclePhotoWidths } from '@anm/types/photoWidths';
export const photoWidths = vehiclePhotoWidths;
const isPublicPhoto = (url: string) =>
  /^\/(?:api\/public\/vehicles|viaturas)\/[^/?]+\/photos\/\d+(?:\?v=[a-f0-9]{64})?$/.test(url);
export const sizedPhoto = (url: string, width: number) =>
  isPublicPhoto(url) ? `${url}${url.includes('?') ? '&' : '?'}w=${width}` : url;
export const nearestPhotoWidth = (width: number) =>
  photoWidths.find((candidate) => candidate >= width) ?? 2560;
export const vehiclePhotoSet = (url: string) =>
  isPublicPhoto(url)
    ? photoWidths.map((width) => `${sizedPhoto(url, width)} ${width}w`).join(', ')
    : undefined;
