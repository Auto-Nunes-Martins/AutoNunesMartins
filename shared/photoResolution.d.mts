export const photoWidths: readonly number[];
export const nearestPhotoWidth: (pixels: number) => number;
export const detailPhotoSlot: (viewport: number) => number;
export const detailPhotoSizes: string;
export const detailPhotoWidth: (viewport: number, density?: number, ratio?: number) => number;
export const detailPhotoSizesForRatio: (ratio?: number) => string;
export const fullscreenPhotoWidth: (
  width: number,
  height: number,
  ratio: number,
  density: number,
  loadedWidth: number,
) => number;
