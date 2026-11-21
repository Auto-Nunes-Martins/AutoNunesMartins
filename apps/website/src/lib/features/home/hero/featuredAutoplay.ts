import { hasKeyboardFocus } from './featuredKeyboardFocus';

type Options = { count: number; revision: number; ready: boolean; next: () => void };

/** One full viewing interval after entry, each selection and every return to the card. */
export function featuredAutoplay(node: HTMLElement, initial: Options) {
  let options = initial;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let visible = false;
  let entered = false;
  let introDone = false;
  let destroyed = false;
  const pointer = matchMedia('(hover: hover) and (pointer: fine)');
  let pointerInside = pointer.matches && node.matches(':hover');
  const cancel = () => {
    clearTimeout(timer);
    timer = undefined;
  };
  const sync = () => {
    if (destroyed) return;
    cancel();
    const image = node.querySelector<HTMLImageElement>('.hd-photo img');
    // An already visible image can be loaded while the next one is still decoding.
    // Wait for the requested entry to be displayed before starting its interval.
    const loaded = options.ready && !!image?.complete && image.naturalWidth > 0;
    const interacting = (pointer.matches && pointerInside) || hasKeyboardFocus(node);
    const paused = !visible || document.hidden || interacting;
    node.dataset.presentationReady = String(entered && loaded);
    node.dataset.presentationPaused = String(paused || !loaded || !entered);
    node.dataset.carouselEntered = String(introDone);
    node.dataset.carouselPaused = String(paused || !loaded || !introDone);
    if (options.count > 1 && entered && introDone && loaded && !paused) {
      timer = setTimeout(() => {
        timer = undefined;
        const bounds = node.getBoundingClientRect();
        if (
          !document.hidden &&
          bounds.bottom > 0 &&
          bounds.top < innerHeight &&
          !(pointer.matches && pointerInside) &&
          !hasKeyboardFocus(node)
        ) {
          options.next();
        } else {
          sync();
        }
      }, 4000);
    }
  };
  const afterInput = () => queueMicrotask(sync);
  const enter = (event: PointerEvent) => {
    pointerInside = event.pointerType !== 'touch' && pointer.matches;
    sync();
  };
  const leave = () => {
    pointerInside = false;
    sync();
  };
  const pointerChanged = () => {
    pointerInside = pointer.matches && node.matches(':hover');
    sync();
  };
  const observer = new IntersectionObserver(
    ([entry]) => {
      visible = !!entry?.isIntersecting && entry.intersectionRatio >= 0.5;
      sync();
    },
    { threshold: [0, 0.5] },
  );
  observer.observe(node);
  const entryAnimations = (element: Element | null) =>
    element
      ?.getAnimations()
      .filter(
        (animation) =>
          'animationName' in animation && animation.effect?.getComputedTiming().iterations === 1,
      ) ?? [];
  const cardEntries = entryAnimations(node);
  const sceneEntries = entryAnimations(
    node.closest('.hd-root')?.querySelector('.hd-landscape picture') ?? null,
  );
  const complete = (animations: Animation[]) =>
    Promise.all(animations.map((animation) => animation.finished.catch(() => {})));
  void complete(cardEntries).then(() => {
    entered = true;
    sync();
  });
  void complete([...cardEntries, ...sceneEntries]).then(() => {
    introDone = true;
    sync();
  });
  node.addEventListener('pointerenter', enter);
  node.addEventListener('pointerleave', leave);
  for (const event of ['focusin', 'focusout', 'keydown', 'pointerdown', 'load', 'error'])
    node.addEventListener(event, afterInput, true);
  document.addEventListener('visibilitychange', sync);
  pointer.addEventListener('change', pointerChanged);
  sync();
  return {
    update(next: Options) {
      options = next;
      sync();
    },
    destroy() {
      destroyed = true;
      cancel();
      observer.disconnect();
      node.removeEventListener('pointerenter', enter);
      node.removeEventListener('pointerleave', leave);
      for (const event of ['focusin', 'focusout', 'keydown', 'pointerdown', 'load', 'error'])
        node.removeEventListener(event, afterInput, true);
      document.removeEventListener('visibilitychange', sync);
      pointer.removeEventListener('change', pointerChanged);
    },
  };
}
