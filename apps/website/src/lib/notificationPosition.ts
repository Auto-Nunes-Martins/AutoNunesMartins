import { scrollFrame } from './components/stand-concepts/scrollFrame';

export function notificationPosition(active: () => boolean, update: (offset: number, limit: number) => void) {
  let header: Element | null = null;
  let lastOffset = -1, lastLimit = -1;
  const resize = new ResizeObserver(() => schedule());
  const task = scrollFrame(() => {
    if (!active()) return;
    const current = document.querySelector('.stand-header');
    if (current !== header) {
      resize.disconnect();
      header = current;
      if (header) resize.observe(header);
    }
    const offset = Math.max(16, Math.ceil((header?.getBoundingClientRect().bottom ?? 0) + 12));
    const budget = window.innerWidth <= 700 ? 150 : 100;
    const limit = Math.max(1, Math.min(4, Math.floor((window.innerHeight - offset - 44) / budget)));
    if (offset === lastOffset && limit === lastLimit) return;
    return () => { lastOffset = offset; lastLimit = limit; update(offset, limit); };
  });
  function schedule() { if (active()) task.schedule(); }
  return { schedule, destroy() { task.cancel(); resize.disconnect(); } };
}
