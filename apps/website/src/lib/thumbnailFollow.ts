type Range = { start: number; end: number };

/** Position early, leaving more visible context in the direction of travel. */
export function thumbnailScrollTarget(current: number, maximum: number, viewport: Range, selected: Range, direction = 0) {
  const anchor = direction > 0 ? .35 : direction < 0 ? .65 : .5;
  const desiredCenter = viewport.start + (viewport.end - viewport.start) * anchor;
  const selectedCenter = (selected.start + selected.end) / 2;
  return Math.max(0, Math.min(maximum, current + selectedCenter - desiredCenter));
}

/** Scroll this strip only. Manual scrolling never writes the selected index. */
export function followThumbnail(node: HTMLElement, index: number) {
  let selected = index, direction = 0, measureFrame = 0, animationFrame = 0;
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const bounded = node.classList.contains('viewer-thumbnails');
  const stop = () => { cancelAnimationFrame(animationFrame); animationFrame = 0; };
  function measure() {
    measureFrame = 0;
    const items = [...node.querySelectorAll<HTMLElement>('button')];
    const active = items[selected];
    if (!active || !node.clientWidth || !node.clientHeight) return;
    const style = getComputedStyle(node), horizontal = style.flexDirection.startsWith('row');
    const first = items[0]!.getBoundingClientRect();
    const gap = parseFloat(horizontal ? style.columnGap : style.rowGap);
    const pitch = (horizontal ? first.width : first.height) + gap;
    if (bounded && node.parentElement) {
      const parent = node.parentElement, parentStyle = getComputedStyle(parent);
      const padding = horizontal
        ? parseFloat(style.paddingLeft) + parseFloat(style.paddingRight)
        : parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
      const available = horizontal
        ? parent.clientWidth - parseFloat(parentStyle.paddingLeft) - parseFloat(parentStyle.paddingRight)
        : parent.clientHeight - parseFloat(parentStyle.paddingTop) - parseFloat(parentStyle.paddingBottom) - 56;
      const limit = horizontal ? (window.innerHeight <= 650 ? 10 : 14) : 6;
      const count = Math.max(1, Math.min(items.length, limit, Math.floor((available - padding + gap) / pitch)));
      node.style.width = horizontal ? `${count * pitch - gap + padding}px` : '';
      node.style.height = horizontal ? '' : `${count * pitch - gap + padding}px`;
    }
    const box = node.getBoundingClientRect();
    const start = horizontal ? box.left + node.clientLeft : box.top + node.clientTop;
    const size = horizontal ? node.clientWidth : node.clientHeight;
    const current = horizontal ? node.scrollLeft : node.scrollTop;
    const maximum = (horizontal ? node.scrollWidth : node.scrollHeight) - size;
    const viewport = { start: start + parseFloat(horizontal ? style.paddingLeft : style.paddingTop), end: start + size - parseFloat(horizontal ? style.paddingRight : style.paddingBottom) };
    const range = (item: HTMLElement) => { const rect = item.getBoundingClientRect(); return { start: horizontal ? rect.left : rect.top, end: horizontal ? rect.right : rect.bottom }; };
    const desired = thumbnailScrollTarget(current, maximum, viewport, range(active), direction);
    // Whole cells at both edges; keep the same early directional context.
    const target = bounded ? Math.max(0, Math.min(maximum, Math.round(desired / pitch) * pitch)) : desired;
    if (Math.abs(target - current) < .5) return;
    const write = (value: number) => node.scrollTo({ left: horizontal ? value : node.scrollLeft, top: horizontal ? node.scrollTop : value, behavior: 'instant' });
    if (motion.matches) { write(target); return; }
    const began = performance.now();
    const animate = (now: number) => {
      const progress = Math.min(1, (now - began) / 180);
      write(current + (target - current) * (1 - (1 - progress) ** 3));
      animationFrame = progress < 1 ? requestAnimationFrame(animate) : 0;
    };
    animationFrame = requestAnimationFrame(animate);
  }
  function schedule() { stop(); cancelAnimationFrame(measureFrame); measureFrame = requestAnimationFrame(measure); }
  const observer = new ResizeObserver(schedule);
  observer.observe(node);
  if (bounded && node.parentElement) observer.observe(node.parentElement);
  for (const item of node.children) observer.observe(item);
  const manual = () => { stop(); cancelAnimationFrame(measureFrame); measureFrame = 0; };
  node.addEventListener('wheel', manual, { passive: true });
  node.addEventListener('pointerdown', manual, { passive: true });
  node.addEventListener('touchstart', manual, { passive: true });
  motion.addEventListener('change', schedule);
  schedule();
  return {
    update(next: number) {
      if (next === selected) return;
      direction = Math.sign(next - selected); selected = next; schedule();
    },
    destroy() {
      manual(); observer.disconnect(); motion.removeEventListener('change', schedule);
      node.removeEventListener('wheel', manual); node.removeEventListener('pointerdown', manual); node.removeEventListener('touchstart', manual);
    },
  };
}
