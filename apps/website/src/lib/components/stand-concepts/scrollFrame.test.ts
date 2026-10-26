import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { scrollFrame, setScrollStyle } from './scrollFrame';
import { designMotion } from './designMotion';
import { catalogNavigation } from './catalogNavigation';
import { catalogSticky } from './catalogSticky';

let frames: Map<number, FrameRequestCallback>;
let sequence: number;
let cleanup: (() => void)[];
const advance = () => {
  const batch = [...frames.values()];
  frames.clear();
  batch.forEach((callback) => callback(16));
};

beforeEach(() => {
  frames = new Map();
  sequence = 0;
  cleanup = [];
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    frames.set(++sequence, callback);
    return sequence;
  });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id));
});
afterEach(() => {
  cleanup.forEach((cancel) => cancel());
  vi.unstubAllGlobals();
});

describe('coordinated scroll frames', () => {
  it('coalesces requests and completes all reads before writes, regardless of action order', () => {
    const calls: string[] = [];
    const first = scrollFrame(() => {
      calls.push('read motion');
      return () => calls.push('write motion');
    });
    const second = scrollFrame(() => {
      calls.push('read nav');
      return () => calls.push('write nav');
    });
    cleanup.push(first.cancel, second.cancel);
    second.schedule();
    first.schedule();
    second.schedule();
    expect(frames.size).toBe(1);
    advance();
    expect(calls).toEqual(['read nav', 'read motion', 'write nav', 'write motion']);
    expect(frames.size).toBe(0);
  });

  it('defers settling work to the next frame and allows cancelling it', () => {
    const read = vi.fn(() => () => task.schedule());
    const task = scrollFrame(read);
    cleanup.push(task.cancel);
    task.schedule();
    advance();
    expect(read).toHaveBeenCalledTimes(1);
    expect(frames.size).toBe(1);
    task.cancel();
    advance();
    expect(read).toHaveBeenCalledTimes(1);
  });

  it('does not write to an action cancelled after its read (page teardown)', () => {
    const write = vi.fn();
    const first = scrollFrame(() => write);
    const second = scrollFrame(() => {
      first.cancel();
    });
    cleanup.push(first.cancel, second.cancel);
    first.schedule();
    second.schedule();
    advance();
    expect(write).not.toHaveBeenCalled();
  });

  it('does not cancel a different action sharing the same frame', () => {
    const read = vi.fn();
    const first = scrollFrame(() => {});
    const second = scrollFrame(read);
    cleanup.push(first.cancel, second.cancel);
    first.schedule();
    second.schedule();
    first.cancel();
    advance();
    expect(read).toHaveBeenCalledOnce();
  });

  it('skips unchanged inline CSS values', () => {
    const style = { getPropertyValue: () => '0', setProperty: vi.fn() };
    const node = { style } as unknown as HTMLElement;
    setScrollStyle(node, '--reading', '0');
    expect(style.setProperty).not.toHaveBeenCalled();
    setScrollStyle(node, '--reading', '0.5');
    expect(style.setProperty).toHaveBeenCalledWith('--reading', '0.5');
  });
});

describe('scroll action read/write integration', () => {
  function fixture(width = 1200) {
    const calls: string[] = [];
    const read = (name: string, value: number) => {
      calls.push(`read ${name}`);
      return value;
    };
    const style = () => {
      const values = new Map<string, string>();
      return {
        getPropertyValue: (key: string) => values.get(key) ?? '',
        setProperty: (key: string, value: string) => {
          calls.push(`write ${key}`);
          values.set(key, value);
        },
        removeProperty: (key: string) => {
          values.delete(key);
        },
      };
    };
    const classes = new Set<string>();
    const classList = {
      contains: (name: string) => classes.has(name),
      toggle: (name: string, on: boolean) => {
        calls.push('write class');
        if (on) classes.add(name);
        else classes.delete(name);
      },
      add: (name: string) => classes.add(name),
      remove: (...names: string[]) => names.forEach((name) => classes.delete(name)),
    };
    const node = {
      style: style(),
      dataset: {},
      hasAttribute: () => false,
      querySelector: () => null,
      getBoundingClientRect: () => {
        calls.push('read scene');
        return { top: 0, bottom: 600, height: 600 };
      },
    };
    const readingIndicator = { style: style() };
    const root = {
      style: style(),
      classList,
      querySelectorAll: () => [node],
      contains: () => true,
      querySelector: (selector: string) =>
        selector === ':scope > .read-line'
          ? readingIndicator
          : {
              get offsetHeight() {
                return read('strip', 40);
              },
            },
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
    const win = {
      scrollY: 100,
      innerWidth: width,
      innerHeight: 800,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
    const doc = {
      hidden: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      documentElement: {
        get scrollHeight() {
          return read('page height', 2000);
        },
        getAttribute: () => null,
        removeAttribute: vi.fn(),
        style: style(),
      },
    };
    const header = {
      parentElement: root,
      classList,
      querySelector: () => null,
      get offsetHeight() {
        return read('header', 80);
      },
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
    vi.stubGlobal('window', win);
    vi.stubGlobal('document', doc);
    vi.stubGlobal('innerHeight', 800);
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query.includes('max-width') ? width <= 1000 : false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
    const observer = class {
      observe() {}
      disconnect() {}
    };
    vi.stubGlobal('ResizeObserver', observer);
    vi.stubGlobal('MutationObserver', observer);
    return {
      calls,
      readingIndicator,
      root: root as unknown as HTMLElement,
      header: header as unknown as HTMLElement,
      win,
      doc,
    };
  }

  it('reads the page height before motion/nav writes and retains the reading indicator', () => {
    const { calls, root, header, win, readingIndicator } = fixture();
    const motion = designMotion(root);
    const nav = catalogNavigation(header, { enabled: true, open: false, directional: true });
    cleanup.push(motion.destroy, nav.destroy);
    advance();
    advance(); // initialization/restoration
    calls.length = 0;
    win.addEventListener.mock.calls.find(([event]) => event === 'scroll')![1]();
    nav.update({ enabled: true, open: false, directional: true });
    advance();
    const firstWrite = calls.findIndex((call) => call.startsWith('write'));
    expect(firstWrite).toBeGreaterThan(0);
    expect(calls.slice(firstWrite).some((call) => call.startsWith('read'))).toBe(false);
    expect(readingIndicator.style.getPropertyValue('--reading')).toBe(String(100 / 1200));
    expect(root.style.getPropertyValue('--reading')).toBe('');
    calls.length = 0;
    win.addEventListener.mock.calls.find(([event]) => event === 'scroll')![1]();
    advance();
    expect(calls.filter((call) => call.startsWith('write --'))).toEqual([]);
  });

  it.each(['orbit-home', 'public-detail'])(
    'does not attach unused pointer parallax on %s',
    (page) => {
      const { calls, root } = fixture();
      root.classList.add(page);
      vi.stubGlobal('matchMedia', (query: string) => ({
        matches: query.includes('hover: hover'),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }));
      const motion = designMotion(root);
      cleanup.push(motion.destroy);
      advance();
      advance();
      calls.length = 0;
      const listeners = vi.mocked(root.addEventListener).mock.calls;
      expect(listeners.some(([event]) => event === 'pointermove' || event === 'pointerleave')).toBe(
        false,
      );
      advance();
      expect(calls).toEqual([]);
    },
  );

  it('preserves pointer parallax in an explicitly enabled scene', () => {
    const { calls, root } = fixture();
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query.includes('hover: hover'),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
    const motion = designMotion(root, { pointerParallax: true });
    cleanup.push(motion.destroy);
    advance();
    advance();
    calls.length = 0;
    const move = vi
      .mocked(root.addEventListener)
      .mock.calls.find(([event]) => event === 'pointermove')![1] as (event: unknown) => void;
    move({ clientX: 500, clientY: 300 });
    advance();
    expect(calls).toContain('read scene');
    expect(Number(root.style.getPropertyValue('--mx'))).toBeLessThan(0);
    expect(Number(root.style.getPropertyValue('--my'))).toBeLessThan(0);
  });

  it('does not measure catalogue geometry or queue scroll work below the desktop breakpoint', () => {
    const { win } = fixture(390);
    const measure = vi.fn(() => {
      throw Error('mobile should not measure');
    });
    const style = { removeProperty: vi.fn() };
    const sidebar = { style, getBoundingClientRect: measure };
    const grid = { getBoundingClientRect: measure };
    const node = {
      closest: (selector: string) =>
        selector === '.catalog-layout'
          ? { querySelector: () => ({ querySelector: () => grid }) }
          : selector === '.catalog-filters'
            ? sidebar
            : null,
      style,
      classList: { remove: vi.fn() },
      getBoundingClientRect: measure,
    } as unknown as HTMLElement;
    const action = catalogSticky(node);
    cleanup.push(action.destroy);
    advance();
    const scroll = win.addEventListener.mock.calls.find(([event]) => event === 'scroll')![1];
    scroll();
    expect(frames.size).toBe(0);
    expect(measure).not.toHaveBeenCalled();
  });

  it('keeps the mobile navigation visible for an open menu and cancels pending work on teardown', () => {
    const { header, root, win } = fixture(390);
    const action = catalogNavigation(header, { enabled: true, open: false, directional: true });
    cleanup.push(action.destroy);
    const scroll = win.addEventListener.mock.calls.find(([event]) => event === 'scroll')![1];
    win.scrollY = 200;
    scroll();
    advance();
    expect(header.classList.contains('catalog-nav-hidden')).toBe(true);
    action.update({ enabled: true, open: true, directional: true });
    advance();
    expect(header.classList.contains('catalog-nav-hidden')).toBe(false);
    action.update({ enabled: true, open: false, directional: true });
    advance();
    win.scrollY = 300;
    scroll();
    advance();
    expect(header.classList.contains('catalog-nav-hidden')).toBe(true);
    win.scrollY = 250;
    scroll();
    advance();
    expect(header.classList.contains('catalog-nav-hidden')).toBe(false);
    scroll();
    action.destroy();
    advance();
    expect(root.classList.contains('nav-compact')).toBe(false);
  });

  it('skips compact-navigation geometry when that navigation mode is inactive', () => {
    const { calls, header } = fixture();
    const action = catalogNavigation(header, { enabled: false, open: false, directional: false });
    cleanup.push(action.destroy);
    expect(calls.some((call) => call.startsWith('read'))).toBe(false);
  });
});
