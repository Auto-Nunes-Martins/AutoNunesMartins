import { passedHomeStats } from './whatsappContact';

/** IntersectionObserver supplies the same boundary without synchronous scroll geometry reads. */
export function watchHomeStats(isHome: () => boolean, update: (passed: boolean) => void) {
  let stats: Element | null = null;
  const intersection = new IntersectionObserver(entries => {
    const entry = entries.find(item => item.target === stats);
    if (entry) update(isHome() && passedHomeStats(entry.boundingClientRect.bottom));
  }, { threshold: [0, 1] });
  const refresh = () => {
    const next = isHome() ? document.querySelector('.orbit-home .orbit-stats') : null;
    if (next === stats && !stats) return;
    intersection.disconnect();
    if (next !== stats) { stats = next; update(false); }
    if (stats) intersection.observe(stats);
  };
  const changes = new MutationObserver(refresh);
  changes.observe(document.body, { childList: true, subtree: true });
  window.addEventListener('resize', refresh);
  window.visualViewport?.addEventListener('resize', refresh);
  refresh();
  return {
    // Hash/history navigation can reset visibility without replacing the stats node.
    refresh() { intersection.disconnect(); stats = null; update(false); refresh(); },
    destroy() {
      intersection.disconnect(); changes.disconnect(); stats = null;
      window.removeEventListener('resize', refresh);
      window.visualViewport?.removeEventListener('resize', refresh);
    },
  };
}
