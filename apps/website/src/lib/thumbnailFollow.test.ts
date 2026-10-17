import { describe, expect, it } from 'vitest';
import { thumbnailScrollTarget as target } from './thumbnailFollow';
describe('measured thumbnail following', () => {
  it('stays still when selection and next context are visible', () => {
    expect(target(0, 800, { start: 6, end: 494 }, { start: 80, end: 170 }, { start: 178, end: 268 })).toBe(0);
  });
  it('moves just enough to reveal the next item with variable sizes/gaps', () => {
    expect(target(120, 800, { start: 6, end: 294 }, { start: 180, end: 260 }, { start: 273, end: 355 })).toBe(181);
  });
  it('provides symmetric previous context', () => {
    expect(target(200, 800, { start: 6, end: 294 }, { start: 40, end: 120 }, { start: -53, end: 29 })).toBe(141);
  });
  it('prioritizes the selected item when two cannot fit', () => {
    expect(target(0, 800, { start: 6, end: 100 }, { start: 80, end: 160 }, { start: 168, end: 248 })).toBe(60);
  });
  it('clamps at both physical ends', () => {
    expect(target(10, 80, { start: 6, end: 100 }, { start: -40, end: 20 })).toBe(0);
    expect(target(70, 80, { start: 6, end: 100 }, { start: 90, end: 160 })).toBe(80);
  });
});
