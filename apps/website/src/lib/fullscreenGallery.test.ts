import { afterEach, expect, it, vi } from 'vitest';
import { fullscreenGallery } from './fullscreenGallery';

let cleanup: (() => void) | undefined;
afterEach(() => {
  cleanup?.();
  cleanup = undefined;
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
class Surface extends EventTarget {
  control = false;
  closest() {
    return this.control ? this : null;
  }
}
function setup(nativeTouch = false, reduced = false) {
  vi.useFakeTimers();
  vi.stubGlobal('Element', Surface);
  const viewport = Object.assign(new EventTarget(), { scale: 1 });
  vi.stubGlobal('window', {
    visualViewport: viewport,
    ...(nativeTouch ? { TouchEvent: Event } : {}),
  });
  vi.stubGlobal('matchMedia', () => ({ matches: reduced }));
  const values = new Map<string, string>();
  const image = {
    naturalWidth: 1200,
    naturalHeight: 900,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 400, height: 700 }),
  };
  const dialog = Object.assign(new Surface(), {
    open: true,
    clientHeight: 800,
    style: {
      setProperty: (k: string, v: string) => values.set(k, v),
      removeProperty: (k: string) => values.delete(k),
    },
    toggleAttribute: vi.fn(),
    removeAttribute: vi.fn(),
    querySelector: vi.fn(() => image),
    close: vi.fn(),
  });
  const action = fullscreenGallery(dialog as unknown as HTMLDialogElement);
  cleanup = action.destroy;
  function send(type: string, x = 200, y = 350, extra = {}, control = false) {
    const event = Object.assign(new Event(type, { cancelable: true }), {
      clientX: x,
      clientY: y,
      pointerId: 1,
      pointerType: 'mouse',
      button: 0,
      ...extra,
    });
    if (control) {
      const target = new Surface();
      target.control = true;
      Object.defineProperty(event, 'target', { value: target });
    }
    dialog.dispatchEvent(event);
    return event;
  }
  const point = (x: number, y: number, id = 1) => ({ identifier: id, clientX: x, clientY: y });
  function touch(type: string, points: ReturnType<typeof point>[], changed = points) {
    return send(type, 0, 0, { touches: points, changedTouches: changed });
  }
  return { dialog, viewport, values, image, send, point, touch };
}
it('hit-tests the contained active image, keeping image taps and controls open', () => {
  const { dialog, send, image } = setup();
  send('pointerdown');
  send('pointerup');
  send('click');
  expect(dialog.close).not.toHaveBeenCalled();
  send('pointerdown', 200, 50, {}, true);
  send('pointerup', 200, 50, {}, true);
  send('click', 200, 50, {}, true);
  expect(dialog.close).not.toHaveBeenCalled();
  send('pointerdown', 200, 50);
  send('pointerup', 200, 50);
  send('click', 200, 50);
  expect(dialog.close).toHaveBeenCalledTimes(1);
  image.naturalWidth = 900;
  image.naturalHeight = 1200;
  send('pointerdown', 200, 350);
  send('pointerup', 200, 350);
  send('click', 200, 350);
  expect(dialog.close).toHaveBeenCalledTimes(1);
});
it('requires a tap to start and end outside the actual image', () => {
  const { dialog, send } = setup();
  send('pointerdown', 200, 50);
  send('pointerup', 200, 350);
  send('click', 200, 350);
  send('pointerdown', 200, 350);
  send('pointerup', 200, 50);
  send('click', 200, 50);
  expect(dialog.close).not.toHaveBeenCalled();
});
it('follows a downward drag, fades and completes after sufficient travel', () => {
  const { dialog, send, values } = setup();
  send('pointerdown');
  expect(send('pointermove', 202, 540).defaultPrevented).toBe(true);
  expect(values.get('--viewer-dismiss-y')).toBe('190px');
  expect(Number(values.get('--viewer-dismiss-opacity'))).toBeLessThan(1);
  send('pointerup', 202, 540);
  vi.advanceTimersByTime(180);
  expect(dialog.close).toHaveBeenCalledOnce();
});
it('snaps back short and cancelled drags and ignores diagonal/upward/horizontal gestures', () => {
  const { dialog, send, values } = setup();
  for (const [x, y] of [
    [202, 375],
    [320, 470],
    [200, 150],
    [330, 355],
  ]) {
    send('pointerdown');
    send('pointermove', x, y);
    send('pointerup', x, y);
    vi.advanceTimersByTime(200);
    expect(values.get('--viewer-dismiss-y')).toBe('0px');
    expect(dialog.close).not.toHaveBeenCalled();
  }
  send('pointerdown');
  send('pointermove', 200, 550);
  send('pointercancel');
  vi.advanceTimersByTime(200);
  expect(values.get('--viewer-dismiss-y')).toBe('0px');
  expect(dialog.close).not.toHaveBeenCalled();
});
it('allows downward dismissal starting in black surround and respects reduced motion', () => {
  const { dialog, send } = setup(false, true);
  send('pointerdown', 200, 50);
  send('pointermove', 200, 250);
  send('pointerup', 200, 250);
  expect(dialog.close).toHaveBeenCalledOnce();
});
it('preserves native touch when WebKit cancels pointer events or viewport height changes', () => {
  const { dialog, values, viewport, touch, point, send } = setup(true);
  touch('touchstart', [point(200, 350)]);
  touch('touchmove', [point(200, 520)]);
  send('pointercancel', 200, 520, { pointerType: 'touch' });
  viewport.dispatchEvent(new Event('resize'));
  expect(values.get('--viewer-dismiss-y')).toBe('170px');
  touch('touchend', [], [point(200, 520)]);
  vi.advanceTimersByTime(180);
  expect(dialog.close).toHaveBeenCalledOnce();
});
it('never dismisses during pinch, following a remaining pinch finger, or while zoomed', () => {
  const { dialog, values, viewport, touch, point } = setup(true);
  touch('touchstart', [point(200, 350)]);
  touch('touchstart', [point(200, 350), point(250, 350, 2)]);
  touch('touchmove', [point(200, 550)]);
  touch('touchend', [], [point(200, 550)]);
  vi.advanceTimersByTime(500);
  expect(dialog.close).not.toHaveBeenCalled();
  expect(values.get('--viewer-dismiss-y')).toBe('0px');
  viewport.scale = 2;
  viewport.dispatchEvent(new Event('resize'));
  touch('touchstart', [point(200, 350)]);
  touch('touchmove', [point(200, 550)]);
  touch('touchend', [], [point(200, 550)]);
  expect(dialog.close).not.toHaveBeenCalled();
});
it('suppresses the synthetic click after a cancelled drag', () => {
  const { dialog, send } = setup();
  send('pointerdown', 200, 50);
  send('pointermove', 200, 100);
  send('pointercancel');
  expect(send('click', 200, 100).defaultPrevented).toBe(true);
  expect(dialog.close).not.toHaveBeenCalled();
});

it('accepts a short deliberate flick but rejects the same distance after a pause', () => {
  let now = 0;
  vi.stubGlobal('performance', { now: () => now });
  const { dialog, send } = setup();
  send('pointerdown');
  now = 20;
  send('pointermove', 200, 425);
  send('pointerup', 200, 425);
  vi.advanceTimersByTime(180);
  expect(dialog.close).toHaveBeenCalledOnce();
  dialog.close.mockClear();
  now = 1000;
  send('pointerdown');
  now = 1020;
  send('pointermove', 200, 425);
  now = 1200;
  send('pointerup', 200, 425);
  vi.advanceTimersByTime(180);
  expect(dialog.close).not.toHaveBeenCalled();
});
