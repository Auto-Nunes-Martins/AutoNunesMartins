import './featuredHover.css';
import { hasKeyboardFocus } from './featuredKeyboardFocus';

/** Keep V2's scroll/pointer transform immediate outside hover and its 500ms return. */
export function featuredHover(node: HTMLElement) {
  const enabled = matchMedia(
    '(min-width: 701px) and (hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)',
  );
  let timer: ReturnType<typeof setTimeout> | undefined;
  const reset = () => {
    clearTimeout(timer);
    node.classList.remove('v2-card-hover-transition');
  };
  const enter = () => {
    clearTimeout(timer);
    if (enabled.matches) node.classList.add('v2-card-hover-transition');
  };
  const leave = () => {
    if (node.matches(':hover') || hasKeyboardFocus(node)) return;
    clearTimeout(timer);
    timer = setTimeout(reset, 500);
  };
  node.addEventListener('pointerenter', enter);
  node.addEventListener('pointerleave', leave);
  node.addEventListener('focusin', enter);
  node.addEventListener('focusout', leave);
  enabled.addEventListener('change', reset);
  return {
    destroy() {
      reset();
      node.removeEventListener('pointerenter', enter);
      node.removeEventListener('pointerleave', leave);
      node.removeEventListener('focusin', enter);
      node.removeEventListener('focusout', leave);
      enabled.removeEventListener('change', reset);
    },
  };
}
