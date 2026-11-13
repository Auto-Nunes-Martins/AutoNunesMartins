import { cubicOut } from 'svelte/easing';

/** Read the preference at interaction time so a system change takes effect immediately. */
export function reorderMotion() {
  const reduced = typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  return { duration: reduced ? 0 : 320, easing: cubicOut };
}

export async function revealFraming(node: HTMLElement) {
  // Wait until the other accordion's outro has released its space.
  await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
  if (!node.isConnected) return;
  const row = node.closest<HTMLElement>('[data-highlight-vehicle], [data-campaign-vehicle]') ?? node;
  const bounds = row.getBoundingClientRect();
  const top = Math.max(88, (window.innerHeight - bounds.height) / 2);
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  window.scrollBy({ top: bounds.top - top, behavior: reduced ? 'instant' : 'smooth' });
}
