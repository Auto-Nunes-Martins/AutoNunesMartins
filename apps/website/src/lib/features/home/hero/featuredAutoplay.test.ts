import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { featuredAutoplay } from './featuredAutoplay';

let observe: IntersectionObserverCallback;
let documentEvents: EventTarget & { hidden: boolean };
let node: HTMLElement;
let action: ReturnType<typeof featuredAutoplay> | undefined;

beforeEach(() => {
  vi.useFakeTimers();
  documentEvents = Object.assign(new EventTarget(), { hidden: false });
  vi.stubGlobal('document', documentEvents);
  vi.stubGlobal('innerHeight', 1000);
  vi.stubGlobal('matchMedia', () => Object.assign(new EventTarget(), { matches: false }));
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      constructor(callback: IntersectionObserverCallback) {
        observe = callback;
      }
      observe() {}
      disconnect() {}
    },
  );
  node = Object.assign(new EventTarget(), {
    dataset: {},
    matches: () => false,
    querySelector: (selector: string) =>
      selector === '.hd-photo img' ? { complete: true, naturalWidth: 1600 } : null,
    getBoundingClientRect: () => ({ top: 100, bottom: 500 }),
    getAnimations: () => [],
    closest: () => null,
  }) as unknown as HTMLElement;
});

afterEach(() => {
  action?.destroy();
  action = undefined;
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

async function enter() {
  observe(
    [{ isIntersecting: true, intersectionRatio: 1 } as IntersectionObserverEntry],
    {} as IntersectionObserver,
  );
  await vi.advanceTimersByTimeAsync(0);
}

it('waits for each requested image, advances one entry every four seconds, and wraps in order', async () => {
  let displayed = 0;
  let requested = 0;
  let revision = 0;
  const seen: number[] = [];
  const options = (ready: boolean) => ({ count: 4, ready, revision, next });
  function next() {
    requested = (displayed + 1) % 4;
    revision += 1;
    seen.push(requested);
    action!.update(options(false));
  }
  action = featuredAutoplay(node, options(true));
  await enter();
  for (let step = 0; step < 8; step += 1) {
    await vi.advanceTimersByTimeAsync(3999);
    expect(seen).toHaveLength(step);
    await vi.advanceTimersByTimeAsync(1);
    expect(seen).toHaveLength(step + 1);
    // The old image remains loaded, but the requested image is slow/failing.
    await vi.advanceTimersByTimeAsync(12000);
    expect(seen).toHaveLength(step + 1);
    expect(vi.getTimerCount()).toBe(0);
    displayed = requested;
    action.update(options(true));
  }
  expect(seen).toEqual([1, 2, 3, 0, 1, 2, 3, 0]);
});

it('keeps only one timer through load and visibility events and cancels it on teardown', async () => {
  const next = vi.fn();
  const options = { count: 3, ready: true, revision: 0, next };
  action = featuredAutoplay(node, options);
  await enter();
  for (let index = 0; index < 5; index += 1) {
    node.dispatchEvent(new Event('load'));
    action.update(options);
  }
  await vi.advanceTimersByTimeAsync(0);
  expect(vi.getTimerCount()).toBe(1);
  documentEvents.hidden = true;
  documentEvents.dispatchEvent(new Event('visibilitychange'));
  await vi.advanceTimersByTimeAsync(12000);
  expect(next).not.toHaveBeenCalled();
  documentEvents.hidden = false;
  documentEvents.dispatchEvent(new Event('visibilitychange'));
  await vi.advanceTimersByTimeAsync(3999);
  expect(next).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(1);
  expect(next).toHaveBeenCalledTimes(1);
  action.update(options);
  action.destroy();
  action = undefined;
  await vi.advanceTimersByTimeAsync(12000);
  expect(next).toHaveBeenCalledTimes(1);
  expect(vi.getTimerCount()).toBe(0);
});
