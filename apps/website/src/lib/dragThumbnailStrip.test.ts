import { afterEach, expect, it, vi } from 'vitest';
import { dragThumbnailStrip } from './dragThumbnailStrip';

let cleanup: (() => void) | undefined;
afterEach(() => {
  cleanup?.();
  cleanup = undefined;
  vi.unstubAllGlobals();
});

function setup(fine = true) {
  vi.stubGlobal('window', new EventTarget());
  vi.stubGlobal('matchMedia', (query: string) =>
    Object.assign(new EventTarget(), {
      matches: query.includes('pointer: fine') ? fine : false,
    }),
  );
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
  const strip = Object.assign(new EventTarget(), {
    scrollLeft: 50,
    scrollWidth: 500,
    clientWidth: 200,
    classList: { remove: vi.fn(), add: vi.fn() },
  });
  cleanup = dragThumbnailStrip(strip as unknown as HTMLElement).destroy;
  function wheel(x: number, y: number, mode = 0) {
    const event = Object.assign(new Event('wheel', { cancelable: true }), {
      deltaX: x,
      deltaY: y,
      deltaMode: mode,
    });
    strip.dispatchEvent(event);
    return event.defaultPrevented;
  }
  return { strip, wheel };
}

it('leaves vertical and predominantly vertical diagonal wheel gestures untouched', () => {
  const { strip, wheel } = setup();
  expect(wheel(0, 240)).toBe(false);
  expect(wheel(5, 240)).toBe(false);
  expect(wheel(-10, -240)).toBe(false);
  expect(strip.scrollLeft).toBe(50);
});

it('handles only horizontal movement that can move the strip and releases the extremes', () => {
  const { strip, wheel } = setup();
  expect(wheel(230, 5)).toBe(true);
  expect(strip.scrollLeft).toBe(280);
  expect(wheel(50, 0)).toBe(true);
  expect(strip.scrollLeft).toBe(300);
  expect(wheel(50, 0)).toBe(false);
  strip.scrollLeft = 0;
  expect(wheel(-50, 0)).toBe(false);
});

it('preserves native touch/coarse-pointer scrolling', () => {
  const { strip, wheel } = setup(false);
  expect(wheel(180, 0)).toBe(false);
  expect(wheel(0, 180)).toBe(false);
  expect(strip.scrollLeft).toBe(50);
});

it('normalizes line deltas and removes the wheel handler on teardown', () => {
  const { strip, wheel } = setup();
  expect(wheel(3, 0, 1)).toBe(true);
  expect(strip.scrollLeft).toBe(98);
  cleanup!();
  cleanup = undefined;
  expect(wheel(100, 0)).toBe(false);
  expect(strip.scrollLeft).toBe(98);
});
