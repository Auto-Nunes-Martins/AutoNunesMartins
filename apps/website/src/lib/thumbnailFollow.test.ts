import { describe, expect, it } from 'vitest';
import { thumbnailScrollTarget as target } from './thumbnailFollow';

describe('anticipatory thumbnail following', () => {
  it('reveals two upcoming thumbnails before the active photo reaches the edge', () => {
    const scroll = target(0, 1200, {start:0,end:360}, {start:280,end:360}, 1);
    expect(scroll).toBe(194);
    expect(536 - scroll).toBeLessThanOrEqual(360); // Two following 80px photos with 8px gaps.
    expect(280 - scroll).toBeGreaterThan(0);
  });
  it('provides the same early context when travelling backwards', () => {
    const scroll = target(400, 1200, {start:0,end:360}, {start:0,end:80}, -1);
    expect(scroll).toBe(206);
    expect(-176 + 400 - scroll).toBeGreaterThanOrEqual(0);
  });
  it('centres an initial selection when no direction is known', () => {
    expect(target(300, 800, {start:6,end:294}, {start:180,end:260})).toBe(370);
    expect(target(300, 800, {start:6,end:294}, {start:110,end:190})).toBe(300);
  });
  it('uses measured sizes and padding rather than assuming uniform thumbnail widths', () => {
    expect(target(30, 800, {start:10,end:510}, {start:410,end:535}, 1)).toBe(317.5);
  });
  it('clamps at either physical end, including jumps between last and first', () => {
    expect(target(700, 800, {start:0,end:360}, {start:-700,end:-620}, -1)).toBe(0);
    expect(target(0, 800, {start:0,end:360}, {start:1080,end:1160}, 1)).toBe(800);
  });
  it('never introduces scroll or empty space into a short gallery', () => {
    expect(target(0, 0, {start:0,end:600}, {start:80,end:160}, 1)).toBe(0);
    expect(target(0, -20, {start:0,end:600}, {start:80,end:160}, -1)).toBe(0);
  });
});
