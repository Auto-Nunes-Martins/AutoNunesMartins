import { describe, expect, it } from 'vitest';
import { standDefaults } from './heroStandSettings';
import {
  desktopStandAnchor,
  desktopStandRatioZoom,
  responsiveStandFraming,
  standDesktopReference,
} from './responsiveStandFraming';
describe('responsive stand art direction', () => {
  it('preserves the saved 2K geometry, including custom x/y, zoom and dimensions', () => {
    for (const index of [0, 1] as const)
      for (const profile of [
        standDefaults().profiles[index],
        { ...standDefaults().profiles[index], width: 110, height: 115, zoom: 75, x: 35, y: 40 },
      ]) {
        const anchor = desktopStandAnchor(profile, index),
          w = (standDesktopReference.width * profile.width) / 100,
          h = (standDesktopReference.height * profile.height) / 100,
          image = (Math.max(w, (h * 4) / 3) * profile.zoom) / 100;
        expect((w * anchor.x) / 100 - (image * anchor.focalX) / 100).toBeCloseTo(
          ((w - image) * profile.x!) / 100,
          6
        );
      }
  });
  it('honours custom dimensions and zoom when scaling the reference canvas', () => {
    const profile = {
      ...standDefaults().profiles[0],
      width: 80,
      height: 125,
      zoom: 70,
      x: 37,
      y: 61,
    };
    // At the reference viewport, a 2048px-wide layer at 70% is 1433.6px.
    // Its 125%-high canvas is 997px tall. Neither dimension is a default profile.
    const ratio = desktopStandRatioZoom(profile);
    expect((ratio / 100) * 997).toBeCloseTo(1433.6, 6);
    expect(desktopStandRatioZoom({ ...profile, zoom: 105 })).toBeCloseTo(ratio * 1.5, 6);
  });
  it('leaves approved and custom desktop profiles to CSS at every desktop width', () => {
    for (const viewport of [1001, 1280, 1434, 1600, 1920, 2559, 2560, 3440]) {
      for (const index of [0, 1] as const) {
        const profile = { ...standDefaults().profiles[index], zoom: 73, x: 37, y: 61 };
        expect(responsiveStandFraming(profile, index, viewport, viewport * 1.04, 798)).toBeNull();
      }
    }
  });
  it('fills a narrow frame and positions the facade instead of the upper building', () => {
    for (const index of [0, 1] as const) {
      const frame = responsiveStandFraming(standDefaults().profiles[index], index, 390, 395, 640)!;
      expect(frame.left).toBeLessThan(0);
      expect(frame.left + frame.width).toBeGreaterThan(395);
      expect(frame.top).toBeLessThan(0);
      const sourceY = index === 0 ? 0.42 : 0.44;
      expect(frame.top + frame.width * 0.75 * sourceY).toBeCloseTo(
        640 * (index === 0 ? 0.18 : 0.16),
        2
      );
    }
  });
  it('preserves the existing tablet framing at the mobile navigation boundary', () => {
    const frame = responsiveStandFraming(standDefaults().profiles[0], 0, 1000, 1040, 740)!;
    expect(frame.width).toBeCloseTo(1381.333, 3);
    expect(frame.left).toBeCloseTo(-94.773, 3);
    expect(frame.top).toBeCloseTo(-301.92, 3);
  });
});
