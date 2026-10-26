import { afterEach, expect, it, vi } from 'vitest';
import { brandMarquee } from './brandMarquee';

let cleanup: (() => void) | undefined;
afterEach(() => {
  cleanup?.();
  cleanup = undefined;
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
function setup() {
  vi.useFakeTimers();
  const mobile = Object.assign(new EventTarget(), { matches: true });
  const reduced = Object.assign(new EventTarget(), { matches: false });
  vi.stubGlobal('matchMedia', (query: string) => (query.includes('reduced') ? reduced : mobile));
  const document = Object.assign(new EventTarget(), {
    hidden: false,
    activeElement: null as unknown,
  });
  const window = new EventTarget();
  vi.stubGlobal('document', document);
  vi.stubGlobal('window', window);
  let intersection: (entries: { isIntersecting: boolean }[]) => void = () => {};
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      constructor(callback: typeof intersection) {
        intersection = callback;
      }
      observe() {}
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
  let nextFrame = 0;
  const frames = new Map<number, (time: number) => void>();
  vi.stubGlobal('requestAnimationFrame', (callback: (time: number) => void) => {
    const id = ++nextFrame;
    frames.set(id, callback);
    return id;
  });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id));
  const primary = { getBoundingClientRect: () => ({ width: 600 }) };
  const node = Object.assign(new EventTarget(), {
    querySelector: () => primary,
    clientWidth: 200,
    scrollLeft: 0,
    dataset: {} as Record<string, string>,
    contains: (element: unknown) => element === node,
  });
  const action = brandMarquee(node as unknown as HTMLElement)!;
  cleanup = action.destroy;
  const frame = (time: number) => {
    const callbacks = [...frames.values()];
    frames.clear();
    callbacks.forEach((callback) => callback(time));
  };
  return {
    action,
    node,
    document,
    window,
    mobile,
    reduced,
    frames,
    frame,
    visible: (value: boolean) => intersection([{ isIntersecting: value }]),
  };
}

it('moves slowly only while visible and loops without a growing scroll position', () => {
  const { node, frames, frame, visible } = setup();
  expect(frames.size).toBe(0);
  expect(node.dataset.brandLoop).toBe('true');
  node.scrollLeft = 590;
  visible(true);
  for (let i = 0; i <= 20; i++) frame(1000 + i * 64);
  expect(node.scrollLeft).toBeGreaterThan(10);
  expect(node.scrollLeft).toBeLessThan(30);
  visible(false);
  expect(frames.size).toBe(0);
});

it('pauses for touch and wheel interaction, then resumes after a quiet interval', () => {
  const { node, window, frames, visible } = setup();
  visible(true);
  node.dispatchEvent(new Event('pointerdown'));
  expect(frames.size).toBe(0);
  window.dispatchEvent(new Event('pointerup'));
  vi.advanceTimersByTime(3199);
  expect(frames.size).toBe(0);
  vi.advanceTimersByTime(1);
  expect(frames.size).toBe(1);
  node.dispatchEvent(new Event('wheel'));
  expect(frames.size).toBe(0);
});

it('stops for hover, keyboard focus, hidden documents, desktop and reduced motion', async () => {
  const { node, document, mobile, reduced, frames, visible } = setup();
  visible(true);
  node.dispatchEvent(Object.assign(new Event('pointerenter'), { pointerType: 'mouse' }));
  expect(frames.size).toBe(0);
  node.dispatchEvent(new Event('pointerleave'));
  expect(frames.size).toBe(1);
  document.activeElement = node;
  node.dispatchEvent(new Event('focusin'));
  expect(frames.size).toBe(0);
  document.activeElement = null;
  node.dispatchEvent(new Event('focusout'));
  await Promise.resolve();
  expect(frames.size).toBe(1);
  document.hidden = true;
  document.dispatchEvent(new Event('visibilitychange'));
  expect(frames.size).toBe(0);
  document.hidden = false;
  reduced.matches = true;
  reduced.dispatchEvent(new Event('change'));
  expect(node.dataset.brandLoop).toBe('false');
  expect(frames.size).toBe(0);
  reduced.matches = false;
  mobile.matches = false;
  mobile.dispatchEvent(new Event('change'));
  expect(node.dataset.brandLoop).toBe('false');
  expect(frames.size).toBe(0);
});

it('removes listeners and pending animation/timers on destruction', () => {
  const { node, frames, visible, reduced } = setup();
  visible(true);
  expect(frames.size).toBe(1);
  cleanup!();
  cleanup = undefined;
  expect(frames.size).toBe(0);
  expect(node.dataset.brandLoop).toBeUndefined();
  node.dispatchEvent(new Event('wheel'));
  reduced.dispatchEvent(new Event('change'));
  vi.advanceTimersByTime(5000);
  expect(frames.size).toBe(0);
});

it('keeps the explicit pause until the user resumes', () => {
  const { action, visible, frames } = setup();
  visible(true);
  action.update({ paused: true });
  vi.advanceTimersByTime(10000);
  expect(frames.size).toBe(0);
  action.update({ paused: false });
  expect(frames.size).toBe(1);
});
