import { cubicOut } from 'svelte/easing';

export function panelTransition(_node: Element) {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const mobile = matchMedia('(max-width: 767px)').matches;
  const offset = mobile ? -10 : -6;
  const scale = mobile ? 0.012 : 0.025;
  return {
    duration: reduced ? 0 : 220,
    easing: cubicOut,
    css: (t: number, u: number) =>
      `opacity: ${t}; transform: translateY(${offset * u}px) scale(${1 - scale * u});`,
  };
}
