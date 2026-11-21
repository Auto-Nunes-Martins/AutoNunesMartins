/** Visibility events only; CSS owns the indicator's movement. */
export function scrollCue(node: HTMLElement) {
  let visible = false;
  const sync = () => {
    node.dataset.cuePaused = String(!visible || document.hidden);
  };
  const observer = new IntersectionObserver(([entry]) => {
    visible = !!entry?.isIntersecting;
    sync();
  });
  observer.observe(node);
  document.addEventListener('visibilitychange', sync);
  sync();
  return {
    destroy() {
      observer.disconnect();
      document.removeEventListener('visibilitychange', sync);
    },
  };
}
