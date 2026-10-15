import { getContext } from 'svelte';
import { get, writable } from 'svelte/store';

export const THEME_KEY = 'anm-orbit-theme';
export const publicThemeContext = Symbol('public-theme');
type ThemeStorage = Pick<Storage, 'getItem' | 'setItem'>;

// One instance per root layout: survives client navigation, isolated for each SSR render.
export function createPublicTheme(initialDark = true, apply?: (dark: boolean) => void) {
  const dark = writable(initialDark);
  let initialized = false;
  let storage: ThemeStorage | undefined;
  return {
    dark: { subscribe: dark.subscribe },
    initialize(getStorage: () => ThemeStorage) {
      if (initialized) return;
      initialized = true;
      try {
        storage = getStorage();
        const stored = storage.getItem(THEME_KEY);
        if (stored === 'dark' || stored === 'light') dark.set(stored === 'dark');
      } catch {
        /* The in-memory choice remains usable when storage is blocked. */
      }
      apply?.(get(dark));
    },
    toggle() {
      const next = !get(dark);
      dark.set(next);
      apply?.(next);
      try {
        storage?.setItem(THEME_KEY, next ? 'dark' : 'light');
      } catch {
        /* Keep the in-memory choice. */
      }
    },
  };
}
export const usePublicTheme = () =>
  getContext<ReturnType<typeof createPublicTheme>>(publicThemeContext);
