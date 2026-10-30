import { expect, it } from 'vitest';
import { selectPhoto } from './reusablePhoto';
import { detailPhotoWidth, fullscreenPhotoWidth } from '../../../../shared/photoResolution.mjs';
it('chooses existing signed candidates and keeps small masters and draft blobs', () => {
  const p = {
    url: 'master',
    width: 1600,
    variants: [
      { url: '320', width: 320 },
      { url: '800', width: 800 },
    ],
  };
  expect(selectPhoto(p, 700)?.url).toBe('800');
  expect(selectPhoto(p, 1200)?.url).toBe('master');
  expect(selectPhoto({ url: 'small', width: 200 }, 800)?.url).toBe('small');
  expect(selectPhoto({ url: 'blob:local' }, 800)?.url).toBe('blob:local');
  expect(selectPhoto({ url: null }, 800)).toBeUndefined();
});
it('keeps density appropriate gallery groups and upgrades fullscreen only with real benefit', () => {
  expect(detailPhotoWidth(390, 2)).toBe(800);
  expect(detailPhotoWidth(1440, 1)).toBe(1280);
  expect(fullscreenPhotoWidth(390, 844, 1.5, 2, 800)).toBe(800);
  expect(fullscreenPhotoWidth(1440, 900, 1.5, 1, 1280)).toBe(1280);
  expect(fullscreenPhotoWidth(1440, 900, 1.5, 2, 1280)).toBe(2560);
});
it('accounts for wide cover crops rather than choosing by element width alone', () => {
  expect(detailPhotoWidth(390, 2, 2)).toBe(1280);
  expect(detailPhotoWidth(1440, 1, 2)).toBe(1600);
});
