/** Independent idle plane: never replaces the feature's entry or chosen hover. */
export function hoveringCard(node: HTMLElement, enabled: boolean) {
  if (!enabled) return;
  const motion = matchMedia(
    '(min-width: 701px) and (hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)',
  );
  let entered = node.getAnimations().some((a) => a.effect?.getComputedTiming().progress === 1);
  let visible = false;
  let started = false;
  const hoverTargets = [...node.querySelectorAll<HTMLElement>('.hd-photo-stage, .hd-price-motion')];
  const update = () => {
    const photo = node.querySelector<HTMLImageElement>('.hd-photo img');
    const ready =
      (entered || node.dataset.carouselEntered === 'true') && visible &&
      !!photo?.complete && photo.naturalWidth > 0 && motion.matches;
    if (ready && !started) {
      started = true;
      node.dataset.idleReady = 'true';
    }
    node.dataset.idlePaused = String(
      !ready || document.hidden || hoverTargets.some((target) => target.matches(':hover')) ||
      !!node.querySelector('.hd-photo:focus-visible'),
    );
  };
  const afterFocus = () => queueMicrotask(update);
  const finished = (event: AnimationEvent) => {
    if (event.target === node) {
      entered = true;
      update();
    }
  };
  const observer = new IntersectionObserver(
    ([entry]) => {
      visible = (entry?.intersectionRatio ?? 0) >= 0.99;
      update();
    },
    { threshold: [0, 0.99, 1] },
  );
  observer.observe(node);
  node.addEventListener('animationend', finished);
  node.addEventListener('load', update, true);
  for (const event of ['pointerenter', 'pointerleave'])
    for (const target of hoverTargets) target.addEventListener(event, update);
  for (const event of ['focusin', 'focusout', 'keydown', 'pointerdown'])
    node.addEventListener(event, afterFocus);
  document.addEventListener('visibilitychange', update);
  motion.addEventListener('change', update);
  update();
  return {
    destroy() {
      observer.disconnect();
      node.removeEventListener('animationend', finished);
      node.removeEventListener('load', update, true);
      for (const event of ['pointerenter', 'pointerleave'])
        for (const target of hoverTargets) target.removeEventListener(event, update);
      for (const event of ['focusin', 'focusout', 'keydown', 'pointerdown'])
        node.removeEventListener(event, afterFocus);
      document.removeEventListener('visibilitychange', update);
      motion.removeEventListener('change', update);
    },
  };
}
