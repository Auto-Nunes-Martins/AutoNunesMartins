import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';

const startup = readFileSync(new URL('../../static/orbit-startup.js', import.meta.url), 'utf8');
const appHtml = readFileSync(new URL('../app.html', import.meta.url), 'utf8');
const themeBoot = appHtml.match(/<script id="orbit-theme-boot">([\s\S]*?)<\/script>/)![1]!;
describe('theme before the first painted frame', () => {
  it.each(['light', 'dark'])('applies a legacy %s preference before hydration', (theme) => {
    const attributes = new Map([['data-theme', 'dark']]);
    let darkClass = true;
    let metadata = '';
    const context = {
      location: { pathname: '/favoritos' },
      window: {},
      localStorage: { getItem: () => theme },
      document: {
        cookie: '',
        documentElement: {
          setAttribute: (name: string, value: string) => attributes.set(name, value),
          getAttribute: (name: string) => attributes.get(name),
          hasAttribute: (name: string) => attributes.has(name),
        },
        querySelector: () => ({
          setAttribute: (_name: string, value: string) => (metadata = value),
        }),
        querySelectorAll: () => [
          {
            classList: { toggle: (_name: string, value: boolean) => (darkClass = value) },
            querySelectorAll: () => [],
          },
        ],
      },
    };
    runInNewContext(themeBoot, context);
    runInNewContext(startup, context);
    expect(attributes.get('data-theme')).toBe(theme);
    // This parser-blocking callback runs after SSR markup, before framework hydration.
    (context.window as { initializeOrbitDocument: () => void }).initializeOrbitDocument();
    expect(darkClass).toBe(theme === 'dark');
    expect(metadata).toBe(theme === 'dark' ? '#0a0a0b' : '#f5f5f1');
  });
  it('keeps the default when localStorage is blocked, without reading cookies', () => {
    let theme = '';
    runInNewContext(themeBoot, {
      location: { pathname: '/favoritos' },
      window: {},
      localStorage: {
        getItem() {
          throw new Error('blocked');
        },
      },
      document: {
        get cookie() {
          throw new Error('Theme must not read cookies');
        },
        documentElement: { setAttribute: (_name: string, value: string) => (theme = value) },
        querySelector: () => ({ setAttribute() {} }),
      },
    });
    expect(theme).toBe('dark');
  });
});
