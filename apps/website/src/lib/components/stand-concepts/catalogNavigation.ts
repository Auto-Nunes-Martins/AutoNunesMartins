import { scrollFrame } from './scrollFrame';

type Options = { enabled: boolean; open: boolean; directional: boolean };

/** Share the home compact variant; only the catalog hides with scroll direction. */
export function catalogNavigation(header: HTMLElement, initial: Options) {
  let options = initial;
  const root = header.parentElement!;
  let previous = window.scrollY;
  let travel = 0;
  const show = () => header.classList.remove('catalog-nav-hidden');
  const draw = () => {
    if (!options.enabled) {
      const y = window.scrollY;
      return () => {
        previous = y;
        travel = 0;
        root.classList.remove('nav-compact');
        show();
      };
    }
    const y = Math.max(
      0,
      Math.min(window.scrollY, document.documentElement.scrollHeight - innerHeight),
    );
    const delta = y - previous;
    previous = y;
    const stripHeight = root.querySelector<HTMLElement>('.nav-contact-strip')?.offsetHeight ?? 0;
    const wasCompact = root.classList.contains('nav-compact');
    const compact = options.enabled && y > stripHeight + (wasCompact ? 0 : 2);
    const mustShow =
      !options.directional ||
      !matchMedia('(max-width: 1000px)').matches ||
      options.open ||
      y <= header.offsetHeight ||
      !!header.querySelector(':focus-visible');
    return () => {
      root.classList.toggle('nav-compact', compact);
      if (mustShow) {
        travel = 0;
        show();
        return;
      }
      if (delta && Math.sign(delta) !== Math.sign(travel)) travel = 0;
      travel += delta;
      if (travel >= 48) {
        header.classList.add('catalog-nav-hidden');
        travel = 0;
      }
      if (travel <= -20) {
        show();
        travel = 0;
      }
    };
  };
  const task = scrollFrame(draw);
  const schedule = () => task.schedule();
  const focus = () => {
    show();
    travel = 0;
  };
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule);
  header.addEventListener('focusin', focus);
  task.runNow(performance.now());
  return {
    update(next: Options) {
      options = next;
      schedule();
    },
    destroy() {
      task.cancel();
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      header.removeEventListener('focusin', focus);
      root.classList.remove('nav-compact');
      show();
    },
  };
}
