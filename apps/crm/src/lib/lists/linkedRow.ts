import '$lib/styles/linkedRows.css';

const controls =
  'a, button, input, select, textarea, label, summary, [role="button"], [contenteditable="true"], [data-row-action]';

/** Enhance a record row without replacing its semantics or duplicating its keyboard stop.
 * The primary anchor remains the source of truth, including SvelteKit navigation and modifiers.
 * Unlike an overlay link, delegating leaves the row's values available for text selection/copy. */
export function linkedRow(row: HTMLElement) {
  function primaryLink(event: MouseEvent) {
    if (event.defaultPrevented || !(event.target instanceof Element)) return null;
    if (event.target.closest(controls)) return null;
    return row.querySelector<HTMLAnchorElement>('a.row-link[href]');
  }

  function activate(event: MouseEvent) {
    if (event.button !== 0 && event.button !== 1) return;
    const link = primaryLink(event);
    if (!link) return;
    const selection = window.getSelection();
    if (selection && !selection.isCollapsed) return;
    const middle = event.button === 1;
    const mac = /Mac|iPhone|iPad/.test(navigator.platform);
    link.dispatchEvent(
      new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        view: window,
        ctrlKey: event.ctrlKey || (middle && !mac),
        metaKey: event.metaKey || (middle && mac),
        shiftKey: event.shiftKey,
        altKey: event.altKey,
      }),
    );
    event.preventDefault();
  }

  function preventAutoScroll(event: MouseEvent) {
    if (event.button === 1 && primaryLink(event)) event.preventDefault();
  }

  row.addEventListener('click', activate);
  row.addEventListener('auxclick', activate);
  row.addEventListener('mousedown', preventAutoScroll);
  return {
    destroy() {
      row.removeEventListener('click', activate);
      row.removeEventListener('auxclick', activate);
      row.removeEventListener('mousedown', preventAutoScroll);
    },
  };
}
