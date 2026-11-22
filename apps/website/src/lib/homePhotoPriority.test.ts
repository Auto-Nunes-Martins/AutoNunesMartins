import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';
import { homePhotoPlaceholder } from './homePhotoPriority';

const startup = readFileSync(new URL('../../assets/site-startup.js', import.meta.url), 'utf8');
function setup({ top = 1600, scroll = 0, complete = false, mobile = true, observer = true } = {}) {
  const listeners = new Map<string, () => void>();
  let intersection: (entries: { isIntersecting: boolean }[]) => void = () => {};
  let disconnected = false;
  const hero = {
    complete,
    addEventListener: (e: string, cb: () => void) => listeners.set(e, cb),
    removeEventListener: (e: string) => listeners.delete(e),
  };
  const source = {
    dataset: {} as Record<string, string>,
    media: '(max-width: 700px) and (scripting: enabled)',
    parentElement: { parentElement: { getBoundingClientRect: () => ({ top }) } },
  };
  const scope = { querySelectorAll: () => [source] };
  const win = {} as { initializeHomePhotoPriority: (root: typeof scope) => void };
  const context = {
    window: win,
    location: { pathname: '/test' },
    scrollY: scroll,
    innerHeight: 823,
    innerWidth: 412,
    addEventListener: (e: string, cb: () => void) => listeners.set(e, cb),
    removeEventListener: (e: string) => listeners.delete(e),
    document: { querySelector: () => hero, documentElement: { setAttribute() {} } },
    matchMedia: () => ({ matches: mobile }),
    ...(observer
      ? {
          IntersectionObserver: class {
            constructor(cb: typeof intersection) {
              intersection = cb;
            }
            observe() {}
            disconnect() {
              disconnected = true;
            }
          },
        }
      : {}),
  };
  runInNewContext(startup, context);
  win.initializeHomePhotoPriority(scope);
  return {
    source,
    listeners,
    context,
    intersect: () => intersection([{ isIntersecting: true }]),
    disconnected: () => disconnected,
  };
}

describe('mobile homepage photo request priority', () => {
  it('keeps distant photos deferred across first scroll, hero load and restoration', () => {
    for (const options of [{}, { scroll: 800 }, { complete: true }]) {
      const test = setup(options);
      for (const event of ['scroll', 'resize', 'load']) test.listeners.get(event)?.();
      expect(test.source.media).not.toBe('not all');
      test.intersect();
      expect(test.source.media).toBe('not all');
      expect(test.disconnected()).toBe(true);
    }
  });
  it('releases photos when approaching the viewport', () => {
    const test = setup();
    test.intersect();
    expect(test.source.media).toBe('not all');
  });
  it.each([{ mobile: false }, { observer: false }])('fails open for %j', (options) => {
    expect(setup(options).source.media).toBe('not all');
  });
  it('retains the source aspect ratio without accepting invalid dimensions', () => {
    expect(decodeURIComponent(homePhotoPlaceholder({ width: 4032, height: 3024 })!)).toContain(
      'width="4" height="3"',
    );
    expect(homePhotoPlaceholder({ width: NaN, height: 100 })).toBeUndefined();
    expect(homePhotoPlaceholder(null)).toBeUndefined();
  });
});
