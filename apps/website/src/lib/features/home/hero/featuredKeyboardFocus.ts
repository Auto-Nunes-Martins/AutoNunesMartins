/** Pointer clicks may retain DOM focus without requesting a keyboard interaction state. */
export function hasKeyboardFocus(node: HTMLElement) {
  return node.matches(':focus-visible') || !!node.querySelector(':focus-visible');
}
