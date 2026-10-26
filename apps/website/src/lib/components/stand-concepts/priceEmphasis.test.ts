import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { priceEmphasis } from './priceEmphasis';

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function setup(reduce = false) {
  const reduced = Object.assign(new EventTarget(), { matches: reduce });
  const pointer = Object.assign(new EventTarget(), { matches: true });
  const hover = Object.assign(new EventTarget(), { matches: () => false });
  const feature = Object.assign(new EventTarget(), {
    dataset: { carouselEntered: 'true' },
    querySelectorAll: () => [hover],
    querySelector: () => null,
    getBoundingClientRect: () => ({ top: 0, bottom: 500 }),
  });
  const slot = {};
  const animate = vi.fn((_frames: Keyframe[], _options: KeyframeAnimationOptions) => ({
    id: '',
    finished: new Promise<void>(() => {}),
    cancel: vi.fn(),
  }));
  const node = { closest: () => feature, parentElement: slot, style: { fontSize: '' }, animate };
  vi.stubGlobal('document', Object.assign(new EventTarget(), { hidden: false }));
  vi.stubGlobal('innerHeight', 900);
  vi.stubGlobal('matchMedia', (query: string) =>
    query.includes('reduced-motion') ? reduced : pointer,
  );
  vi.stubGlobal('getComputedStyle', (element: unknown) => ({
    fontSize: element === slot ? '40px' : node.style.fontSize || '40px',
  }));
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      constructor(private callback: (entries: unknown[]) => void) {}
      observe() {
        this.callback([{ isIntersecting: true, intersectionRatio: 1 }]);
      }
      disconnect() {}
    },
  );
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
    },
  );
  vi.stubGlobal(
    'MutationObserver',
    class {
      observe() {}
      disconnect() {}
    },
  );
  const action = priceEmphasis(node as unknown as HTMLElement, 'first-car')!;
  return { action, animate, hover, node };
}

describe('featured price emphasis', () => {
  it('does not pulse on entry, elapsed time or updates for the same vehicle', () => {
    const { action, animate } = setup();
    vi.advanceTimersByTime(60_000);
    action.update('first-car');
    expect(animate).not.toHaveBeenCalled();
    action.destroy();
  });

  it('pulses once for each actual displayed vehicle change, without scheduling repeats', () => {
    const { action, animate } = setup();
    action.update('second-car');
    expect(animate).toHaveBeenCalledTimes(1);
    expect(animate.mock.results[0]!.value.id).toBe('price-vehicle-change');
    expect(animate.mock.calls[0]![1]).toEqual({ duration: 650 });
    action.update('second-car');
    vi.advanceTimersByTime(60_000);
    expect(animate).toHaveBeenCalledTimes(1);
    action.update('third-car');
    expect(animate).toHaveBeenCalledTimes(2);
    action.destroy();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('preserves hover emphasis and also pulses when the vehicle changes during hover', () => {
    const { action, animate, hover, node } = setup();
    hover.dispatchEvent(Object.assign(new Event('pointerenter'), { pointerType: 'mouse' }));
    expect(animate.mock.results.at(-1)!.value.id).toBe('price-interaction');
    expect(parseFloat(node.style.fontSize)).toBeCloseTo(41.8);
    action.update('second-car');
    expect(animate.mock.results.at(-1)!.value.id).toBe('price-vehicle-change');
    vi.advanceTimersByTime(60_000);
    expect(animate).toHaveBeenCalledTimes(2);
    hover.dispatchEvent(new Event('pointerleave'));
    expect(animate.mock.results.at(-1)!.value.id).toBe('price-interaction');
    expect(node.style.fontSize).toBe('40px');
    action.destroy();
  });

  it('respects reduced motion for vehicle changes and hover', () => {
    const { action, animate, hover } = setup(true);
    action.update('second-car');
    hover.dispatchEvent(Object.assign(new Event('pointerenter'), { pointerType: 'mouse' }));
    vi.advanceTimersByTime(60_000);
    expect(animate).not.toHaveBeenCalled();
    action.destroy();
  });
});
