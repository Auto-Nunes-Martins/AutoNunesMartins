import { scrollFrame, setScrollStyle } from './scrollFrame';

/** Preserve the approved poses, but measure only near the visible artwork. */
export function campaignMotion(element: HTMLElement) {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const key = element.querySelector<HTMLElement>('.campaign-motifs > .art-key');
  const car = element.querySelector<HTMLElement>('.campaign-motifs > .art-car');
  const percent = element.querySelector<HTMLElement>('.falling-percent-layer > span');
  const motifs = element.querySelector<HTMLElement>('.campaign-motifs');
  let nearby = false;
  const draw = scrollFrame(() => {
    if (!nearby || document.hidden) return;
    const rect = element.getBoundingClientRect();
    const distance = reduced.matches
      ? 0
      : Math.max(0, innerHeight / 2 - rect.top - rect.height / 2) * 0.14;
    const nextVehicles = element.parentElement?.querySelector('#selecao .car-grid');
    // Read both geometries before changing any inline style (shared with other scroll effects).
    const fadeEnd = nextVehicles
      ? nextVehicles.getBoundingClientRect().top - (rect.bottom - 201) - 12
      : null;
    return () => {
      // Scope changing values to the artwork, not every card and masked surface.
      if (key) setScrollStyle(key, '--campaign-fall', `${distance.toFixed(2)}px`);
      if (car) setScrollStyle(car, '--campaign-fall', `${distance.toFixed(2)}px`);
      if (key)
        setScrollStyle(
          key,
          '--campaign-key-tilt',
          `${(-Math.min(110, distance * 0.48)).toFixed(2)}deg`,
        );
      if (percent)
        setScrollStyle(
          percent,
          '--campaign-percent-drop',
          `${(distance * 0.9 + distance * distance * 0.003).toFixed(2)}px`,
        );
      if (percent)
        setScrollStyle(
          percent,
          '--campaign-percent-tilt',
          `${Math.min(42, distance * 0.16).toFixed(2)}deg`,
        );
      if (fadeEnd !== null) {
        if (motifs)
          setScrollStyle(motifs, '--motif-extent', `${Math.max(259, fadeEnd).toFixed(2)}px`);
        setScrollStyle(
          element,
          '--campaign-art-overflow',
          `${Math.max(400, fadeEnd - 193).toFixed(2)}px`,
        );
      }
    };
  });
  const schedule = () => {
    if (nearby && !document.hidden && !reduced.matches) draw.schedule();
  };
  const refresh = () => {
    element.dataset.motionActive = String(nearby && !document.hidden);
    if (nearby && !document.hidden) draw.schedule();
    else draw.cancel();
  };
  const proximity = new IntersectionObserver(
    ([entry]) => {
      nearby = !!entry?.isIntersecting;
      refresh();
    },
    { rootMargin: '500px 0px' },
  );
  const resize = new ResizeObserver(refresh);
  proximity.observe(element);
  resize.observe(element);
  const nextSection = element.parentElement?.querySelector('#selecao');
  if (nextSection) resize.observe(nextSection);
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', refresh);
  document.addEventListener('visibilitychange', refresh);
  reduced.addEventListener('change', refresh);
  refresh();
  return () => {
    draw.cancel();
    proximity.disconnect();
    resize.disconnect();
    window.removeEventListener('scroll', schedule);
    window.removeEventListener('resize', refresh);
    document.removeEventListener('visibilitychange', refresh);
    reduced.removeEventListener('change', refresh);
    delete element.dataset.motionActive;
  };
}
