import { scrollFrame, setScrollStyle } from './scrollFrame';

export function perspectiveMotion(section: HTMLElement, grouped: boolean) {
  const heading = section.querySelector('h2')!;
  const underline = section.querySelector('em')!;
  const lineWindow = section.querySelector<HTMLElement>('.line-window')!;
  const fragments = [...section.querySelectorAll<HTMLElement>('.read-a, .read-b, em')];
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let nearby = !grouped;
  const smooth = (value: number) => {
    const p = Math.min(1, Math.max(0, value));
    return p * p * (3 - 2 * p);
  };
  const draw = scrollFrame(() => {
    if (reduced.matches || !nearby) return;
    const bounds = heading.getBoundingClientRect();
    const line = lineWindow.getBoundingClientRect();
    // Keep the line's original timing; only the text light trails by 25px of scroll.
    const journey = (innerHeight * 0.92 - bounds.top) / (innerHeight * 0.84);
    const progress = smooth(journey);
    const lightProgress = smooth(journey - 25 / (innerHeight * 0.84));
    const light = smooth(lightProgress / 0.3) * (1 - smooth((lightProgress - 0.72) / 0.28));
    const segmentStart = line.left + Math.max(0, lightProgress * 2 - 1) * line.width;
    const segmentEnd = line.left + Math.min(1, lightProgress * 2) * line.width;
    const accent = smooth((segmentEnd - segmentStart) / 20);
    const textLeft = underline.getBoundingClientRect().left;
    const rects = fragments.map((fragment) => fragment.getBoundingClientRect());
    return () => {
      setScrollStyle(underline, '--segment-start', `${segmentStart - textLeft}px`);
      setScrollStyle(underline, '--segment-end', `${segmentEnd - textLeft}px`);
      setScrollStyle(
        underline,
        '--light-inset',
        `${Math.min(24, (segmentEnd - segmentStart) / 2)}px`,
      );
      // The tip crosses the text at halfway, then keeps travelling beyond its
      // right edge. A fixed window clips the trailing segment; opacity stays 1.
      const x = line.left + line.width * lightProgress * 2;
      const y = line.bottom + line.height * 0.08;
      setScrollStyle(section, '--line-progress', String(progress));
      setScrollStyle(section, '--line-light', String(light));
      setScrollStyle(section, '--accent-light', String(accent));
      fragments.forEach((fragment, index) => {
        const lightX = fragment === underline ? Math.min(x, line.right) : x;
        setScrollStyle(fragment, '--tip-x', `${lightX - rects[index]!.left}px`);
        setScrollStyle(fragment, '--tip-y', `${y - rects[index]!.top}px`);
      });
    };
  });
  const schedule = () => {
    if (nearby) draw.schedule();
  };
  // The homepage phrase need not force style/layout on every distant scroll.
  // Activate before it can be seen so the existing light is already in place.
  const proximity = grouped ? new IntersectionObserver(([entry]) => {
    nearby = !!entry?.isIntersecting;
    if (nearby) schedule();
    else draw.cancel();
  }, { rootMargin: '400px 0px' }) : undefined;
  proximity?.observe(section);
  const resize = new ResizeObserver(schedule);
  resize.observe(heading);
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule);
  reduced.addEventListener('change', schedule);
  draw.runNow(performance.now());
  return () => {
    draw.cancel();
    resize.disconnect();
    proximity?.disconnect();
    window.removeEventListener('scroll', schedule);
    window.removeEventListener('resize', schedule);
    reduced.removeEventListener('change', schedule);
  };
}
