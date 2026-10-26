/** Mouse dragging complements native touch scrolling without selecting a photo after a drag. */
export function dragThumbnailStrip(node: HTMLElement) {
  let pointer: number | null = null;
  let start = 0,
    scroll = 0,
    dragging = false,
    suppressUntil = 0;
  let lastX = 0,
    lastTime = 0,
    velocity = 0,
    frame = 0;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
  function stop() {
    cancelAnimationFrame(frame);
    frame = 0;
  }
  function coast() {
    if (reduced.matches || performance.now() - lastTime > 80) return;
    const distance = Math.max(-90, Math.min(90, velocity * 110));
    if (Math.abs(distance) < 3) return;
    const began = performance.now(),
      origin = node.scrollLeft;
    const maximum = node.scrollWidth - node.clientWidth;
    const target = Math.max(0, Math.min(maximum, origin + distance));
    const animate = (time: number) => {
      const elapsed = time - began;
      const progress = (1 - Math.exp(-elapsed / 110)) / (1 - Math.exp(-360 / 110));
      node.scrollLeft = origin + (target - origin) * Math.min(1, progress);
      frame = elapsed < 360 ? requestAnimationFrame(animate) : 0;
    };
    frame = requestAnimationFrame(animate);
  }
  function down(event: PointerEvent) {
    stop();
    if (event.pointerType !== 'mouse' || event.button !== 0) return;
    // Stop native image dragging before the browser can cancel our pointer stream.
    event.preventDefault();
    pointer = event.pointerId;
    start = event.clientX;
    scroll = node.scrollLeft;
    dragging = false;
    lastX = event.clientX;
    lastTime = performance.now();
    velocity = 0;
  }
  function move(event: PointerEvent) {
    if (event.pointerId !== pointer) return;
    const now = performance.now(),
      elapsed = now - lastTime;
    if (elapsed > 0) velocity = velocity * 0.3 + ((lastX - event.clientX) / elapsed) * 0.7;
    lastX = event.clientX;
    lastTime = now;
    const delta = event.clientX - start;
    if (!dragging && Math.abs(delta) < 6) return;
    if (!dragging) {
      dragging = true;
      node.setPointerCapture(event.pointerId);
      node.classList.add('is-dragging');
    }
    event.preventDefault();
    node.scrollLeft = scroll - delta;
  }
  function end(event: PointerEvent) {
    if (event.pointerId !== pointer) return;
    if (dragging) {
      suppressUntil = performance.now() + 200;
      if (event.type === 'pointerup') coast();
    }
    pointer = null;
    dragging = false;
    node.classList.remove('is-dragging');
    if (node.hasPointerCapture(event.pointerId)) node.releasePointerCapture(event.pointerId);
  }
  function click(event: MouseEvent) {
    if (event.detail && performance.now() < suppressUntil) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }
  const preventDrag = (event: DragEvent) => event.preventDefault();
  function wheel(event: WheelEvent) {
    stop();
    // On desktop the strip has no native wheel target: mixed vertical gestures
    // must reach the page. Handle only intentional horizontal movement here.
    if (!finePointer.matches || Math.abs(event.deltaX) <= Math.abs(event.deltaY)) return;
    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? node.clientWidth : 1;
    const next = Math.max(
      0,
      Math.min(node.scrollWidth - node.clientWidth, node.scrollLeft + event.deltaX * unit),
    );
    if (next === node.scrollLeft) return;
    event.preventDefault();
    node.scrollLeft = next;
  }
  node.addEventListener('pointerdown', down);
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', end);
  window.addEventListener('pointercancel', end);
  node.addEventListener('lostpointercapture', end);
  node.addEventListener('click', click, true);
  node.addEventListener('dragstart', preventDrag);
  node.addEventListener('wheel', wheel, { passive: false });
  node.addEventListener('keydown', stop);
  node.addEventListener('thumbnail-scroll-interrupt', stop);
  reduced.addEventListener('change', stop);
  return {
    destroy() {
      stop();
      node.removeEventListener('pointerdown', down);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
      node.removeEventListener('lostpointercapture', end);
      node.removeEventListener('click', click, true);
      node.removeEventListener('dragstart', preventDrag);
      node.classList.remove('is-dragging');
      node.removeEventListener('wheel', wheel);
      node.removeEventListener('keydown', stop);
      node.removeEventListener('thumbnail-scroll-interrupt', stop);
      reduced.removeEventListener('change', stop);
    },
  };
}
