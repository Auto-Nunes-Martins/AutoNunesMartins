/** Lock the document while the contact panel follows the visible viewport. */
export function lockContactViewport(dialog: HTMLDialogElement, panel: HTMLElement) {
  const root = document.documentElement;
  const viewport = window.visualViewport;
  const { scrollX: x, scrollY: y } = window;
  root.style.setProperty('--contact-scroll-top', `${-y}px`);
  root.style.setProperty('--contact-scroll-left', `${-x}px`);
  root.classList.add('contact-scroll-locked');
  let frame = 0;

  function update() {
    frame = 0;
    const top = viewport?.offsetTop ?? 0;
    const left = viewport?.offsetLeft ?? 0;
    const height = viewport?.height ?? window.innerHeight;
    const width = viewport?.width ?? root.clientWidth;
    dialog.style.setProperty('--contact-top', `${top}px`);
    dialog.style.setProperty('--contact-left', `${left}px`);
    dialog.style.setProperty('--contact-height', `${height}px`);
    dialog.style.setProperty('--contact-width', `${width}px`);

    const focused = document.activeElement;
    if (
      !(focused instanceof HTMLElement) ||
      !panel.contains(focused) ||
      !focused.matches('input, select, textarea')
    )
      return;
    const field = focused.getBoundingClientRect();
    const bounds = panel.getBoundingClientRect();
    if (field.bottom > bounds.bottom - 12) panel.scrollTop += field.bottom - bounds.bottom + 12;
    else if (field.top < bounds.top + 12) panel.scrollTop -= bounds.top + 12 - field.top;
  }

  function schedule() {
    if (!frame) frame = requestAnimationFrame(update);
  }

  viewport?.addEventListener('resize', schedule);
  viewport?.addEventListener('scroll', schedule);
  window.addEventListener('resize', schedule);
  panel.addEventListener('focusin', schedule);
  update();

  return () => {
    cancelAnimationFrame(frame);
    viewport?.removeEventListener('resize', schedule);
    viewport?.removeEventListener('scroll', schedule);
    window.removeEventListener('resize', schedule);
    panel.removeEventListener('focusin', schedule);
    root.classList.remove('contact-scroll-locked');
    root.style.removeProperty('--contact-scroll-top');
    root.style.removeProperty('--contact-scroll-left');
    window.scrollTo({ left: x, top: y, behavior: 'instant' });
  };
}
