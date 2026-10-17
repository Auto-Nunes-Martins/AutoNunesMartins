import { describe, expect, it } from 'vitest';
import { rememberSearchHit, safeSearchHit, searchShortcuts } from './searchNavigation';
describe('search context', () => {
  it('offers real internal navigation without inventing records', () => {
    expect(searchShortcuts.length).toBeGreaterThan(0);
    expect(searchShortcuts.every(safeSearchHit)).toBe(true);
  });
  it('rejects external, protocol-relative and backslash routes', () => {
    for (const href of ['https://outside.invalid', '//outside.invalid', '/viaturas\\other'])
      expect(safeSearchHit({ id: 'bad', primary: 'bad', secondary: null, href })).toBe(false);
  });
  it('deduplicates recent navigation and bounds the in-memory list', () => {
    let recent = [] as typeof searchShortcuts;
    for (let i = 0; i < 10; i++) recent = rememberSearchHit(recent, { id: String(i), primary: 'Fixture', secondary: null, href: `/viaturas/${i}` });
    expect(recent).toHaveLength(6);
    recent = rememberSearchHit(recent, recent[3]!);
    expect(new Set(recent.map(hit => hit.href)).size).toBe(6);
  });
});
