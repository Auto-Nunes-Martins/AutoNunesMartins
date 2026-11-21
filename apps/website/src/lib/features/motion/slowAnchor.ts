export type AnchorScrollProfile = 'default' | 'discovery' | 'discovery-return';
export type AnchorArrival = { offset?: number; keyboard?: boolean };

/** Shared, interruptible anchor movement; never changes global scroll behavior. */
export function createAnchorScroller() {
  let frame = 0;
  let removeFocusTarget: (() => void) | undefined;
  const events = ['wheel', 'touchstart', 'pointerdown', 'keydown', 'popstate'] as const;
  const stop = () => {
    cancelAnimationFrame(frame);
    frame = 0;
    events.forEach((event) => window.removeEventListener(event, stop));
  };
  const scroll = (
    target: HTMLElement,
    profile: AnchorScrollProfile = 'default',
    arrival: AnchorArrival = {},
  ) => {
    stop();
    removeFocusTarget?.();
    const start = window.scrollY;
    const destination = () => {
      const header = document.querySelector<HTMLElement>('.design header');
      const rect = header?.getBoundingClientRect();
      const visibleHeader = rect && rect.top <= 1 && rect.bottom > 0 ? rect.bottom + 20 : 0;
      const margin = Math.max(
        parseFloat(getComputedStyle(target).scrollMarginTop) || 0,
        visibleHeader,
      );
      return Math.max(
        0,
        Math.min(
          window.scrollY + target.getBoundingClientRect().top - margin + (arrival.offset ?? 0),
          document.documentElement.scrollHeight - window.innerHeight,
        ),
      );
    };
    const finish = () => {
      stop();
      const addedTabindex = !target.hasAttribute('tabindex');
      if (addedTabindex) {
        target.setAttribute('tabindex', '-1');
      }
      const keyboard = () => target.removeAttribute('data-anchor-pointer-focus');
      const cleanup = () => {
        if (addedTabindex) target.removeAttribute('tabindex');
        target.removeAttribute('data-anchor-pointer-focus');
        window.removeEventListener('keydown', keyboard, true);
        target.removeEventListener('blur', cleanup);
        removeFocusTarget = undefined;
      };
      if (arrival.keyboard === false) {
        target.setAttribute('data-anchor-pointer-focus', '');
        window.addEventListener('keydown', keyboard, { once: true, capture: true });
      }
      removeFocusTarget = cleanup;
      target.addEventListener('blur', cleanup);
      target.focus({ preventScroll: true });
    };
    if (
      window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
      Math.abs(destination() - start) < 1
    ) {
      window.scrollTo({ top: destination(), behavior: 'instant' });
      finish();
      return;
    }
    events.forEach((event) => window.addEventListener(event, stop, { passive: true }));
    const began = performance.now();
    // Discovery keeps one measured destination; reveal effects cannot pull the trip around.
    const fixedEnd = profile === 'default' ? undefined : destination();
    const duration =
      profile === 'discovery'
        ? 1200
        : fixedEnd === undefined
          ? 800
          : Math.min(2400, Math.max(1000, 650 + Math.sqrt(Math.abs(fixedEnd - start)) * 22));
    const step = (now: number) => {
      if (!target.isConnected) {
        stop();
        return;
      }
      const progress = Math.min(1, (now - began) / duration);
      const eased =
        profile === 'discovery'
          ? // Continuous acceleration at the middle and a quiet start/arrival.
            progress ** 3 * (progress * (progress * 6 - 15) + 10)
          : progress < 0.5
            ? 4 * progress ** 3
            : 1 - (-2 * progress + 2) ** 3 / 2;
      window.scrollTo({
        top: start + ((fixedEnd ?? destination()) - start) * eased,
        behavior: 'instant',
      });
      if (progress < 1) frame = requestAnimationFrame(step);
      else finish();
    };
    frame = requestAnimationFrame(step);
  };
  return {
    scroll,
    stop,
    destroy() {
      stop();
      removeFocusTarget?.();
    },
  };
}

export function anchorTarget(hash: string): HTMLElement | null {
  try {
    return hash.length > 1 ? document.getElementById(decodeURIComponent(hash.slice(1))) : null;
  } catch {
    return null;
  }
}

export function internalAnchor(
  event: MouseEvent,
  link: HTMLAnchorElement,
  current: URL,
): URL | null {
  if (
    event.defaultPrevented ||
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey ||
    link.hasAttribute('download') ||
    (link.target && link.target !== '_self')
  )
    return null;
  const url = new URL(link.href, current);
  return url.origin === current.origin && url.hash.length > 1 && /^https?:$/.test(url.protocol)
    ? url
    : null;
}

/** Small adapter for isolated consumers; the public site uses one delegated controller. */
export function slowAnchor(node: HTMLAnchorElement, recordHistory: (url: URL) => void) {
  const scroller = createAnchorScroller();
  const click = (event: MouseEvent) => {
    const url = internalAnchor(event, node, new URL(location.href));
    if (!url || url.pathname !== location.pathname || url.search !== location.search) return;
    const target = anchorTarget(url.hash);
    if (!target) return;
    event.preventDefault();
    if (url.hash !== location.hash) recordHistory(url);
    scroller.scroll(target);
  };
  node.addEventListener('click', click);
  return {
    update(next: (url: URL) => void) {
      recordHistory = next;
    },
    destroy() {
      scroller.destroy();
      node.removeEventListener('click', click);
    },
  };
}
