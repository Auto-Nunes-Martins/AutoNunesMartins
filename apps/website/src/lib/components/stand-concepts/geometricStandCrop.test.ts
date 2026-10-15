import { describe, expect, it } from 'vitest';
import { geometricStandCrop } from './geometricStandCrop';
describe('geometric stand cropping around the usable page centre', () => {
  it('leaves the first stand unchanged within a pixel', () => {
    expect(geometricStandCrop(231.6614685, 1198.3281555, 231.6614685, 1198.3281555, 715)).toEqual({ left: 0, right: 0, possible: true });
  });
  it('trims only the longer right side using full image width after viewport clipping', () => {
    const imageLeft = 189.9114685, imageRight = 1444.2969665, centre = 715;
    const crop = geometricStandCrop(imageLeft, imageRight, imageLeft, 1430, centre);
    const croppedRight = imageRight - crop.right / 100 * (imageRight - imageLeft);
    expect(crop.left).toBe(0);
    expect(crop.right).toBeCloseTo(16.28, 3);
    expect(Math.abs((centre - imageLeft) - (croppedRight - centre))).toBeLessThan(1);
  });
  it('trims only the longer left side without changing the shorter right edge', () => {
    const crop = geometricStandCrop(-30, 800, 0, 800, 500);
    expect(crop.right).toBe(0);
    expect(-30 + crop.left / 100 * 830).toBeCloseTo(200, 2);
  });
  it('leaves an already symmetric viewport clipping unchanged', () => {
    expect(geometricStandCrop(-200, 1200, 0, 1000, 500)).toEqual({ left: 0, right: 0, possible: true });
  });
  it('does not hide failure if the centre is outside the photo or a safe crop is impossible', () => {
    expect(geometricStandCrop(600, 900, 600, 900, 500).possible).toBe(false);
    expect(geometricStandCrop(490, 1000, 490, 1000, 500).possible).toBe(false);
  });
});
