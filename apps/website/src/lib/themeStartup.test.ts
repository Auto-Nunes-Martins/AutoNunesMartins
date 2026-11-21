import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';

const startup = readFileSync(new URL('../../assets/site-startup.js', import.meta.url), 'utf8');
const appHtml = readFileSync(new URL('../app.html', import.meta.url), 'utf8');
const themeBoot = appHtml.match(/<script id="site-theme-boot">([\s\S]*?)<\/script>/)![1]!;

describe('featured alignment before hydration', () => {
  const alignment = startup.slice(
    startup.indexOf('function alignSiteFeaturedContent'),
    startup.indexOf('// A streamed'),
  );
  it.each([390, 1440])('preserves the resting pose at %s px without cumulative drift', (width) => {
    const values = new Map<string, string>();
    const attributes = new Map([['data-featured-presence', 'expanded']]);
    const feature = {};
    const hint = { getBoundingClientRect: () => ({ top: 245, height: 10 }) };
    const line = {
      getBoundingClientRect: () => ({
        top: 203 + (parseFloat(values.get('--featured-content-drop') || '16') - 16) * 0.8,
        height: 4,
      }),
    };
    const hero = {
      getAttribute: (key: string) => attributes.get(key),
      setAttribute: (key: string, value: string) => attributes.set(key, value),
      querySelector: (selector: string) =>
        selector === '.hd-feature' ? feature : selector === '.hd-scroll' ? hint : line,
      style: { setProperty: (key: string, value: string) => values.set(key, value) },
    };
    const context = {
      innerWidth: width,
      hero,
      getComputedStyle: (element: object) =>
        element === feature
          ? {
              scale: '0.8',
              translate: '0px 5px',
              getPropertyValue: (key: string) => values.get(key) || '',
            }
          : { transform: 'matrix(1,0,0,1,0,10)' },
      DOMMatrixReadOnly: class {
        m42 = 10;
      },
    };
    const run = () => runInNewContext(`${alignment}\nalignSiteFeaturedContent(hero);`, context);
    run();
    expect(values.get('--featured-content-drop')).toBe(width > 700 ? '66px' : undefined);
    expect(attributes.get('data-featured-content-drop')).toBe(width > 700 ? '66px' : undefined);
    run();
    expect(values.get('--featured-content-drop')).toBe(width > 700 ? '66px' : undefined);
  });
});
describe('theme before the first painted frame', () => {
  it('migrates a previously saved light theme before the first paint', () => {
    const values = new Map([['anm-orbit-theme', 'light']]);
    const attributes = new Map<string, string>();
    runInNewContext(themeBoot, {
      localStorage: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
        removeItem: (key: string) => values.delete(key),
      },
      document: {
        documentElement: { setAttribute: (key: string, value: string) => attributes.set(key, value) },
        querySelector: () => ({ setAttribute() {} }),
      },
    });
    expect(attributes.get('data-theme')).toBe('light');
    expect([...values]).toEqual([['anm-theme', 'light']]);
  });
  it.each(['light', 'dark'])('applies a legacy %s preference before hydration', (theme) => {
    const attributes = new Map([['data-theme', 'dark']]);
    let darkClass = true;
    let metadata = '';
    let logoSource = '';
    let logoSet = '';
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
        querySelectorAll: (selector: string) =>
          selector === '.design.site'
            ? [
                {
                  classList: { toggle: (_name: string, value: boolean) => (darkClass = value) },
                  querySelectorAll: (selector: string) =>
                    selector === '[data-theme-logo]'
                      ? [
                          {
                            getAttribute: (name: string) => {
                              const tone = name.includes('dark') ? 'dark' : 'light';
                              return name.endsWith('srcset')
                                ? `/_app/immutable/assets/${tone}.hash.webp 360w`
                                : `/_app/immutable/assets/${tone}.hash.webp`;
                            },
                            setAttribute: (name: string, value: string) => {
                              if (name === 'src') logoSource = value;
                              else if (name === 'srcset') logoSet = value;
                            },
                          },
                        ]
                      : [],
                },
              ]
            : [],
      },
    };
    runInNewContext(themeBoot, context);
    runInNewContext(startup, context);
    expect(attributes.get('data-theme')).toBe(theme);
    // This parser-blocking callback runs after SSR markup, before framework hydration.
    (context.window as { initializeSiteDocument: () => void }).initializeSiteDocument();
    expect(darkClass).toBe(theme === 'dark');
    expect(logoSource).toBe(
      `/_app/immutable/assets/${theme === 'dark' ? 'dark' : 'light'}.hash.webp`,
    );
    expect(logoSet).toBe(`${logoSource} 360w`);
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
