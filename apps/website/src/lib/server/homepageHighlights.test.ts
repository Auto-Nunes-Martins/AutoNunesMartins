import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('$env/static/public', () => ({ PUBLIC_BACKEND_URL: 'http://backend.test' }));
import { loadHomepageHighlights } from './homepageHighlights';
import { highlightSlides } from '../homepageHighlights';
const slug = 'bmw-serie-3-123456abcdef';
const vehicle = {
  slug,
  brand: 'BMW',
  model: 'Série 3',
  year: 2022,
  fuel: 'DIESEL',
  mileage: 30000,
  price: '20000.00',
  currency: 'EUR',
  description: 'Approved',
  transmission: null,
  availability: 'AVAILABLE',
  photos: [`/api/public/vehicles/${slug}/photos/0`, `/api/public/vehicles/${slug}/photos/1`],
};
afterEach(() => vi.unstubAllGlobals());
describe('homepage highlights BFF', () => {
  it('uses the chosen photo and the real public detail route', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          Response.json({ configured: true, items: [{ vehicle, photoIndex: 1 }] }),
        ),
    );
    const slides = highlightSlides(await loadHomepageHighlights());
    expect(slides[0]).toMatchObject({
      href: `/viaturas/${slug}`,
      image: `/viaturas/${slug}/photos/1`,
      illustrative: false,
    });
  });
  it.each([
    { items: [] },
    { items: [{ vehicle, photoIndex: 20 }] },
    { items: [{ vehicle, photoIndex: 2 }] },
  ])('does not invent demo slides for empty or invalid results', async ({ items }) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ configured: true, items })));
    expect(highlightSlides(await loadHomepageHighlights())).toEqual([]);
  });
  it('does not restore demos on a backend outage', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    expect(await loadHomepageHighlights()).toEqual({ configured: true, items: [] });
  });
});
