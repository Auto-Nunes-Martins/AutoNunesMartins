import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { visibleClock } from './visibleClock';

let report: IntersectionObserverCallback;
let visibility: () => void;
let hidden: boolean;
let disconnect: ReturnType<typeof vi.fn>;
let cleanup: (() => void)[];
const intersect = (node: Element, visible: boolean) =>
  report(
    [{ target: node, isIntersecting: visible } as IntersectionObserverEntry],
    {} as IntersectionObserver,
  );

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(0);
  hidden = false;
  cleanup = [];
  disconnect = vi.fn();
  vi.stubGlobal('document', {
    get hidden() {
      return hidden;
    },
    addEventListener: (_: string, callback: () => void) => {
      visibility = callback;
    },
    removeEventListener: vi.fn(),
  });
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      constructor(callback: IntersectionObserverCallback) {
        report = callback;
      }
      observe = vi.fn();
      unobserve = vi.fn();
      disconnect = disconnect;
    },
  );
});
afterEach(() => {
  cleanup.forEach((stop) => stop());
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it('uses one timer for multiple visible clocks and none for distant ones', () => {
  const first = {} as Element,
    second = {} as Element;
  const a = vi.fn(),
    b = vi.fn();
  cleanup.push(visibleClock(first, a), visibleClock(second, b));
  expect(vi.getTimerCount()).toBe(0);
  intersect(first, true);
  intersect(second, true);
  expect(vi.getTimerCount()).toBe(1);
  vi.advanceTimersByTime(3000);
  expect(a).toHaveBeenLastCalledWith(3000, false);
  expect(b).toHaveBeenLastCalledWith(3000, false);
  intersect(first, false);
  intersect(second, false);
  expect(vi.getTimerCount()).toBe(0);
  a.mockClear();
  b.mockClear();
  vi.advanceTimersByTime(600000);
  expect(a).not.toHaveBeenCalled();
  expect(b).not.toHaveBeenCalled();
});

it('restores real remaining time after offscreen expiry without replaying skipped flips', () => {
  const node = {} as Element;
  const remaining: number[] = [];
  const update = vi.fn((now: number) => remaining.push(Math.max(0, 5000 - now)));
  cleanup.push(visibleClock(node, update));
  intersect(node, true);
  vi.advanceTimersByTime(1000);
  intersect(node, false);
  vi.advanceTimersByTime(10000);
  intersect(node, true);
  expect(update).toHaveBeenLastCalledWith(11000, true);
  expect(remaining.at(-1)).toBe(0);
});

it('suspends a hidden tab and resynchronizes immediately when visible', () => {
  const node = {} as Element;
  const update = vi.fn();
  cleanup.push(visibleClock(node, update));
  intersect(node, true);
  hidden = true;
  visibility();
  expect(vi.getTimerCount()).toBe(0);
  update.mockClear();
  vi.advanceTimersByTime(123456);
  expect(update).not.toHaveBeenCalled();
  hidden = false;
  visibility();
  expect(update).toHaveBeenLastCalledWith(123456, true);
  expect(vi.getTimerCount()).toBe(1);
});

it('aligns minute-only cards to their actual deadline and releases all resources', () => {
  const node = {} as Element;
  const update = vi.fn();
  const stop = visibleClock(node, update, 60000, 30500);
  intersect(node, true);
  update.mockClear();
  vi.advanceTimersByTime(30499);
  expect(update).not.toHaveBeenCalled();
  vi.advanceTimersByTime(1);
  expect(update).toHaveBeenLastCalledWith(30500, false);
  stop();
  expect(vi.getTimerCount()).toBe(0);
  expect(disconnect).toHaveBeenCalledOnce();
  expect(document.removeEventListener).toHaveBeenCalledWith(
    'visibilitychange',
    expect.any(Function),
  );
});
