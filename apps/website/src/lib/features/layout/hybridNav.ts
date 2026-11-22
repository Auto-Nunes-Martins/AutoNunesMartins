import { scrollFrame, setScrollStyle } from '../motion/scrollFrame';

type Options = { enabled: boolean; open: boolean; close: () => void };

/** Finish arriving when the hero leaves the viewport. Keep startup JS in sync. */
export function compactNavProgress(scrollY: number, heroBottom: number, viewportHeight: number) {
  const distance = Math.max(100, Math.min(180, viewportHeight * 0.18));
  const start = Math.max(100, heroBottom - distance);
  return {
    pinned: scrollY >= start,
    progress: Math.max(0, Math.min(1, (scrollY - start) / distance)),
  };
}

/** One navigation instance and a reserved original slot; no time-based scroll animation. */
export function hybridNav(header: HTMLElement, initial: Options) {
  let options = initial;
  const root = header.parentElement!;
  let heroBottom: number | undefined;
  let lastPinned: boolean | undefined;
  let lastProgress: number | undefined;
  const reset = () => {
    lastPinned = undefined;
    lastProgress = undefined;
    root.classList.remove('nav-pinned', 'nav-hidden');
    header.style.removeProperty('--nav-progress');
    header.inert = false;
    header.removeAttribute('aria-hidden');
  };
  const draw = () => {
    if (!options.enabled) {
      return reset;
    }
    const y = Math.max(0, window.scrollY);
    // The header cannot pin in the first 100px, regardless of the hero's height.
    if (y >= 100 && heroBottom === undefined) {
      const hero = root.querySelector<HTMLElement>('.home-hero, .site-intro');
      if (!hero) return reset;
      heroBottom = hero.getBoundingClientRect().bottom + y;
    }
    const state = compactNavProgress(y, heroBottom ?? 0, innerHeight);
    // Never fade a menu or a keyboard target out from under its current user.
    const wasPinned = y > 100 && root.classList.contains('nav-pinned');
    const engaged =
      state.progress < 1 &&
      (state.pinned || wasPinned) &&
      (options.open || !!header.querySelector(':focus-visible'));
    const pinned = state.pinned || (wasPinned && engaged);
    const progress = pinned && engaged ? 1 : state.progress;
    if (pinned === lastPinned && progress === lastProgress) return;
    return () => {
      lastPinned = pinned;
      lastProgress = progress;
      root.classList.toggle('nav-pinned', pinned);
      root.classList.remove('nav-hidden');
      setScrollStyle(header, '--nav-progress', String(progress));
      const invisible = pinned && progress <= 0;
      header.inert = invisible;
      if (invisible) header.setAttribute('aria-hidden', 'true');
      else header.removeAttribute('aria-hidden');
    };
  };
  const task = scrollFrame(draw);
  const schedule = () => {
    task.schedule();
  };
  const measure = () => {
    heroBottom = undefined;
    schedule();
  };
  const keydown = (event: KeyboardEvent) => {
    if (event.key === 'Escape' && options.open) {
      options.close();
      header.querySelector<HTMLButtonElement>('.mobile-menu')?.focus();
    }
  };
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', measure);
  window.addEventListener('pageshow', measure);
  header.addEventListener('focusin', schedule);
  header.addEventListener('focusout', schedule);
  header.addEventListener('keydown', keydown);
  const resize = new ResizeObserver(measure);
  resize.observe(root);
  resize.observe(header);
  const hero = root.querySelector('.home-hero, .site-intro');
  if (hero) resize.observe(hero);
  task.runNow(performance.now());
  return {
    update(next: Options) {
      options = next;
      measure();
    },
    destroy() {
      task.cancel();
      resize.disconnect();
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', measure);
      window.removeEventListener('pageshow', measure);
      header.removeEventListener('focusin', schedule);
      header.removeEventListener('focusout', schedule);
      header.removeEventListener('keydown', keydown);
      reset();
    },
  };
}
