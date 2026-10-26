import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { watchHomeStats } from './whatsappVisibility';
import { notificationPosition } from './notificationPosition';
import { perspectiveMotion } from './components/stand-concepts/perspectiveMotion';

let frames: Map<number, FrameRequestCallback>;
let sequence: number;
let cleanup: (() => void)[];
let calls: string[];
let listeners: Map<string, Set<() => void>>;
let intersections: {
  callback: IntersectionObserverCallback;
  observe: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
}[];
const advance = () => {
  const next = [...frames.values()];
  frames.clear();
  next.forEach((callback) => callback(16));
};
const scroll = () => listeners.get('scroll')?.forEach((callback) => callback());
function element(name: string, bounds: Partial<DOMRect> = {}) {
  const properties = new Map<string, string>();
  return {
    getBoundingClientRect: vi.fn(() => {
      calls.push(`read ${name}`);
      return { top: 100, left: 10, bottom: 400, right: 110, width: 100, height: 2, ...bounds };
    }),
    style: {
      getPropertyValue: (key: string) => properties.get(key) ?? '',
      setProperty: (key: string, value: string) => {
        calls.push(`write ${name}`);
        properties.set(key, value);
      },
    },
  };
}
beforeEach(() => {
  frames = new Map();
  sequence = 0;
  cleanup = [];
  calls = [];
  listeners = new Map();
  intersections = [];
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    frames.set(++sequence, callback);
    return sequence;
  });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id));
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe = vi.fn();
      disconnect = vi.fn();
    },
  );
  vi.stubGlobal(
    'MutationObserver',
    class {
      observe = vi.fn();
      disconnect = vi.fn();
    },
  );
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      observe = vi.fn();
      disconnect = vi.fn();
      constructor(public callback: IntersectionObserverCallback) {
        intersections.push(this);
      }
    },
  );
  vi.stubGlobal('matchMedia', () => ({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
  vi.stubGlobal('innerHeight', 800);
  vi.stubGlobal('window', {
    innerWidth: 1000,
    innerHeight: 800,
    addEventListener: (name: string, callback: () => void) => {
      if (!listeners.has(name)) listeners.set(name, new Set());
      listeners.get(name)!.add(callback);
    },
    removeEventListener: (name: string, callback: () => void) =>
      listeners.get(name)?.delete(callback),
  });
  vi.stubGlobal('document', { body: {}, querySelector: vi.fn(() => null) });
});
afterEach(() => {
  cleanup.forEach((cancel) => cancel());
  vi.unstubAllGlobals();
});

it('uses observer-provided stats bounds at exactly the same crossing, including navigation back', () => {
  const stats = element('stats');
  let home = true;
  vi.mocked(document.querySelector).mockReturnValue(stats as unknown as Element);
  const update = vi.fn();
  const visibility = watchHomeStats(() => home, update);
  cleanup.push(visibility.destroy);
  const observer = intersections[0]!;
  const report = (bottom: number) =>
    observer.callback(
      [{ target: stats, boundingClientRect: { bottom } } as unknown as IntersectionObserverEntry],
      {} as IntersectionObserver,
    );
  report(1);
  expect(update).toHaveBeenLastCalledWith(false);
  report(0);
  expect(update).toHaveBeenLastCalledWith(true);
  report(20);
  expect(update).toHaveBeenLastCalledWith(false);
  expect(stats.getBoundingClientRect).not.toHaveBeenCalled();
  visibility.refresh();
  expect(observer.observe).toHaveBeenCalledTimes(2);
  report(-1);
  expect(update).toHaveBeenLastCalledWith(true);
  listeners.get('resize')?.forEach((callback) => callback());
  expect(observer.observe).toHaveBeenCalledTimes(3);
  report(800);
  expect(update).toHaveBeenLastCalledWith(false);
  home = false;
  visibility.refresh();
  expect(update).toHaveBeenLastCalledWith(false);
  expect(observer.disconnect).toHaveBeenCalled();
  expect(frames.size).toBe(0);
});

it('does no header geometry work while notifications and outgoing cards are absent', () => {
  let active = false;
  const header = element('header', { bottom: 88 });
  vi.mocked(document.querySelector).mockReturnValue(header as unknown as Element);
  const update = vi.fn();
  const positioning = notificationPosition(() => active, update);
  cleanup.push(positioning.destroy);
  positioning.schedule();
  positioning.schedule();
  advance();
  expect(header.getBoundingClientRect).not.toHaveBeenCalled();
  active = true;
  positioning.schedule();
  advance();
  expect(update).toHaveBeenLastCalledWith(100, 4);
  positioning.schedule();
  advance();
  expect(update).toHaveBeenCalledTimes(1);
  positioning.schedule();
  active = false;
  advance();
  expect(header.getBoundingClientRect).toHaveBeenCalledTimes(2);
});

function perspective() {
  const headingBounds = { top: 100 };
  const heading = element('heading', headingBounds),
    line = element('line'),
    underline = element('underline');
  const fragments = [element('first text'), element('second text'), underline];
  const section = {
    ...element('section'),
    querySelector: (selector: string) =>
      selector === 'h2' ? heading : selector === 'em' ? underline : line,
    querySelectorAll: () => fragments,
  };
  return { section: section as unknown as HTMLElement, heading, headingBounds };
}

it('coordinates text and notification measurements before either writes its visual state', () => {
  const view = perspective();
  cleanup.push(perspectiveMotion(view.section));
  intersections[0]!.callback(
    [{ isIntersecting: true } as IntersectionObserverEntry],
    {} as IntersectionObserver,
  );
  const header = element('header', { bottom: 60 });
  vi.mocked(document.querySelector).mockReturnValue(header as unknown as Element);
  const positioning = notificationPosition(
    () => true,
    () => calls.push('write notifications'),
  );
  cleanup.push(positioning.destroy);
  calls.length = 0;
  view.heading.getBoundingClientRect.mockImplementation(() => {
    calls.push('read heading');
    return { top: 200 } as DOMRect;
  });
  scroll();
  positioning.schedule();
  advance();
  const firstWrite = calls.findIndex((value) => value.startsWith('write'));
  const lastRead = calls.findLastIndex((value) => value.startsWith('read'));
  expect(firstWrite).toBeGreaterThan(lastRead);
  expect(calls).toContain('write notifications');
});

it('does not rewrite the same text pose and cancels pending geometry on teardown', () => {
  const view = perspective();
  const destroy = perspectiveMotion(view.section);
  cleanup.push(destroy);
  intersections[0]!.callback(
    [{ isIntersecting: true } as IntersectionObserverEntry],
    {} as IntersectionObserver,
  );
  advance();
  calls.length = 0;
  scroll();
  advance();
  expect(calls.some((value) => value.startsWith('write'))).toBe(false);
  scroll();
  destroy();
  calls.length = 0;
  advance();
  expect(calls).toEqual([]);
  expect(listeners.get('scroll')?.size).toBe(0);
});

it('skips distant editorial text, prepares it nearby and cancels work when it leaves', () => {
  const view = perspective();
  cleanup.push(perspectiveMotion(view.section));
  scroll();
  advance();
  expect(view.heading.getBoundingClientRect).not.toHaveBeenCalled();
  const observer = intersections[0]!;
  observer.callback(
    [{ isIntersecting: true } as IntersectionObserverEntry],
    {} as IntersectionObserver,
  );
  advance();
  expect(view.heading.getBoundingClientRect).toHaveBeenCalledOnce();
  const pose = view.section.style.getPropertyValue('--line-progress');
  scroll();
  observer.callback(
    [{ isIntersecting: false } as IntersectionObserverEntry],
    {} as IntersectionObserver,
  );
  advance();
  expect(view.heading.getBoundingClientRect).toHaveBeenCalledOnce();
  observer.callback(
    [{ isIntersecting: true } as IntersectionObserverEntry],
    {} as IntersectionObserver,
  );
  advance();
  expect(view.section.style.getPropertyValue('--line-progress')).toBe(pose);
});
