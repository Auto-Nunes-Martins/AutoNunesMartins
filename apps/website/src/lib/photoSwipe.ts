type Options = {
  enabled: boolean;
  previous: () => void;
  next: () => void;
  drag?: (offset: number | undefined) => void;
};

/** One deliberate touch gesture changes one photo; native vertical scroll and pinch remain available. */
export function photoSwipe(node: HTMLElement, initial: Options) {
  let options = initial;
  let gesture: { id: number; x: number; y: number; horizontal: boolean } | undefined;
  const pointers = new Set<number>();
  const viewport = window.visualViewport;
  const originalTouchAction = node.style.touchAction;
  let suppressClickUntil = 0;
  const zoomed = () => (viewport?.scale ?? 1) > 1.01;
  function surface(target: EventTarget | null) {
    if (!(target instanceof Element)) return false;
    const control = target.closest(
      'a, button, input, select, textarea, [role="button"], [contenteditable="true"]',
    );
    return !control || control.hasAttribute('data-swipe-surface');
  }
  function release(id: number) {
    if (node.hasPointerCapture?.(id)) node.releasePointerCapture(id);
  }
  function reset() {
    if (gesture) {
      if (gesture.horizontal) suppressClickUntil = Date.now() + 450;
      release(gesture.id);
    }
    gesture = undefined;
    options.drag?.(undefined);
  }
  function syncZoom() {
    reset();
    node.style.touchAction = zoomed() ? 'auto' : 'pan-y pinch-zoom';
  }
  function down(event: PointerEvent) {
    if (
      !options.enabled ||
      event.button !== 0 ||
      !['touch', 'pen'].includes(event.pointerType) ||
      zoomed()
    )
      return;
    pointers.add(event.pointerId);
    if (pointers.size > 1) {
      reset();
      return;
    }
    if (!surface(event.target)) return;
    gesture = { id: event.pointerId, x: event.clientX, y: event.clientY, horizontal: false };
  }
  function move(event: PointerEvent) {
    if (!gesture || gesture.id !== event.pointerId) return;
    const dx = event.clientX - gesture.x,
      dy = event.clientY - gesture.y;
    if (!gesture.horizontal) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 6) return;
      if (Math.abs(dx) <= Math.abs(dy)) {
        reset();
        return;
      }
      gesture.horizontal = true;
      node.setPointerCapture?.(event.pointerId);
    }
    if (event.cancelable) event.preventDefault();
    options.drag?.(dx);
  }
  function up(event: PointerEvent) {
    pointers.delete(event.pointerId);
    if (!gesture || gesture.id !== event.pointerId) return;
    const current = gesture;
    reset();
    if (!current.horizontal) return;
    // The following synthetic tap must not open/close the viewer after a drag.
    suppressClickUntil = Date.now() + 450;
    const dx = event.clientX - current.x;
    const threshold = Math.max(36, Math.min(72, node.clientWidth * 0.12));
    if (!options.enabled || zoomed() || Math.abs(dx) < threshold) return;
    if (dx < 0) options.next();
    else options.previous();
  }
  function cancel(event: PointerEvent) {
    pointers.delete(event.pointerId);
    if (gesture?.id === event.pointerId) reset();
  }
  function click(event: MouseEvent) {
    if (event.detail === 0 || Date.now() >= suppressClickUntil || !surface(event.target)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }
  syncZoom();
  viewport?.addEventListener('resize', syncZoom);
  node.addEventListener('pointerdown', down);
  node.addEventListener('pointermove', move, { passive: false });
  node.addEventListener('pointerup', up);
  node.addEventListener('pointercancel', cancel);
  node.addEventListener('click', click, true);
  return {
    update(next: Options) {
      options = next;
      if (!next.enabled) {
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
      node.removeEventListener('click', click, true);
      node.style.touchAction = originalTouchAction;
    },
  };
}
