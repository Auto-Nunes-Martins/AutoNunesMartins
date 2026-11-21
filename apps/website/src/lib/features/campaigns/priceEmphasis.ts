const photoPulse = [
  { scale: 1, easing: 'ease-in-out' },
  { scale: 1.018, offset: 0.5, easing: 'ease-in-out' },
  { scale: 1 },
];
const photoPulseTiming = { duration: 580 };
const priceEasing = 'cubic-bezier(0.28, 0, 0.72, 1)';

/** The price pulse runs independently of the resting font size and the photo. */
export function priceEmphasis(node: HTMLElement, initialVehicle?: string) {
  if (initialVehicle === undefined) return;
  const feature = node.closest<HTMLElement>('.hd-feature');
  const slot = node.parentElement;
  if (!feature || !slot) return;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const pointer = matchMedia('(hover: hover) and (pointer: fine)');
  const mobile = matchMedia('(max-width: 700px)');
  const hoverTargets = [...feature.querySelectorAll<HTMLElement>('.hd-photo, .hd-price-motion')];
  let pointerInside = pointer.matches && hoverTargets.some((target) => target.matches(':hover'));
  let visible = false;
  let entered = feature.dataset.carouselEntered === 'true';
  let destroyed = false;
  let target = 1;
  let base = parseFloat(getComputedStyle(slot).fontSize);
  let vehicle = initialVehicle;
  let animation: Animation | undefined;
  let pricePulse: Animation | undefined;
  let photoAnimation: Animation | undefined;
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
    const resting = { transform: 'scale(1)', color: '#fafafa', textShadow: 'none' };
    const current = pricePulse?.playState === 'running' ? getComputedStyle(node) : resting;
    const { transform, color, textShadow } = current;
    pricePulse?.cancel();
    pricePulse = node.animate(
      [
        { transform, color, textShadow, easing: priceEasing },
        {
          transform: 'scale(1.07)',
          color: '#ffeac0',
          textShadow: '0 0 6px #ffc35d52',
          offset: 0.43,
          easing: priceEasing,
        },
        resting,
      ],
      { delay: 95, duration: 680, fill: 'backwards' },
    );
    pricePulse.id = 'price-vehicle-change';
    if (mobile.matches) {
      const photo = feature.querySelector<HTMLElement>('.hd-photo-motion');
      const fromTransform =
        photo && photoAnimation?.playState === 'running'
          ? getComputedStyle(photo).transform
          : 'scale(1)';
      photoAnimation?.cancel();
      photoAnimation = photo?.animate(
        photoPulse.map(({ scale, ...timing }, index) => ({
          ...timing,
          transform: index === 0 ? fromTransform : `scale(${scale})`,
        })),
        photoPulseTiming,
      );
      if (photoAnimation) photoAnimation.id = 'photo-vehicle-change';
    }
  };
  const sync = () => {
    if (destroyed) return;
    const allowed = canAnimate();
    if (!allowed) {
      pricePulse?.cancel();
      pricePulse = undefined;
    }
    if (!allowed || !mobile.matches) {
      photoAnimation?.cancel();
      photoAnimation = undefined;
    }
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
  mobile.addEventListener('change', sync);
  sync();
  return {
    update(nextVehicle?: string) {
      if (destroyed || nextVehicle === undefined || nextVehicle === vehicle) return;
      vehicle = nextVehicle;
      sync();
      pulse();
    },
    destroy() {
      destroyed = true;
      animation?.cancel();
      pricePulse?.cancel();
      photoAnimation?.cancel();
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
      mobile.removeEventListener('change', sync);
      node.style.fontSize = originalSize;
    },
  };
}
