import { describe, expect, it } from 'vitest';
import { standDefaults } from './heroStandSettings';
import { responsiveStandFraming } from './responsiveStandFraming';
describe('responsive stand art direction', () => {
  it('does not override either approved 2K profile', () => {
    for (const index of [0, 1] as const) expect(responsiveStandFraming(standDefaults().profiles[index], index, 2560, 2600, 798)).toBeNull();
  });
  it('fills a narrow frame and positions the facade instead of the upper building', () => {
    for (const index of [0, 1] as const) {
      const frame = responsiveStandFraming(standDefaults().profiles[index], index, 390, 395, 640)!;
      expect(frame.left).toBeLessThan(0);
      expect(frame.left + frame.width).toBeGreaterThan(395);
      expect(frame.top).toBeLessThan(0);
      const sourceY = index === 0 ? .42 : .44;
      expect(frame.top + frame.width * .75 * sourceY).toBeCloseTo(640 * (index === 0 ? .18 : .16), 2);
    }
  });
  it('approaches the original framing continuously at the 2K boundary', () => {
    const profile = standDefaults().profiles[0];
    const frame = responsiveStandFraming(profile, 0, 2559.99, 2652, 798)!;
    const originalWidth = 2652 * .65;
    expect(Math.abs(frame.width - originalWidth)).toBeLessThan(.1);
    expect(Math.abs(frame.left - (2652 - originalWidth) / 2)).toBeLessThan(.1);
  });
});
