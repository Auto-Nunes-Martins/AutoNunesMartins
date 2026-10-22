import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ sign: vi.fn(), manifests: vi.fn() }));
vi.mock('../../env.js', () => ({ getEnv: () => ({ SUPABASE_URL: 'https://storage.test', SUPABASE_STORAGE_BUCKET: 'photos' }), getSupabaseServerKey: () => 'fixture' }));
vi.mock('@supabase/supabase-js', () => ({ createClient: () => ({ storage: { from: () => ({ createSignedUrls: mocks.sign }) } }) }));
vi.mock('../server/photoVariants.js', () => ({ readVariantManifests: mocks.manifests, variantPath: (path: string, width: number) => `${path}/${width}.webp` }));
import { signedPhotos, signedThumbnails, invalidateSignedReadUrl } from './storage.js';
beforeEach(() => {
  vi.clearAllMocks();
  for (const path of ['a.jpg', 'b.jpg', 'a.jpg/320.webp', 'a.jpg/800.webp']) invalidateSignedReadUrl(path);
  mocks.manifests.mockResolvedValue(new Map([['a.jpg', { width: 1200, height: 800, variants: [{ width: 320, height: 213 }, { width: 800, height: 533 }] }], ['b.jpg', null]]));
  mocks.sign.mockImplementation(async (paths: string[]) => ({ data: paths.map(path => ({ path, signedUrl: `signed:${path}` })), error: null }));
});
describe('batched private photo signatures', () => {
  it('signs covers and original fallbacks in one call, preserving legacy photos', async () => {
    const urls = await signedThumbnails(['a.jpg', 'b.jpg', 'a.jpg']);
    expect(mocks.sign).toHaveBeenCalledTimes(1);
    expect(mocks.sign.mock.calls[0][0]).toEqual(['a.jpg', 'b.jpg', 'a.jpg/320.webp']);
    expect(urls.thumbnails.get('a.jpg')).toBe('signed:a.jpg/320.webp');
    expect(urls.originals.get('a.jpg')).toBe('signed:a.jpg');
    expect(urls.thumbnails.get('b.jpg')).toBe('signed:b.jpg');
    await signedThumbnails(['a.jpg', 'b.jpg']);
    expect(mocks.sign).toHaveBeenCalledTimes(1);
  });
  it('signs all gallery originals and variants once and preserves photo order', async () => {
    const photos = await signedPhotos(['b.jpg', 'a.jpg']);
    expect(mocks.sign).toHaveBeenCalledTimes(1);
    expect(photos.map(photo => photo.path)).toEqual(['b.jpg', 'a.jpg']);
    expect(photos[0].variants).toEqual([]);
    expect(photos[1].variants.map(v => v.width)).toEqual([320, 800]);
  });
});
