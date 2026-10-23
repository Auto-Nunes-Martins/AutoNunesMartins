import { describe, expect, it } from 'vitest';
import { coverSourceWidth } from './coverImageSizes';

describe('cover image resolution', () => {
  it('accounts for tall crops instead of undersampling at the element width', () => {
    expect(coverSourceWidth(390, 1500, 0.75)).toBe(1125);
  });
  it('avoids using viewport height for a short editorial scene', () => {
    expect(coverSourceWidth(390, 529, 0.75)).toBe(397);
  });
  it('leaves device density to the browser and rounds up fractional cover widths', () => {
    expect(coverSourceWidth(390, 200, 1.5)).toBe(390);
    expect(coverSourceWidth(300, 401, 1.5)).toBe(602);
  });
});
