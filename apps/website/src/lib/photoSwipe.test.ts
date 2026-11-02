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
function setup(touchEvents = false) {
  vi.stubGlobal('Element', Surface);
  const viewport = Object.assign(new EventTarget(), { scale: 1 });
  const windowTarget = Object.assign(new EventTarget(), {
    visualViewport: viewport,
    ...(touchEvents ? { TouchEvent: Event } : {}),
  });
  vi.stubGlobal('window', windowTarget);
  const node = Object.assign(new Surface(), {
    clientWidth: 400,
    style: { touchAction: 'manipulation', userSelect: 'text' },
    setPointerCapture: vi.fn(),
    hasPointerCapture: () => true,
    releasePointerCapture: vi.fn(),
  });
  const next = vi.fn(),
    previous = vi.fn();
  const action = photoSwipe(node as unknown as HTMLElement, { enabled: true, next, previous });
  cleanup = action.destroy;
  function pointer(
    type: string,
    x: number,
    y: number,
    extra = {},
    target: Surface = node,
    dispatch: EventTarget = node,
  ) {
    const event = Object.assign(new Event(type, { cancelable: true }), {
      clientX: x,
      clientY: y,
      pointerId: 1,
      pointerType: 'touch',
      button: 0,
      buttons: type === 'pointerup' || type === 'pointercancel' ? 0 : 1,
      ...extra,
    });
    if (target !== node) Object.defineProperty(event, 'target', { value: target });
    dispatch.dispatchEvent(event);
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
  return { node, windowTarget, viewport, next, previous, action, pointer, click, swipe };
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

it('preserves mouse clicks without capture, including browsers with TouchEvent support', () => {
  const { node, action, pointer, next, previous, click } = setup(true);
  action.update({ enabled: true, mouse: true, next, previous });
  pointer('pointerdown', 240, 100, { pointerType: 'mouse' });
  expect(node.style.userSelect).toBe('none');
  pointer('pointermove', 237, 102, { pointerType: 'mouse' });
  expect(node.setPointerCapture).not.toHaveBeenCalled();
  pointer('pointerup', 237, 102, { pointerType: 'mouse' });
  expect(node.style.userSelect).toBe('text');
  expect(click()).toBe(false);
  expect(next).not.toHaveBeenCalled();
});

it('navigates both ways with an opted-in primary mouse drag, blocking native drag and ghost clicks', () => {
  const { node, action, pointer, next, previous, click } = setup();
  action.update({ enabled: true, mouse: true, next, previous });
  for (const [from, to] of [
    [240, 100],
    [100, 240],
  ] as const) {
    pointer('pointerdown', from, 100, { pointerType: 'mouse' });
    const native = new Event('dragstart', { cancelable: true });
    node.dispatchEvent(native);
    expect(native.defaultPrevented).toBe(true);
    expect(pointer('pointermove', to, 100, { pointerType: 'mouse' }).defaultPrevented).toBe(true);
    expect(node.setPointerCapture).toHaveBeenCalledWith(1);
    pointer('pointerup', to, 100, { pointerType: 'mouse' });
  }
  expect(next).toHaveBeenCalledOnce();
  expect(previous).toHaveBeenCalledOnce();
  expect(click()).toBe(true);
  expect(click(0)).toBe(false);
  expect(node.style.userSelect).toBe('text');
});

it('finishes fast mouse drags outside the surface before capture, without leaving a selection lock', () => {
  const { node, windowTarget, action, pointer, next, previous } = setup();
  action.update({ enabled: true, mouse: true, next, previous });
  pointer('pointerdown', 240, 100, { pointerType: 'mouse' });
  pointer('pointermove', 80, 100, { pointerType: 'mouse' }, node, windowTarget);
  pointer('pointerup', 80, 100, { pointerType: 'mouse' }, node, windowTarget);
  expect(next).toHaveBeenCalledOnce();
  expect(node.style.userSelect).toBe('text');
});

it('rejects secondary mouse buttons and control drags even when mouse navigation is enabled', () => {
  const { action, pointer, next, previous } = setup();
  action.update({ enabled: true, mouse: true, next, previous });
  const control = Object.assign(new Surface(), { control: true });
  for (const [extra, target] of [
    [{ button: 2 }, undefined],
    [{ isPrimary: false }, undefined],
    [{}, control],
  ] as const) {
    pointer('pointerdown', 240, 100, { pointerType: 'mouse', ...extra }, target);
    pointer('pointermove', 80, 100, { pointerType: 'mouse' });
    pointer('pointerup', 80, 100, { pointerType: 'mouse' });
  }
  expect(next).not.toHaveBeenCalled();
});

it('cancels mouse navigation on lost capture, cancellation, lost button, blur or disabling mouse', () => {
  const { node, windowTarget, action, pointer, next, previous } = setup();
  for (const cancel of [
    () => pointer('lostpointercapture', 160, 100, { pointerType: 'mouse' }),
    () => pointer('pointercancel', 160, 100, { pointerType: 'mouse' }),
    () => pointer('pointermove', 160, 100, { pointerType: 'mouse', buttons: 0 }),
    () => windowTarget.dispatchEvent(new Event('blur')),
    () => action.update({ enabled: true, mouse: false, next, previous }),
  ]) {
    action.update({ enabled: true, mouse: true, next, previous });
    pointer('pointerdown', 240, 100, { pointerType: 'mouse' });
    pointer('pointermove', 160, 100, { pointerType: 'mouse' });
    cancel();
    pointer('pointerup', 80, 100, { pointerType: 'mouse' });
    expect(node.style.userSelect).toBe('text');
  }
  expect(next).not.toHaveBeenCalled();
});

it('commits a short deliberate detail drag while keeping tiny movements as taps', () => {
  const { action, pointer, next, previous, click } = setup();
  action.update({ enabled: true, mouse: true, commitDistance: 24, next, previous });
  pointer('pointerdown', 240, 100, { pointerType: 'mouse' });
  pointer('pointermove', 210, 102, { pointerType: 'mouse' });
  pointer('pointerup', 210, 102, { pointerType: 'mouse' });
  expect(next).toHaveBeenCalledOnce();
  expect(click()).toBe(true);
});

it('does not cancel a swipe when capture loss bubbles from its child', () => {
  const { node, action, pointer, next, previous } = setup();
  action.update({ enabled: true, mouse: true, next, previous });
  pointer('pointerdown', 240, 100, { pointerType: 'mouse' });
  pointer('pointermove', 100, 100, { pointerType: 'mouse' });
  pointer('lostpointercapture', 100, 100, { pointerType: 'mouse' }, new Surface());
  pointer('pointerup', 100, 100, { pointerType: 'mouse' });
  expect(next).toHaveBeenCalledOnce();
});

it('lets touchend commit even when native pointer capture ends with the same touch identifier', () => {
  const { node, pointer, next } = setup(true);
  touch(node, 'touchstart', [[240, 100, 1]]);
  touch(node, 'touchmove', [[100, 100, 1]]);
  pointer('lostpointercapture', 100, 100, { pointerType: 'touch', pointerId: 1 });
  touch(node, 'touchend', [], [[100, 100, 1]]);
  expect(next).toHaveBeenCalledOnce();
});

it('abandons multi-finger and cancelled gestures so pinch cannot change a photo', () => {
  const { pointer, next } = setup();
  pointer('pointerdown', 240, 100);
  pointer('pointerdown', 280, 100, { pointerId: 2, isPrimary: false });
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

function touch(node: EventTarget, type: string, points: number[][], changed = points) {
  const convert = ([x, y, id = 1]: number[]) => ({ clientX: x, clientY: y, identifier: id });
  const event = Object.assign(new Event(type, { cancelable: true }), {
    touches: points.map(convert),
    changedTouches: changed.map(convert),
  });
  node.dispatchEvent(event);
  return event;
}
it('keeps iOS touch swipes alive through toolbar resize and pointer cancellation without consuming vertical scroll', () => {
  const { node, viewport, pointer, next, previous, action } = setup(true);
  const drag = vi.fn();
  action.update({ enabled: true, next, previous, drag });
  expect(node.style.touchAction).toBe('auto');
  touch(node, 'touchstart', [[240, 100]]);
  expect(touch(node, 'touchmove', [[220, 106]]).defaultPrevented).toBe(true);
  viewport.dispatchEvent(new Event('resize'));
  pointer('pointercancel', 220, 106);
  expect(touch(node, 'touchmove', [[160, 130]]).defaultPrevented).toBe(true);
  touch(node, 'touchend', [], [[160, 130]]);
  expect(next).toHaveBeenCalledOnce();
  touch(node, 'touchstart', [[240, 100]]);
  expect(touch(node, 'touchmove', [[230, 160]]).defaultPrevented).toBe(false);
  touch(node, 'touchend', [], [[180, 230]]);
  expect(next).toHaveBeenCalledOnce();
});
it('yields immediately to a second touch/native pinch and true zoom changes', () => {
  const { node, viewport, next, previous, action } = setup(true);
  const drag = vi.fn();
  action.update({ enabled: true, next, previous, drag });
  touch(node, 'touchstart', [[240, 100]]);
  touch(node, 'touchmove', [[200, 100]]);
  touch(node, 'touchstart', [
    [200, 100],
    [280, 100, 2],
  ]);
  expect(
    touch(node, 'touchmove', [
      [180, 100],
      [300, 100, 2],
    ]).defaultPrevented,
  ).toBe(false);
  touch(
    node,
    'touchend',
    [],
    [
      [180, 100],
      [300, 100, 2],
    ],
  );
  expect(drag).toHaveBeenLastCalledWith(undefined);
  touch(node, 'touchstart', [[240, 100]]);
  touch(node, 'touchmove', [[200, 100]]);
  viewport.scale = 2;
  viewport.dispatchEvent(new Event('resize'));
  touch(node, 'touchend', [], [[100, 100]]);
  expect(next).not.toHaveBeenCalled();
});
