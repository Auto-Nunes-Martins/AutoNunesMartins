import { afterEach, expect, it, vi } from 'vitest';
import { captureCardPhoto, takeCardPhotoPreview } from './cardPhotoPreview';
const src = '/viaturas/test-abcdef123456/photos/0?v=' + 'a'.repeat(64);
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
function setup() {
  vi.stubGlobal('location', { href: 'https://site.test/viaturas', origin: 'https://site.test' });
  const drawImage = vi.fn();
  vi.stubGlobal('document', { createElement: () => ({ getContext: () => ({ drawImage }), toDataURL: () => 'data:image/webp;base64,pixels' }) });
  return { image: { complete: true, naturalWidth: 800, naturalHeight: 600, currentSrc: src + '&w=800' } as HTMLImageElement, drawImage };
}
it('uses decoded card pixels once only for the same fresh version and first photo', () => {
  const { image, drawImage } = setup();
  captureCardPhoto(image);
  expect(drawImage).toHaveBeenCalledOnce();
  expect(takeCardPhotoPreview(src + '&w=1600')).toContain('data:image/webp');
  expect(takeCardPhotoPreview(src)).toBeUndefined();
  captureCardPhoto(image);
  expect(takeCardPhotoPreview(src.replace('a'.repeat(64), 'b'.repeat(64)))).toBeUndefined();
  captureCardPhoto(image);
  expect(takeCardPhotoPreview(src.replace('/0?', '/1?'))).toBeUndefined();
});
it('rejects expired, cross-origin and undecoded pixels and clears on unrelated navigation', () => {
  vi.useFakeTimers();
  const { image, drawImage } = setup();
  captureCardPhoto(image); vi.advanceTimersByTime(15001);
  expect(takeCardPhotoPreview(src)).toBeUndefined();
  captureCardPhoto({ ...image, currentSrc: 'https://other.test' + src } as HTMLImageElement);
  expect(drawImage).toHaveBeenCalledTimes(1);
  captureCardPhoto({ ...image, complete: false } as HTMLImageElement);
  expect(takeCardPhotoPreview(src)).toBeUndefined();
  captureCardPhoto(image); captureCardPhoto();
  expect(takeCardPhotoPreview(src)).toBeUndefined();
});
