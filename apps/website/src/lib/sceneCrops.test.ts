import { describe, expect, it } from 'vitest';
import crops from './sceneCrops.json';

describe('scene crop framing', () => {
  it('keeps the catalogue picture coordinates and displayed blur unchanged', () => {
    const c = crops.catalog;
    expect(c.width / c.sourceWidth).toBe(c.fraction);
    expect(c.height / c.sourceHeight).toBe(c.fraction);
    expect(c.left + c.width / 2).toBe(c.sourceWidth / 2);
    expect(c.top + c.height / 2).toBe(c.sourceHeight / 2);
    for (const [width, height] of [[350,305],[351,504],[321,464],[700,500]] as const) {
      const oldScale = Math.max(width / c.sourceWidth, height / c.sourceHeight) * c.originalZoom;
      const nextScale = Math.max(width / c.width, height / c.height) * c.originalZoom * c.fraction;
      expect(nextScale).toBeCloseTo(oldScale, 12);
      expect(c.originalBlur / c.fraction * c.originalZoom * c.fraction).toBeCloseTo(c.originalBlur * c.originalZoom, 12);
      // A margin remains outside the visible frame after the crop, including blur bleed.
      expect(c.width * nextScale - width).toBeGreaterThan(12);
      expect(c.height * nextScale - height).toBeGreaterThan(12);
    }
  });

  it('keeps the cabin framing for mobile, desktop and all three panel faces', () => {
    const c = crops.cabin;
    expect(c.top).toBe((c.sourceHeight - c.height) * c.positionY);
    for (const viewport of [320,360,390,430,700,701,768,1024,1280,1663,1920,2560]) {
      const width = Math.min((viewport - 10) * (viewport <= 700 ? .9 : .95), 1640);
      const height = viewport <= 700 ? Math.max(270, Math.min(390, viewport * .68)) : Math.max(350, Math.min(505, viewport * .35));
      for (const panelWidth of [width, width - 6]) {
        const oldScale = Math.max(panelWidth / c.sourceWidth, height / c.sourceHeight);
        const nextScale = Math.max(panelWidth / c.width, height / c.height);
        expect(nextScale).toBe(oldScale);
        for (const y of [c.top, c.sourceHeight / 2, c.top + c.height]) {
          const before = (height - c.sourceHeight * oldScale) * c.positionY + y * oldScale;
          const after = (height - c.height * nextScale) * c.positionY + (y - c.top) * nextScale;
          expect(after).toBeCloseTo(before, 10);
        }
        const cropTop = (height - c.height * nextScale) * c.positionY;
        expect(cropTop).toBeLessThan(-6);
        expect(cropTop + c.height * nextScale).toBeGreaterThan(height + 6);
      }
    }
  });
});
