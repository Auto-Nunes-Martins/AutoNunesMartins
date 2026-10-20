import { describe, expect, it } from 'vitest';
import { descriptionLinks } from './descriptionLinks';

describe('plain public description links', () => {
  it('makes source and licence URLs usable without raw HTML', () => {
    const text =
      'Fonte: https://commons.wikimedia.org/wiki/File:Car_(2021).jpg\nLicença: https://creativecommons.org/licenses/by-sa/4.0.';
    const parts = descriptionLinks(text);
    expect(parts.map((p) => p.text).join('')).toBe(text);
    expect(parts.filter((p) => p.href).map((p) => p.href)).toEqual([
      'https://commons.wikimedia.org/wiki/File:Car_(2021).jpg',
      'https://creativecommons.org/licenses/by-sa/4.0',
    ]);
  });
  it('keeps markup and unsafe schemes as escaped plain text', () => {
    const text = '<script>alert(1)</script> javascript:alert(1)';
    expect(descriptionLinks(text)).toEqual([{ text }]);
  });
});
