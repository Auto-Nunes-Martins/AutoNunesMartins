import { readable } from 'svelte/store';
import { browser } from '$app/environment';

export const reducedMotion = readable(false, (set) => {
  if (!browser) return;
  const media = window.matchMedia('(prefers-reduced-motion: reduce)');
  const update = () => set(media.matches);
  update();
  media.addEventListener('change', update);
  return () => media.removeEventListener('change', update);
});
