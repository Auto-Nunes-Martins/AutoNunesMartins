/** Slow, seamless mobile passage with native touch scrolling and explicit interaction pauses. */
export function brandMarquee(node: HTMLElement, initial = { paused: false }) {
  const primary = node.querySelector<HTMLElement>('[data-brand-primary]');
  if (!primary) return;
  const mobile = matchMedia('(max-width: 700px)');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let visible = false,
    hovered = false,
    touching = false,
    resting = false,
    alive = true;
  let paused = initial.paused;
  let period = 0,
    frame = 0,
    previousTime = 0,
    position = 0;
  let restTimer: ReturnType<typeof setTimeout> | undefined;
  const canRun = () =>
    alive &&
    !paused &&
    visible &&
    !document.hidden &&
    mobile.matches &&
    !reduced.matches &&
    period > node.clientWidth + 1 &&
    !hovered &&
    !touching &&
    !resting &&
    !node.contains(document.activeElement);
  function stop() {
    cancelAnimationFrame(frame);
    frame = 0;
    previousTime = 0;
  }
  function step(time: number) {
    frame = 0;
    if (!canRun()) {
      previousTime = 0;
      return;
    }
    const elapsed = previousTime ? Math.min(64, time - previousTime) : 0;
    previousTime = time;
    position = (position + elapsed * 0.022) % period;
    node.scrollLeft = position;
    frame = requestAnimationFrame(step);
  }
  function refresh() {
    if (!alive) return;
    node.dataset.brandLoop = String(
      mobile.matches && !reduced.matches && period > node.clientWidth + 1,
    );
    if (!canRun()) {
      stop();
      return;
    }
    if (!frame) {
      position = node.scrollLeft % period;
      node.scrollLeft = position;
      frame = requestAnimationFrame(step);
    }
  }
  function measure() {
    period = primary!.getBoundingClientRect().width;
    node.dataset.brandLoop = String(
      mobile.matches && !reduced.matches && period > node.clientWidth + 1,
    );
    refresh();
  }
  function rest() {
    resting = true;
    stop();
    clearTimeout(restTimer);
    restTimer = setTimeout(() => {
      resting = false;
      refresh();
    }, 3200);
  }
  const down = () => {
    touching = true;
    stop();
  };
  const up = () => {
    if (touching) {
      touching = false;
      rest();
    }
  };
  const enter = (event: PointerEvent) => {
    if (event.pointerType === 'mouse') {
      hovered = true;
      stop();
    }
  };
  const leave = () => {
    hovered = false;
    refresh();
  };
  const focusOut = () => queueMicrotask(refresh);
  const observer = new IntersectionObserver(([entry]) => {
    visible = !!entry?.isIntersecting;
    refresh();
  });
  const resize = new ResizeObserver(measure);
  observer.observe(node);
  resize.observe(node);
  resize.observe(primary);
  mobile.addEventListener('change', measure);
  reduced.addEventListener('change', measure);
  document.addEventListener('visibilitychange', refresh);
  node.addEventListener('pointerdown', down);
  window.addEventListener('pointerup', up);
  window.addEventListener('pointercancel', up);
  node.addEventListener('pointerenter', enter);
  node.addEventListener('pointerleave', leave);
  node.addEventListener('wheel', rest, { passive: true });
  node.addEventListener('focusin', refresh);
  node.addEventListener('focusout', focusOut);
  measure();
  return {
    update(next: { paused: boolean }) {
      paused = next.paused;
      refresh();
    },
    destroy() {
      alive = false;
      stop();
      clearTimeout(restTimer);
      observer.disconnect();
      resize.disconnect();
      mobile.removeEventListener('change', measure);
      reduced.removeEventListener('change', measure);
      document.removeEventListener('visibilitychange', refresh);
      node.removeEventListener('pointerdown', down);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      node.removeEventListener('pointerenter', enter);
      node.removeEventListener('pointerleave', leave);
      node.removeEventListener('wheel', rest);
      node.removeEventListener('focusin', refresh);
      node.removeEventListener('focusout', focusOut);
      delete node.dataset.brandLoop;
    },
  };
}
