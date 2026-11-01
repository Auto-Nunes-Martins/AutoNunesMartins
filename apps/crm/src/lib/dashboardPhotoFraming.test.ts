import { describe, it, expect } from 'vitest';
import { dashboardPhotoGeometry } from './dashboardPhotoFraming';

describe('dashboard-only framing adaptation', () => {
  const framing = { desktop: { x: 20, y: 80 }, mobile: { x: 75, y: 65 } };
  it('uses natural dimensions and each device crop without modifying the selection', () => {
    const before = JSON.stringify(framing);
    const desktop = dashboardPhotoGeometry(
      { width: 800, height: 1067 },
      { width: 683, height: 588 },
      false,
      framing,
    )!;
    const mobile = dashboardPhotoGeometry(
      { width: 800, height: 1067 },
      { width: 346, height: 280 },
      true,
      framing,
    )!;
    expect(desktop.width / 683).toBeCloseTo(0.9);
    expect(mobile.width / 346).toBeCloseTo(0.9);
    expect(desktop.scale).toBeLessThan(Math.max(683 / 800, 588 / 1067));
    expect(desktop.top).not.toBe(mobile.top);
    expect(JSON.stringify(framing)).toBe(before);
  });
  it('keeps the selected public crop centre in the safe area when bounds allow it', () => {
    const image = { width: 800, height: 1067 },
      frame = { width: 683, height: 588 };
    const result = dashboardPhotoGeometry(image, frame, false, framing)!;
    const focalY = (image.height - image.width / 1.65) * 0.8 + image.width / 1.65 / 2;
    const safeTop = frame.height * 0.08,
      safeBottom = 88;
    expect(result.top + focalY * result.scale).toBeCloseTo(
      safeTop + (frame.height - safeTop - safeBottom) / 2,
    );
  });
  it('handles landscape, square and extreme positions, resize and missing framing', () => {
    for (const image of [
      { width: 2400, height: 1000 },
      { width: 1000, height: 1000 },
      { width: 800, height: 1067 },
    ])
      for (const mobile of [false, true])
        for (const value of [undefined, { desktop: { x: 0, y: 0 }, mobile: { x: 100, y: 100 } }]) {
          const result = dashboardPhotoGeometry(image, { width: 600, height: 400 }, mobile, value)!;
          expect(Object.values(result).every(Number.isFinite)).toBe(true);
          expect(result.width / result.height).toBeCloseTo(image.width / image.height);
          expect(result.scale).toBeGreaterThan(0);
          expect(result.scale).toBeLessThan(Math.max(600 / image.width, 400 / image.height));
        }
    expect(
      dashboardPhotoGeometry({ width: 0, height: 1000 }, { width: 600, height: 400 }, false),
    ).toBeUndefined();
    expect(
      dashboardPhotoGeometry({ width: 800, height: 1000 }, { width: NaN, height: 400 }, false),
    ).toBeUndefined();
  });
  it('responds smoothly to nearby vertical choices and similar future photo ratios', () => {
    for (const width of [720, 750, 800])
      for (const mobile of [false, true]) {
        const image = { width, height: 1000 },
          frame = { width: mobile ? 346 : 683, height: mobile ? 280 : 542 };
        const choices = [-3, 0, 3].map(
          (delta) =>
            dashboardPhotoGeometry(image, frame, mobile, {
              desktop: { x: 50, y: 74 + delta },
              mobile: { x: 50, y: 70 + delta },
            })!,
        );
        expect(choices[0]!.top).toBeGreaterThanOrEqual(choices[1]!.top);
        expect(choices[1]!.top).toBeGreaterThanOrEqual(choices[2]!.top);
        expect(choices[0]!.top - choices[2]!.top).toBeLessThan(frame.height * 0.08);
        expect(choices[0]!.scale).toBe(choices[2]!.scale);
      }
  });
  it('fills matching 16:9 and 4:3 panels without adding artificial margins', () => {
    for(const image of [{width:1600,height:900},{width:1200,height:900}]) {
      for(const width of [360,800]) {
        const frame={width,height:width*image.height/image.width};
        const result=dashboardPhotoGeometry(image,frame,width===360,framing)!;
        expect(result.width).toBeCloseTo(frame.width);
        expect(result.height).toBeCloseTo(frame.height);
        expect(result.left).toBeCloseTo(0);
        expect(result.top).toBeCloseTo(0);
      }
    }
    // A 4:3 photo can fill the actual mobile panel with a small, bounded crop.
    const close=dashboardPhotoGeometry({width:1200,height:900},{width:346,height:280},true,framing)!;
    expect(close.width).toBeGreaterThanOrEqual(346);expect(close.height).toBeGreaterThanOrEqual(280);
    // A 16:9 photo in that taller panel needs a compromise, not a large blind crop.
    const different=dashboardPhotoGeometry({width:1600,height:900},{width:346,height:280},true,framing)!;
    expect(different.width).toBeLessThan(1600*(280/900));
  });
});
