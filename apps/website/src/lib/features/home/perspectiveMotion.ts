import { scrollFrame, setScrollStyle } from '../motion/scrollFrame';

export function perspectiveMotion(section: HTMLElement, requireScroll = false) {
  const heading = section.querySelector('h2')!;
  const underline = section.querySelector('em')!;
  const lineWindow = section.querySelector<HTMLElement>('.line-window')!;
  const fragments = [...section.querySelectorAll<HTMLElement>('.read-a, .read-b, em')];
  const underlineIndex = fragments.indexOf(underline);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let nearby = false;
  let settledEndpoint: number | undefined;
  let geometry:
    | {
        width: number;
        height: number;
        line: DOMRect;
        fragments: DOMRect[];
      }
    | undefined;
  const smooth = (value: number) => {
    const p = Math.min(1, Math.max(0, value));
    return p * p * (3 - 2 * p);
  };
  const draw = scrollFrame(() => {
    if (reduced.matches || !nearby || document.hidden) return;
    const bounds = heading.getBoundingClientRect();
    // Keep the line's original timing; only the text light trails by 25px of scroll.
    const viewportJourney = (innerHeight * 0.92 - bounds.top) / (innerHeight * 0.84);
    const journey = requireScroll
      ? Math.min(viewportJourney, Math.max(0, window.scrollY) / (innerHeight * 0.84))
      : viewportJourney;
    const progress = smooth(journey);
    // Keep the same trailing-light timing on touch screens and desktop.
    const lightProgress = smooth(journey - 25 / (innerHeight * 0.84));
    const endpoint =
      progress === lightProgress && (progress === 0 || progress === 1) ? progress : undefined;
    // Once both effects are invisible, only the heading position can bring them back.
    if (endpoint !== undefined && endpoint === settledEndpoint) return;
    // These headings translate with the document; their internal layout does not
    // animate. Reuse that layout through scrolling, invalidating for wrapping,
    // fonts or content changes. Only one viewport measurement is needed per frame.
    if (!geometry || geometry.width !== bounds.width || geometry.height !== bounds.height) {
      geometry = {
        width: bounds.width,
        height: bounds.height,
        line: lineWindow.getBoundingClientRect(),
        fragments: fragments.map((fragment) => fragment.getBoundingClientRect()),
      };
    }
    // Only offsets inside the heading are used below: scroll translates the
    // line and all fragments by the same amount, so their differences stay exact.
    const { line, fragments: rects } = geometry;
    const light = smooth(lightProgress / 0.3) * (1 - smooth((lightProgress - 0.72) / 0.28));
    const segmentStart = line.left + Math.max(0, lightProgress * 2 - 1) * line.width;
    const segmentEnd = line.left + Math.min(1, lightProgress * 2) * line.width;
    const accent = smooth((segmentEnd - segmentStart) / 20);
    const textLeft = rects[underlineIndex]!.left;
    return () => {
      heading.classList.toggle('light-active', endpoint === undefined);
      settledEndpoint = endpoint;
      setScrollStyle(underline, '--segment-start', `${segmentStart - textLeft}px`);
      setScrollStyle(underline, '--segment-end', `${segmentEnd - textLeft}px`);
      setScrollStyle(
        underline,
        '--light-inset',
        `${Math.min(24, (segmentEnd - segmentStart) / 2)}px`,
      );
      // The tip crosses the text at halfway, then keeps travelling beyond its
      // right edge. A fixed window clips the trailing segment.
      const x = line.left + line.width * lightProgress * 2;
      const y = line.bottom + line.height * 0.08;
      setScrollStyle(heading, '--line-progress', String(progress));
      setScrollStyle(
        lineWindow,
        '--line-visible',
        Math.min(progress, 1 - progress) * 2 * line.width > 0.5 ? '0.95' : '0',
      );
      setScrollStyle(heading, '--line-light', String(light));
      setScrollStyle(heading, '--accent-light', String(accent));
      fragments.forEach((fragment, index) => {
        const lightX = fragment === underline ? Math.min(x, line.right) : x;
        setScrollStyle(fragment, '--tip-x', `${lightX - rects[index]!.left}px`);
        setScrollStyle(fragment, '--tip-y', `${y - rects[index]!.top}px`);
      });
    };
  });
  const schedule = () => {
    if (nearby && !document.hidden && !reduced.matches) draw.schedule();
    else draw.cancel();
  };
  // Editorial text need not force style/layout on every distant scroll.
  // Activate before it can be seen so the existing light is already in place.
  const proximity = new IntersectionObserver(
    ([entry]) => {
      nearby = !!entry?.isIntersecting;
      if (nearby) schedule();
      else draw.cancel();
    },
    { rootMargin: '400px 0px' },
  );
  proximity.observe(heading);
  const remeasure = () => {
    settledEndpoint = undefined;
    geometry = undefined;
    schedule();
  };
  const resize = new ResizeObserver(remeasure);
  resize.observe(heading);
  const content = new MutationObserver(remeasure);
  content.observe(heading, { childList: true, characterData: true, subtree: true });
  document.fonts?.addEventListener('loadingdone', remeasure);
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', remeasure);
  document.addEventListener('visibilitychange', schedule);
  reduced.addEventListener('change', remeasure);
  draw.runNow(performance.now());
  return () => {
    draw.cancel();
    resize.disconnect();
    content.disconnect();
    document.fonts?.removeEventListener('loadingdone', remeasure);
    proximity.disconnect();
    window.removeEventListener('scroll', schedule);
    window.removeEventListener('resize', remeasure);
    document.removeEventListener('visibilitychange', schedule);
    reduced.removeEventListener('change', remeasure);
  };
}
