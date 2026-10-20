const unit = (value: number) => Math.min(1, Math.max(0, value));

/** V2's preserved unpinned timing. Deliberately independent of V1 scrollTiming. */
export function v2HeroProgress(
  top: number,
  documentTop: number,
  stageHeight: number,
  viewport: number,
) {
  const resting = unit(
    (Math.max(0, (viewport - stageHeight) / 2) - documentTop) / Math.max(1, viewport * 0.04),
  );
  const travel = Math.max(1, Math.min(stageHeight * 0.75, viewport * 0.6));
  return resting + (1 - resting) * unit((documentTop - top) / travel);
}

export function v2AccentFrame(
  top: number,
  height: number,
  stageTop: number,
  stageHeight: number,
  viewport: number,
  scroll = 0,
) {
  const range = Math.max(0, height - stageHeight);
  const pinTop = Math.max(0, (viewport - stageHeight) / 2);
  const documentTop = top + scroll;
  const travel = Math.min(range, Math.max(0, pinTop - documentTop));
  return {
    shift: top + travel - stageTop,
    progress: range > 1 ? unit((pinTop - documentTop) / range) : 0,
  };
}

/** Own listeners, state and variables; no V1 data-scene/bootstrap/motion hooks. */
export function homeHeroV2Motion(root: HTMLElement) {
  const scene = root.querySelector<HTMLElement>('.v2-orbit-intro')!;
  const stage = root.querySelector<HTMLElement>('.v2-orbit-stage')!;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const pointer = matchMedia('(hover: hover) and (pointer: fine)');
  let frame = 0,
    lastTime = 0,
    previous: number | undefined;
  let targetX = 0,
    targetY = 0,
    x = 0,
    y = 0;
  function schedule() {
    if (!frame && !document.hidden) frame = requestAnimationFrame(draw);
  }
  function draw(time: number) {
    frame = 0;
    if (reduced.matches || document.hidden) return;
    const elapsed = lastTime ? Math.min(50, time - lastTime) : 16;
    lastTime = time;
    const damping = 1 - Math.exp(-elapsed / 105);
    let settling = false;
    const bounds = scene.getBoundingClientRect(),
      hero = stage.getBoundingClientRect(),
      viewport = innerHeight;
    if (bounds.bottom >= -50 && bounds.top <= viewport + 50) {
      const target = v2HeroProgress(bounds.top, bounds.top + scrollY, hero.height, viewport);
      const difference = target - (previous ?? target);
      const value =
        Math.abs(difference) > 0.65 || Math.abs(difference) < 0.0005
          ? target
          : (previous ?? target) + difference * damping;
      previous = value;
      scene.style.setProperty('--v2-p', String(value));
      if (Math.abs(target - value) > 0.0005) settling = true;
      const wide = innerWidth > 1050;
      const accent = v2AccentFrame(
        bounds.top,
        bounds.height,
        hero.top,
        hero.height,
        viewport,
        wide ? scrollY : 0,
      );
      const prior = Number.parseFloat(scene.style.getPropertyValue('--v2-accent-progress'));
      const delta = accent.progress - prior;
      const progress =
        wide || !Number.isFinite(prior) || Math.abs(delta) > 0.65 || Math.abs(delta) < 0.0005
          ? accent.progress
          : prior + delta * damping;
      scene.style.setProperty('--v2-accent-stage-shift', `${accent.shift}px`);
      scene.style.setProperty('--v2-accent-progress', String(progress));
      if (Math.abs(accent.progress - progress) > 0.0005) settling = true;
    }
    x += (targetX - x) * 0.09;
    y += (targetY - y) * 0.09;
    root.style.setProperty('--v2-mx', String(x));
    root.style.setProperty('--v2-my', String(y));
    if (settling || Math.abs(targetX - x) + Math.abs(targetY - y) > 0.002) schedule();
  }
  function move(event: PointerEvent) {
    if (!pointer.matches || reduced.matches || event.clientY > innerHeight) return;
    targetX = event.clientX / innerWidth - 0.5;
    targetY = event.clientY / innerHeight - 0.5;
    schedule();
  }
  function leave() {
    targetX = targetY = 0;
    schedule();
  }
  function configure() {
    previous = undefined;
    lastTime = 0;
    root.classList.toggle('hero-v2-motion', !reduced.matches);
    cancelAnimationFrame(frame);
    frame = 0;
    draw(performance.now());
  }
  function visibility() {
    cancelAnimationFrame(frame);
    frame = 0;
    lastTime = 0;
    if (!document.hidden) schedule();
  }
  const resize = new ResizeObserver(schedule);
  resize.observe(scene);
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule);
  window.addEventListener('pointermove', move, { passive: true });
  document.documentElement.addEventListener('pointerleave', leave);
  document.addEventListener('visibilitychange', visibility);
  reduced.addEventListener('change', configure);
  configure();
  return {
    destroy() {
      cancelAnimationFrame(frame);
      resize.disconnect();
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      window.removeEventListener('pointermove', move);
      document.documentElement.removeEventListener('pointerleave', leave);
      document.removeEventListener('visibilitychange', visibility);
      reduced.removeEventListener('change', configure);
    },
  };
}
