type Range = { start: number; end: number };

/** Minimal shift, with one neighbour as context only when both items fit. */
export function thumbnailScrollTarget(current: number, maximum: number, viewport: Range, selected: Range, neighbour?: Range) {
  let range = selected;
  if (neighbour) {
    const pair = { start: Math.min(selected.start, neighbour.start), end: Math.max(selected.end, neighbour.end) };
    if (pair.end - pair.start <= viewport.end - viewport.start) range = pair;
  }
  const delta = range.start < viewport.start ? range.start - viewport.start : range.end > viewport.end ? range.end - viewport.end : 0;
  return Math.max(0, Math.min(maximum, current + delta));
}

/** Scroll this strip only. Manual scrolling never writes the selected index. */
export function followThumbnail(node: HTMLElement, index: number) {
  let selected = index, direction = 0, measureFrame = 0, animationFrame = 0;
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const stop = () => { cancelAnimationFrame(animationFrame); animationFrame = 0; };
  function measure() {
    measureFrame = 0;
    const items = [...node.querySelectorAll<HTMLElement>('button')];
    const active = items[selected];
    if (!active || !node.clientWidth || !node.clientHeight) return;
    const style = getComputedStyle(node), horizontal = style.flexDirection.startsWith('row');
    const box = node.getBoundingClientRect();
    const start = horizontal ? box.left + node.clientLeft : box.top + node.clientTop;
    const size = horizontal ? node.clientWidth : node.clientHeight;
    const current = horizontal ? node.scrollLeft : node.scrollTop;
    const maximum = (horizontal ? node.scrollWidth : node.scrollHeight) - size;
    const viewport = { start: start + parseFloat(horizontal ? style.paddingLeft : style.paddingTop), end: start + size - parseFloat(horizontal ? style.paddingRight : style.paddingBottom) };
    const range = (item: HTMLElement) => { const rect = item.getBoundingClientRect(); return { start: horizontal ? rect.left : rect.top, end: horizontal ? rect.right : rect.bottom }; };
    const neighbour = direction ? items[selected + direction] : undefined;
    const target = thumbnailScrollTarget(current, maximum, viewport, range(active), neighbour && range(neighbour));
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
