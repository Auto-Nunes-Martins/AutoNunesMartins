export const photoWidths = [320, 800, 1600, 2560] as const;
const isPublicPhoto = (url: string) =>
  /^\/(?:api\/public\/vehicles|viaturas)\/[^/?]+\/photos\/\d+$/.test(url);
export const sizedPhoto = (url: string, width: number) =>
  isPublicPhoto(url) ? `${url}?w=${width}` : url;
export const vehiclePhotoSet = (url: string) =>
  isPublicPhoto(url)
    ? photoWidths.map((width) => `${url}?w=${width} ${width}w`).join(', ')
    : undefined;
