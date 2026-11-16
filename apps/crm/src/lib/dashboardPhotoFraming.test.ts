import { describe, expect, it } from 'vitest';
import { dashboardPhotoGeometry } from './dashboardPhotoFraming';

describe('dashboard detail photo framing', () => {
  it('fits the visible desktop crop into a narrower panel with space for the backdrop', () => {
    const result = dashboardPhotoGeometry(
      { width: 1600, height: 800 },
      { width: 450, height: 400 },
      false,
      {
        desktop: { x: 25, y: 75, zoom: 1.25, fit: 'cover' },
        mobile: { x: 50, y: 50 },
      },
    );
    expect(result).toMatchObject({
      width: 750,
      height: 375,
      left: -75,
      top: 18.75,
      clipPath: 'inset(56.25px 225px 18.75px 75px)',
      backdrop: true,
    });
  });

  it('keeps the automatic portrait fit, saved zoom and focal point', () => {
    const result = dashboardPhotoGeometry(
      { width: 800, height: 1200 },
      { width: 650, height: 400 },
      false,
      {
        desktop: { x: 25, y: 75, zoom: 1.2, fit: 'auto' },
        mobile: { x: 50, y: 50 },
      },
    )!;
    expect(result.width).toBeCloseTo(320);
    expect(result.height).toBeCloseTo(480);
    expect(result.left).toBeCloseTo(82.5);
    expect(result.top).toBeCloseTo(-60);
    expect(result.backdrop).toBe(true);
  });

  it('uses the mobile crop and fills a panel with a matching aspect ratio', () => {
    const result = dashboardPhotoGeometry(
      { width: 800, height: 1600 },
      { width: 520, height: 400 },
      true,
      {
        desktop: { x: 50, y: 50, fit: 'auto' },
        mobile: { x: 50, y: 25, fit: 'cover' },
      },
    );
    expect(result).toMatchObject({
      width: 520,
      height: 1040,
      left: 0,
      top: -160,
      clipPath: 'inset(160px 0px 480px 0px)',
      backdrop: false,
    });
  });

  it('uses the default detail crop for older photos and waits for valid sizes', () => {
    const image = { width: 1200, height: 800 };
    const frame = { width: 600, height: 400 };
    expect(dashboardPhotoGeometry(image, frame, false)).toMatchObject({
      width: 600,
      height: 400,
      backdrop: false,
    });
    expect(dashboardPhotoGeometry({ ...image, width: 0 }, frame, false)).toBeUndefined();
    expect(dashboardPhotoGeometry(image, { ...frame, width: NaN }, false)).toBeUndefined();
  });
});
