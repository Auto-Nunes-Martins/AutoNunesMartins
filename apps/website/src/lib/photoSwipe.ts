type Options = {
  enabled: boolean;
  previous: () => void;
  next: () => void;
  drag?: (offset: number | undefined) => void;
  mouse?: boolean;
};
type Point = { id: number; x: number; y: number };

/** Arbitrate horizontal gestures; retain taps, native vertical scrolling and pinch. */
export function photoSwipe(node: HTMLElement, initial: Options) {
  let options = initial;
  let gesture: (Point & { horizontal: boolean; mouse: boolean }) | undefined;
  const pointers = new Set<number>();
  const viewport = window.visualViewport;
  const touchEvents = 'TouchEvent' in window;
  const originalTouchAction = node.style.touchAction;
  const originalUserSelect = node.style.userSelect;
  let suppressClickUntil = 0;
  let multipleTouches = false;
  const zoomed = () => (viewport?.scale ?? 1) > 1.01;
  let wasZoomed = zoomed();
  function surface(target: EventTarget | null) {
    if (!(target instanceof Element)) return false;
    const control = target.closest(
      'a, button, input, select, textarea, [role="button"], [contenteditable="true"]',
    );
    return !control || control.hasAttribute('data-swipe-surface');
  }
  function reset() {
    const current = gesture;
    gesture = undefined;
    if (current) {
      if (current.horizontal) suppressClickUntil = Date.now() + 450;
      if (node.hasPointerCapture?.(current.id)) node.releasePointerCapture(current.id);
    }
    node.style.userSelect = originalUserSelect;
    options.drag?.(undefined);
  }
  function syncZoom() {
    const next = zoomed();
    // iOS toolbar/keyboard changes resize visualViewport without changing zoom.
    if (next !== wasZoomed) reset();
    wasZoomed = next;
    node.style.touchAction = touchEvents || next ? 'auto' : 'pan-y pinch-zoom';
  }
  function start(point: Point, target: EventTarget | null, mouse = false) {
    if (!options.enabled || zoomed() || !surface(target)) return;
    gesture = { ...point, horizontal: false, mouse };
    if (mouse) node.style.userSelect = 'none';
  }
  function movePoint(point: Point, event: Event, capture = false) {
    if (!gesture || gesture.id !== point.id) return;
    if (zoomed()) {
      reset();
      return;
    }
    const dx = point.x - gesture.x,
      dy = point.y - gesture.y;
    if (!gesture.horizontal) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 6) return;
      if (Math.abs(dx) <= Math.abs(dy)) {
        reset();
        return;
      }
      gesture.horizontal = true;
      if (capture) node.setPointerCapture?.(point.id);
    }
    if (!event.cancelable) {
      reset();
      return;
    }
    event.preventDefault();
    options.drag?.(dx);
  }
  function finish(point: Point) {
    if (!gesture || gesture.id !== point.id) return;
    const current = gesture;
    reset();
    if (!current.horizontal) return;
    const dx = point.x - current.x;
    const threshold = Math.max(36, Math.min(72, node.clientWidth * 0.12));
    if (!options.enabled || zoomed() || Math.abs(dx) < threshold) return;
    if (dx < 0) options.next();
    else options.previous();
  }
  const pointerPoint = (e: PointerEvent): Point => ({
    id: e.pointerId,
    x: e.clientX,
    y: e.clientY,
  });
  function down(e: PointerEvent) {
    if (
      (touchEvents && e.pointerType === 'touch') ||
      e.button !== 0 ||
      e.isPrimary === false ||
      !(['touch', 'pen'].includes(e.pointerType) || (options.mouse && e.pointerType === 'mouse'))
    )
      return;
    pointers.add(e.pointerId);
    if (pointers.size > 1) {
      reset();
      return;
    }
    start(pointerPoint(e), e.target, e.pointerType === 'mouse');
  }
  function move(e: PointerEvent) {
    if (touchEvents && e.pointerType === 'touch') return;
    if (gesture?.mouse && !(e.buttons & 1)) {
      reset();
      pointers.delete(e.pointerId);
      return;
    }
    movePoint(pointerPoint(e), e, true);
  }
  function up(e: PointerEvent) {
    if (touchEvents && e.pointerType === 'touch') return;
    pointers.delete(e.pointerId);
    finish(pointerPoint(e));
  }
  function cancel(e: PointerEvent) {
    // WebKit can cancel Pointer Events while its Touch Events are still active.
    if (touchEvents && e.pointerType === 'touch') return;
    pointers.delete(e.pointerId);
    if (gesture?.id === e.pointerId) reset();
  }
  // Capture only after horizontal intent, so a simple click keeps its button target.
  // Before capture, a fast mouse movement/release can already be outside the photo.
  function outsideMove(e: PointerEvent) {
    if (gesture?.mouse && !e.composedPath().includes(node)) move(e);
  }
  function outsideUp(e: PointerEvent) {
    if (gesture?.mouse && !e.composedPath().includes(node)) up(e);
  }
  function lostCapture(e: PointerEvent) {
    pointers.delete(e.pointerId);
    if (gesture?.id === e.pointerId) reset();
  }
  function blur() {
    reset();
    pointers.clear();
  }
  function nativeDrag(e: DragEvent) {
    if (gesture?.mouse) e.preventDefault();
  }
  const touchPoint = (t: Touch): Point => ({ id: t.identifier, x: t.clientX, y: t.clientY });
  function touchStart(e: TouchEvent) {
    if (e.touches.length !== 1 || multipleTouches) {
      multipleTouches = true;
      reset();
      return;
    }
    start(touchPoint(e.touches[0]!), e.target);
  }
  function touchMove(e: TouchEvent) {
    if (multipleTouches || e.touches.length !== 1) {
      reset();
      return;
    }
    movePoint(touchPoint(e.touches[0]!), e);
  }
  function touchEnd(e: TouchEvent) {
    if (!multipleTouches && e.changedTouches.length) finish(touchPoint(e.changedTouches[0]!));
    if (!e.touches.length) multipleTouches = false;
  }
  function touchCancel() {
    multipleTouches = false;
    reset();
  }
  function click(e: MouseEvent) {
    if (e.detail === 0 || Date.now() >= suppressClickUntil || !surface(e.target)) return;
    e.preventDefault();
    e.stopImmediatePropagation();
  }
  syncZoom();
  viewport?.addEventListener('resize', syncZoom);
  node.addEventListener('pointerdown', down);
  node.addEventListener('pointermove', move, { passive: false });
  node.addEventListener('pointerup', up);
  node.addEventListener('pointercancel', cancel);
  node.addEventListener('lostpointercapture', lostCapture);
  node.addEventListener('dragstart', nativeDrag);
  window.addEventListener('pointermove', outsideMove, { passive: false });
  window.addEventListener('pointerup', outsideUp);
  window.addEventListener('pointercancel', cancel);
  window.addEventListener('blur', blur);
  if (touchEvents) {
    node.addEventListener('touchstart', touchStart, { passive: true });
    node.addEventListener('touchmove', touchMove, { passive: false });
    node.addEventListener('touchend', touchEnd);
    node.addEventListener('touchcancel', touchCancel);
  }
  node.addEventListener('click', click, true);
  return {
    update(next: Options) {
      options = next;
      if (!next.enabled || (gesture?.mouse && !next.mouse)) {
        reset();
        pointers.clear();
      }
    },
    destroy() {
      reset();
      pointers.clear();
      viewport?.removeEventListener('resize', syncZoom);
      node.removeEventListener('pointerdown', down);
      node.removeEventListener('pointermove', move);
      node.removeEventListener('pointerup', up);
      node.removeEventListener('pointercancel', cancel);
      node.removeEventListener('lostpointercapture', lostCapture);
      node.removeEventListener('dragstart', nativeDrag);
      window.removeEventListener('pointermove', outsideMove);
      window.removeEventListener('pointerup', outsideUp);
      window.removeEventListener('pointercancel', cancel);
      window.removeEventListener('blur', blur);
      node.removeEventListener('touchstart', touchStart);
      node.removeEventListener('touchmove', touchMove);
      node.removeEventListener('touchend', touchEnd);
      node.removeEventListener('touchcancel', touchCancel);
      node.removeEventListener('click', click, true);
      node.style.touchAction = originalTouchAction;
    },
  };
}
