type Position = { index: number; count: number };

/** Move one contiguous transform-only strip; interrupted selections start at the current pose. */
export function photoRail(node: HTMLElement, initial: Position) {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let selected = initial.index;
  let animation: Animation | undefined;
  let alive = true;
  let width = node.clientWidth;
  const position = (index: number) => `translate3d(${-index * 100}%, 0, 0)`;
  const stop = () => {
    animation?.cancel();
    animation = undefined;
    node.style.transform = position(selected);
    node.dataset.moving = 'false';
  };
  const motionChanged = () => {
    if (reduced.matches) stop();
  };
  const resize = new ResizeObserver(([entry]) => {
    const next = entry?.contentRect.width ?? node.clientWidth;
    if (Math.abs(next - width) > 0.5) {
      width = next;
      stop();
    }
  });
  resize.observe(node);
  reduced.addEventListener('change', motionChanged);
  stop();
  return {
    update(next: Position) {
      const target = Math.max(0, Math.min(next.count - 1, next.index));
      if (target === selected) return;
      const distance = Math.abs(target - selected);
      const from = animation ? getComputedStyle(node).transform : position(selected);
      animation?.cancel();
      selected = target;
      node.style.transform = position(selected);
      if (reduced.matches) {
        animation = undefined;
        node.dataset.moving = 'false';
        return;
      }
      const move = node.animate([{ transform: from }, { transform: position(selected) }], {
        duration: Math.min(1400, 360 + Math.max(0, distance - 1) * 120),
        easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
      });
      animation = move;
      node.dataset.moving = 'true';
      void move.finished
        .catch(() => {})
        .then(() => {
          if (alive && animation === move) {
            animation = undefined;
            node.dataset.moving = 'false';
          }
        });
    },
    destroy() {
      alive = false;
      animation?.cancel();
      resize.disconnect();
      reduced.removeEventListener('change', motionChanged);
    },
  };
}
