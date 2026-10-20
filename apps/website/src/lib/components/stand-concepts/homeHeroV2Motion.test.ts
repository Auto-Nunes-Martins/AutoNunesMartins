import { describe, expect, it } from 'vitest';
import { v2HeroProgress, v2AccentFrame } from './homeHeroV2Motion';

describe('preserved V2 choreography', () => {
  it('keeps the reviewed resting pose and advances during natural scroll', () => {
    expect(v2HeroProgress(110, 110, 740, 1000)).toBe(0.5);
    expect(v2HeroProgress(-110, 110, 740, 1000)).toBeCloseTo(0.698198198);
    expect(v2HeroProgress(-1000, 110, 740, 1000)).toBe(1);
  });
  it('starts a tall mobile composition at rest and bounds its progress', () => {
    expect(v2HeroProgress(106, 106, 800, 844)).toBe(0);
    expect(v2HeroProgress(-1000, 106, 800, 844)).toBe(1);
  });
  it('keeps the wide accent in document coordinates while the dash travels', () => {
    const initial = v2AccentFrame(110, 780, 110, 740, 1000, 0);
    const scrolled = v2AccentFrame(-110, 780, -110, 740, 1000, 220);
    expect(initial).toEqual({ shift: 20, progress: 0.5 });
    expect(scrolled).toEqual(initial);
  });
  it('preserves the separate mobile/tablet frame without a scroll coordinate', () => {
    expect(v2AccentFrame(106, 820, 126, 800, 844)).toEqual({ shift: -20, progress: 0 });
    expect(v2AccentFrame(-114, 820, -94, 800, 844)).toEqual({ shift: 0, progress: 1 });
  });
});
