import { afterEach, expect, it, vi } from 'vitest';
import { photoSwipe } from './photoSwipe';

let cleanup: (() => void) | undefined;
afterEach(() => {
  cleanup?.();
  cleanup = undefined;
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

class Surface extends EventTarget {
  control = false;
  allowed = false;
  closest() {
    return this.control ? this : null;
  }
  hasAttribute() {
    return this.allowed;
  }
}
function setup() {
  vi.stubGlobal('Element', Surface);
  const viewport = Object.assign(new EventTarget(), { scale: 1 });
  vi.stubGlobal('window', { visualViewport: viewport });
  const node = Object.assign(new Surface(), {
    clientWidth: 400,
    style: { touchAction: 'manipulation' },
    setPointerCapture: vi.fn(),
    hasPointerCapture: () => true,
    releasePointerCapture: vi.fn(),
  });
  const next = vi.fn(),
    previous = vi.fn();
  const action = photoSwipe(node as unknown as HTMLElement, { enabled: true, next, previous });
  cleanup = action.destroy;
  function pointer(type: string, x: number, y: number, extra = {}, target: Surface = node) {
    const event = Object.assign(new Event(type, { cancelable: true }), {
      clientX: x,
      clientY: y,
      pointerId: 1,
      pointerType: 'touch',
      button: 0,
      ...extra,
    });
    if (target !== node) Object.defineProperty(event, 'target', { value: target });
    node.dispatchEvent(event);
    return event;
  }
  function click(detail = 1, target: Surface = node) {
    const event = Object.assign(new Event('click', { cancelable: true }), { detail });
    if (target !== node) Object.defineProperty(event, 'target', { value: target });
    node.dispatchEvent(event);
    return event.defaultPrevented;
  }
  function swipe(from: number, to: number) {
    pointer('pointerdown', from, 100);
    pointer('pointermove', to, 105);
    pointer('pointerup', to, 105);
  }
  return { node, viewport, next, previous, action, pointer, click, swipe };
}

it('changes one photo per deliberate swipe and suppresses only the following pointer click', () => {
  const { swipe, next, previous, click } = setup();
  swipe(260, 100);
  expect(next).toHaveBeenCalledTimes(1);
  expect(previous).not.toHaveBeenCalled();
  expect(click()).toBe(true);
  expect(click(0)).toBe(false);
  swipe(100, 260);
  expect(previous).toHaveBeenCalledTimes(1);
});

it('leaves taps and slight finger movement available to open the viewer', () => {
  const { pointer, click, next } = setup();
  pointer('pointerdown', 100, 100);
  expect(pointer('pointermove', 105, 104).defaultPrevented).toBe(false);
  pointer('pointerup', 105, 104);
  expect(click()).toBe(false);
  expect(next).not.toHaveBeenCalled();
});

it('does not consume vertical or predominantly vertical diagonal page scrolling', () => {
  const { pointer, next, previous } = setup();
  for (const [x, y] of [
    [105, 230],
    [180, 230],
  ] as const) {
    pointer('pointerdown', 100, 100);
    expect(pointer('pointermove', x, y).defaultPrevented).toBe(false);
    pointer('pointerup', x, y);
  }
  expect(next).not.toHaveBeenCalled();
  expect(previous).not.toHaveBeenCalled();
});

it('requires sufficient travel, while a short intentional drag cannot accidentally open the viewer', () => {
  vi.useFakeTimers();
  const { swipe, next, click } = setup();
  swipe(100, 125);
  expect(next).not.toHaveBeenCalled();
  expect(click()).toBe(true);
  vi.advanceTimersByTime(451);
  expect(click()).toBe(false);
});

it('ignores mouse drags and interactive controls, but permits the marked photo button', () => {
  const { pointer, next } = setup();
  pointer('pointerdown', 240, 100, { pointerType: 'mouse' });
  pointer('pointermove', 100, 100, { pointerType: 'mouse' });
  pointer('pointerup', 100, 100, { pointerType: 'mouse' });
  const control = Object.assign(new Surface(), { control: true });
  pointer('pointerdown', 240, 100, {}, control);
  pointer('pointermove', 100, 100, {}, control);
  pointer('pointerup', 100, 100, {}, control);
  expect(next).not.toHaveBeenCalled();
  control.allowed = true;
  pointer('pointerdown', 240, 100, {}, control);
  pointer('pointermove', 100, 100, {}, control);
  pointer('pointerup', 100, 100, {}, control);
  expect(next).toHaveBeenCalledTimes(1);
});

it('abandons multi-finger and cancelled gestures so pinch cannot change a photo', () => {
  const { pointer, next } = setup();
  pointer('pointerdown', 240, 100);
  pointer('pointerdown', 280, 100, { pointerId: 2 });
  pointer('pointermove', 100, 100);
  pointer('pointerup', 100, 100);
  pointer('pointerup', 280, 100, { pointerId: 2 });
  pointer('pointerdown', 240, 100);
  pointer('pointermove', 100, 100);
  pointer('pointercancel', 100, 100);
  pointer('pointerup', 100, 100);
  expect(next).not.toHaveBeenCalled();
});

it('allows native zoomed panning and cancels a swipe when viewport scale changes', () => {
  const { node, viewport, swipe, pointer, next } = setup();
  expect(node.style.touchAction).toBe('pan-y pinch-zoom');
  pointer('pointerdown', 240, 100);
  pointer('pointermove', 100, 100);
  viewport.scale = 2;
  viewport.dispatchEvent(new Event('resize'));
  pointer('pointerup', 100, 100);
  swipe(240, 100);
  expect(node.style.touchAction).toBe('auto');
  expect(next).not.toHaveBeenCalled();
  viewport.scale = 1;
  viewport.dispatchEvent(new Event('resize'));
  swipe(240, 100);
  expect(next).toHaveBeenCalledTimes(1);
});

it('respects disabled updates and restores styles/listeners on destruction', () => {
  const { action, node, swipe, next, previous } = setup();
  action.update({ enabled: false, next, previous });
  swipe(240, 100);
  expect(next).not.toHaveBeenCalled();
  action.update({ enabled: true, next, previous });
  cleanup!();
  cleanup = undefined;
  expect(node.style.touchAction).toBe('manipulation');
  swipe(240, 100);
  expect(next).not.toHaveBeenCalled();
});

it('locks an early horizontal intent, follows the finger and tolerates later vertical drift', () => {
  const { action, pointer, next, previous } = setup();
  const drag = vi.fn();
  action.update({ enabled: true, next, previous, drag });
  pointer('pointerdown', 240, 100);
  expect(pointer('pointermove', 231, 106).defaultPrevented).toBe(true);
  expect(drag).toHaveBeenLastCalledWith(-9);
  pointer('pointermove', 160, 210);
  pointer('pointerup', 160, 210);
  expect(next).toHaveBeenCalledOnce();
  expect(drag).toHaveBeenLastCalledWith(undefined);
});

it('returns the dragged rail to rest when pinch or pointer cancellation takes over', () => {
  const { action, pointer, next, previous } = setup();
  const drag = vi.fn();
  action.update({ enabled: true, next, previous, drag });
  pointer('pointerdown', 240, 100);
  pointer('pointermove', 200, 100);
  pointer('pointerdown', 280, 100, { pointerId: 2 });
  expect(drag).toHaveBeenLastCalledWith(undefined);
  pointer('pointerup', 200, 100);
  pointer('pointerup', 280, 100, { pointerId: 2 });
  pointer('pointerdown', 240, 100);
  pointer('pointermove', 200, 100);
  pointer('pointercancel', 200, 100);
  expect(drag).toHaveBeenLastCalledWith(undefined);
  expect(next).not.toHaveBeenCalled();
});
