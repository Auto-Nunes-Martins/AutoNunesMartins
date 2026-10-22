export const heroDirections = [
  { id: 1, name: 'Pela estrada fora' },
  { id: 2, name: 'Original preservado' },
  { id: 3, name: 'Pinhal em curvas' },
  { id: 4, name: 'Serra verde' },
  { id: 5, name: 'Estrada na floresta' },
  { id: 6, name: 'Curvas no bosque' },
  { id: 7, name: 'Caminho entre árvores' },
] as const;

/** Native scroll, one scheduled write per frame, no pinning or layout reads per frame. */
export function directionMotion(node: HTMLElement) {
  const preference = matchMedia('(prefers-reduced-motion: reduce)');
  let frame = 0;
  let visible = false;
  let top = 0;
  let height = 1;
  const draw = () => {
    frame = 0;
    node.style.setProperty(
      '--hd-travel',
      String(preference.matches ? 0 : Math.max(0, Math.min(1, (scrollY - top) / height))),
    );
  };
  const schedule = () => {
    if (visible && !frame) frame = requestAnimationFrame(draw);
  };
  const measure = () => {
    const box = node.getBoundingClientRect();
    top = box.top + scrollY;
    height = Math.max(1, box.height);
    schedule();
  };
  const observer = new IntersectionObserver(([entry]) => {
    visible = entry?.isIntersecting ?? false;
    if (visible) measure();
  });
  observer.observe(node);
  const resize = new ResizeObserver(measure);
  resize.observe(node);
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', measure);
  preference.addEventListener('change', draw);
  measure();
  return {
    destroy() {
      cancelAnimationFrame(frame);
      observer.disconnect();
      resize.disconnect();
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', measure);
      preference.removeEventListener('change', draw);
    },
  };
}
