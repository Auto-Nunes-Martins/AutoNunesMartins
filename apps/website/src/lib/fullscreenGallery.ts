type Point = { id: number; x: number; y: number };
type Gesture = Point & {
  lastY: number;
  lastTime: number;
  velocity: number;
  axis?: 'down' | 'other';
  outside: boolean;
};

/** Keep native pinch/pan and horizontal navigation; own only deliberate downward dismissal. */
export function fullscreenGallery(dialog: HTMLDialogElement, options?: { close: () => void }) {
  const close = () => options?.close ? options.close() : dialog.close();
  const viewport = window.visualViewport;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const nativeTouch = 'TouchEvent' in window;
  let gesture: Gesture | undefined;
  let multiple = false;
  let suppressUntil = 0;
  let closeTimer: ReturnType<typeof setTimeout> | undefined;
  let wasZoomed = zoomed();
  const pointers = new Set<number>();
  function zoomed() {
    return (viewport?.scale ?? 1) > 1.01;
  }
  function surface(target: EventTarget | null) {
    return (
      target instanceof Element &&
      !target.closest(
        'button, a, input, textarea, select, [role="button"], [contenteditable="true"], .viewer-thumbnails, #gallery-caption, .rail-contact, .viewer-contact',
      )
    );
  }
  function outside(point: Point) {
    const image = dialog.querySelector<HTMLImageElement>(
      '.photo-rail-slide:not([inert]) img, .viewer-stage > img',
    );
    if (!image?.naturalWidth) return true;
    const rect = image.getBoundingClientRect();
    const scale = Math.min(rect.width / image.naturalWidth, rect.height / image.naturalHeight);
    const width = image.naturalWidth * scale,
      height = image.naturalHeight * scale;
    const left = rect.left + (rect.width - width) / 2,
      top = rect.top + (rect.height - height) / 2;
    return point.x < left || point.x > left + width || point.y < top || point.y > top + height;
  }
  function pose(offset: number, dragging = false) {
    dialog.toggleAttribute('data-dismiss-dragging', dragging);
    dialog.style.setProperty('--viewer-dismiss-y', offset + 'px');
    dialog.style.setProperty(
      '--viewer-dismiss-opacity',
      String(Math.max(0, 1 - offset / Math.max(240, dialog.clientHeight * 0.65))),
    );
  }
  function reset() {
    if (gesture?.axis || multiple) suppressUntil = Date.now() + 500;
    gesture = undefined;
    pose(0);
  }
  function start(point: Point, target: EventTarget | null) {
    if (!dialog.open || closeTimer || zoomed() || !surface(target)) return;
    gesture = {
      ...point,
      lastY: point.y,
      lastTime: performance.now(),
      velocity: 0,
      outside: outside(point),
    };
  }
  function move(point: Point, event: Event) {
    if (!gesture || gesture.id !== point.id) return;
    if (zoomed()) {
      reset();
      return;
    }
    const dx = point.x - gesture.x,
      dy = point.y - gesture.y;
    if (!gesture.axis) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 10) return;
      // A diagonal or upward start belongs to navigation/native gestures for its entire lifetime.
      gesture.axis = dy > 0 && dy > Math.abs(dx) * 1.35 ? 'down' : 'other';
    }
    if (gesture.axis !== 'down') return;
    if (!event.cancelable) {
      reset();
      return;
    }
    event.preventDefault();
    const now = performance.now();
    if (now > gesture.lastTime)
      gesture.velocity = (point.y - gesture.lastY) / (now - gesture.lastTime);
    gesture.lastY = point.y;
    gesture.lastTime = now;
    pose(Math.max(0, dy), true);
  }
  function end(point: Point) {
    if (!gesture || gesture.id !== point.id) return;
    const current = gesture,
      dy = point.y - current.y;
    const recent = performance.now() - current.lastTime < 100;
    const dismiss =
      current.axis === 'down' &&
      !zoomed() &&
      (dy > Math.max(100, Math.min(180, dialog.clientHeight * 0.2)) ||
        (dy > 55 && recent && current.velocity > 0.65));
    reset();
    if (dismiss) {
      if (options?.close) options.close();
      else if (reduced.matches) close();
      else {
        pose(Math.max(dy, dialog.clientHeight));
        closeTimer = setTimeout(() => {
          closeTimer = undefined;
          close();
        }, 180);
      }
    } else if (
      !current.axis &&
      current.outside &&
      outside(point) &&
      Math.hypot(point.x - current.x, dy) < 6 &&
      !zoomed() &&
      Date.now() >= suppressUntil
    ) {
      // Wait for the matching native click rather than closing underneath touchend.
      tap = point;
    }
  }
  let tap: Point | undefined;
  function click(event: MouseEvent) {
    if (!surface(event.target)) return;
    if (Date.now() < suppressUntil) {
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }
    const point = { id: 0, x: event.clientX, y: event.clientY };
    if (tap && !zoomed() && outside(point) && Math.hypot(point.x - tap.x, point.y - tap.y) < 6) {
      event.preventDefault();
      event.stopPropagation();
      close();
    }
    tap = undefined;
  }
  const pointer = (event: PointerEvent): Point => ({
    id: event.pointerId,
    x: event.clientX,
    y: event.clientY,
  });
  function down(event: PointerEvent) {
    if ((nativeTouch && event.pointerType === 'touch') || event.button !== 0) return;
    tap = undefined;
    pointers.add(event.pointerId);
    if (pointers.size > 1 || multiple) {
      multiple = true;
      reset();
      return;
    }
    start(pointer(event), event.target);
  }
  function pointerMove(event: PointerEvent) {
    if (!(nativeTouch && event.pointerType === 'touch')) move(pointer(event), event);
  }
  function up(event: PointerEvent) {
    if (nativeTouch && event.pointerType === 'touch') return;
    pointers.delete(event.pointerId);
    if (!multiple) end(pointer(event));
    if (!pointers.size) multiple = false;
  }
  function cancel(event: PointerEvent) {
    // WebKit pointer cancellation must not reset an ongoing native Touch Events gesture.
    if (nativeTouch && event.pointerType === 'touch') return;
    pointers.delete(event.pointerId);
    reset();
    tap = undefined;
    if (!pointers.size) multiple = false;
  }
  const touch = (point: Touch): Point => ({
    id: point.identifier,
    x: point.clientX,
    y: point.clientY,
  });
  function touchStart(event: TouchEvent) {
    tap = undefined;
    if (event.touches.length !== 1 || multiple) {
      multiple = true;
      reset();
      return;
    }
    start(touch(event.touches[0]!), event.target);
  }
  function touchMove(event: TouchEvent) {
    if (!multiple && event.touches.length === 1) move(touch(event.touches[0]!), event);
  }
  function touchEnd(event: TouchEvent) {
    if (!multiple && event.changedTouches.length) end(touch(event.changedTouches[0]!));
    if (!event.touches.length) multiple = false;
  }
  function touchCancel() {
    reset();
    tap = undefined;
    multiple = false;
  }
  function zoomChange() {
    const next = zoomed();
    if (next !== wasZoomed) {
      reset();
      tap = undefined;
    }
    wasZoomed = next;
  }
  function closed() {
    clearTimeout(closeTimer);
    closeTimer = undefined;
    reset();
    tap = undefined;
    multiple = false;
    pointers.clear();
  }
  const events: [string, EventListener, AddEventListenerOptions?][] = [
    ['pointerdown', down as EventListener],
    ['pointermove', pointerMove as EventListener, { passive: false }],
    ['pointerup', up as EventListener],
    ['pointercancel', cancel as EventListener],
    ['click', click as EventListener, { capture: true }],
    ['close', closed],
    ...(nativeTouch
      ? ([
          ['touchstart', touchStart as EventListener, { passive: true }],
          ['touchmove', touchMove as EventListener, { passive: false }],
          ['touchend', touchEnd as EventListener],
          ['touchcancel', touchCancel],
        ] as [string, EventListener, AddEventListenerOptions?][])
      : []),
  ];
  for (const [name, listener, options] of events) dialog.addEventListener(name, listener, options);
  viewport?.addEventListener('resize', zoomChange);
  return {
    destroy() {
      closed();
      for (const [name, listener, options] of events)
        dialog.removeEventListener(name, listener, options);
      viewport?.removeEventListener('resize', zoomChange);
      dialog.removeAttribute('data-dismiss-dragging');
      dialog.style.removeProperty('--viewer-dismiss-y');
      dialog.style.removeProperty('--viewer-dismiss-opacity');
    },
  };
}
