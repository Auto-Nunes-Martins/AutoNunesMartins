import { describe, expect, it } from 'vitest';
import { get } from 'svelte/store';
import { createPublicTheme, THEME_KEY } from './publicTheme';

describe('public theme across page lifetimes', () => {
  it('starts with the SSR choice instead of resetting to dark', () => {
    expect(get(createPublicTheme(false).dark)).toBe(false);
    expect(get(createPublicTheme(true).dark)).toBe(true);
  });
  it('applies the restored palette immediately and on explicit changes', () => {
    const applied: boolean[] = [];
    const theme = createPublicTheme(false, (dark) => applied.push(dark));
    theme.initialize(() => ({ getItem: () => 'light', setItem() {} }));
    theme.toggle();
    expect(applied).toEqual([false, true]);
  });
  it('restores once and keeps the current choice when another page initializes', () => {
    const values = new Map([[THEME_KEY, 'light']]);
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => {
        values.set(key, value);
      },
    };
    const theme = createPublicTheme();
    theme.initialize(() => storage);
    expect(get(theme.dark)).toBe(false);
    theme.toggle();
    expect(values.get(THEME_KEY)).toBe('dark');
    theme.initialize(() => ({ ...storage, getItem: () => 'light' }));
    expect(get(theme.dark)).toBe(true);
    theme.toggle();
    expect(get(theme.dark)).toBe(false);
  });

  it('isolates root-layout instances and tolerates unavailable persistence', () => {
    const first = createPublicTheme();
    const second = createPublicTheme();
    first.initialize(() => {
      throw new Error('Storage blocked');
    });
    first.toggle();
    expect(get(first.dark)).toBe(false);
    expect(get(second.dark)).toBe(true);
  });
});
