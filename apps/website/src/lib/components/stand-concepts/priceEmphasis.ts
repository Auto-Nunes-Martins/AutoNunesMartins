/** One pulse per displayed vehicle change; font sizing keeps glyphs crisp. */
export function priceEmphasis(node: HTMLElement, initialVehicle: string) {
  const feature = node.closest<HTMLElement>('.hd-feature');
  const slot = node.parentElement;
  if (!feature || !slot) return;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const pointer = matchMedia('(hover: hover) and (pointer: fine)');
  const hoverTargets = [...feature.querySelectorAll<HTMLElement>('.hd-photo, .hd-price-motion')];
  let pointerInside = pointer.matches && hoverTargets.some((target) => target.matches(':hover'));
  let visible = false;
  let entered = feature.dataset.carouselEntered === 'true';
  let destroyed = false;
  let target = 1;
  let base = parseFloat(getComputedStyle(slot).fontSize);
  let vehicle = initialVehicle;
  let animation: Animation | undefined;
  const originalSize = node.style.fontSize;
  const canAnimate = () => {
    const bounds = feature.getBoundingClientRect();
    return (
      entered &&
      visible &&
      !document.hidden &&
      !reduced.matches &&
      bounds.bottom > 0 &&
      bounds.top < innerHeight
    );
  };
  const interacting = () =>
    (pointer.matches && pointerInside) || !!feature.querySelector('.hd-photo:focus-visible');
  const remember = (next: Animation) => {
    animation = next;
    void next.finished
      .then(() => {
        if (animation === next) animation = undefined;
      })
      .catch(() => undefined);
  };
  const setSize = (scale: number, duration: number) => {
    const current = getComputedStyle(node).fontSize;
    animation?.cancel();
    animation = undefined;
    node.style.fontSize = `${base * scale}px`;
    target = scale;
    if (duration) {
      const next = node.animate([{ fontSize: current }, { fontSize: node.style.fontSize }], {
        duration,
        easing: 'cubic-bezier(0.2, 0.65, 0.3, 1)',
      });
      next.id = 'price-interaction';
      remember(next);
    }
  };
  const pulse = () => {
    if (!canAnimate()) return;
    animation?.cancel();
    const resting = base * target;
    const next = node.animate(
      [
        { fontSize: `${resting}px`, easing: 'cubic-bezier(0.2, 0.65, 0.3, 1)' },
        {
          fontSize: `${resting * 1.06}px`,
          offset: 0.32,
          easing: 'cubic-bezier(0.25, 0.1, 0.25, 1)',
        },
        { fontSize: `${resting}px` },
      ],
      { duration: 650 },
    );
    next.id = 'price-vehicle-change';
    remember(next);
  };
  const sync = () => {
    if (destroyed) return;
    const allowed = canAnimate();
    const active = allowed && interacting();
    const next = active ? 1.045 : 1;
    if (!allowed || target !== next) setSize(next, allowed ? (active ? 220 : 260) : 0);
  };
  const afterInput = () => queueMicrotask(sync);
  const enter = (event: PointerEvent) => {
    pointerInside = pointer.matches && event.pointerType !== 'touch';
    sync();
  };
  const leave = () => {
    pointerInside = false;
    sync();
  };
  const observer = new IntersectionObserver(
    ([entry]) => {
      visible = !!entry?.isIntersecting && entry.intersectionRatio >= 0.5;
      sync();
    },
    { threshold: [0, 0.5] },
  );
  const resize = new ResizeObserver(() => {
    const size = parseFloat(getComputedStyle(slot).fontSize);
    if (Math.abs(size - base) > 0.01) {
      base = size;
      setSize(target, 0);
    }
  });
  const intro = new MutationObserver(() => {
    if (feature.dataset.carouselEntered === 'true') {
      entered = true;
      intro.disconnect();
      sync();
    }
  });
  observer.observe(feature);
  resize.observe(slot);
  if (!entered)
    intro.observe(feature, { attributes: true, attributeFilter: ['data-carousel-entered'] });
  for (const target of hoverTargets) {
    target.addEventListener('pointerenter', enter);
    target.addEventListener('pointerleave', leave);
  }
  for (const event of ['focusin', 'focusout', 'keydown', 'pointerdown'])
    feature.addEventListener(event, afterInput);
  document.addEventListener('visibilitychange', sync);
  reduced.addEventListener('change', sync);
  pointer.addEventListener('change', sync);
  sync();
  return {
    update(nextVehicle: string) {
      if (destroyed || nextVehicle === vehicle) return;
      vehicle = nextVehicle;
      sync();
      pulse();
    },
    destroy() {
      destroyed = true;
      animation?.cancel();
      observer.disconnect();
      resize.disconnect();
      intro.disconnect();
      for (const target of hoverTargets) {
        target.removeEventListener('pointerenter', enter);
        target.removeEventListener('pointerleave', leave);
      }
      for (const event of ['focusin', 'focusout', 'keydown', 'pointerdown'])
        feature.removeEventListener(event, afterInput);
      document.removeEventListener('visibilitychange', sync);
      reduced.removeEventListener('change', sync);
      pointer.removeEventListener('change', sync);
      node.style.fontSize = originalSize;
    },
  };
}
