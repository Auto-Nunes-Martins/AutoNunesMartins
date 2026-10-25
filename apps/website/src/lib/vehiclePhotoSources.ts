import { vehiclePhotoWidths } from '@anm/types/photoWidths';
export const photoWidths = vehiclePhotoWidths;
// One existing derivative per photograph across cards, thumbnails and viewers.
// The backend retains its native-master fallback for smaller originals.
export const publicPhotoWidth = 1600;
const isPublicPhoto = (url: string) =>
  /^\/(?:api\/public\/vehicles|viaturas)\/[^/?]+\/photos\/\d+(?:\?v=[a-f0-9]{64})?$/.test(url);
export const sizedPhoto = (url: string, _width: number) =>
  isPublicPhoto(url) ? `${url}${url.includes('?') ? '&' : '?'}w=${publicPhotoWidth}` : url;
export const nearestPhotoWidth = (width: number) =>
  photoWidths.find((candidate) => candidate >= width) ?? 2560;
export const vehiclePhotoSet = (_url: string): string | undefined => undefined;
