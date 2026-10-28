/** Integrate Clerk's supported getContainer portal without changing its focus
 * trap, scroll lock, verification or internal component tree. */
export function securityModalHost(host: HTMLElement) {
  let origin: { x: number; y: number; opener: HTMLElement | null } | null = null;
  let shown = false;
  let frame = 0;
  const root = document.documentElement;
  const attribute = 'data-account-security-open';
  const padding = '--account-security-body-padding';
  function release(restore: boolean) {
    const saved = origin; origin = null; shown = false;
    root.removeAttribute(attribute); root.style.removeProperty(padding);
    if (restore && saved) frame = requestAnimationFrame(() => {
      // Explicit instant restoration avoids the CRM's smooth root scrolling.
      window.scrollTo({ left: saved.x, top: saved.y, behavior: 'instant' });
      if (saved.opener?.isConnected) saved.opener.focus({ preventScroll: true });
    });
  }
  const observer = new MutationObserver(() => {
    const open = !!host.querySelector('[role="dialog"]');
    if (open) shown = true;
    else if (shown) release(true);
  });
  observer.observe(host, { childList: true, subtree: true });
  return {
    open(show: (container: () => HTMLElement) => void) {
      cancelAnimationFrame(frame);
      if (!origin) origin = { x: window.scrollX, y: window.scrollY, opener: document.activeElement instanceof HTMLElement ? document.activeElement : null };
      const stable = getComputedStyle(root).scrollbarGutter.includes('stable');
      // Clerk reserves innerWidth-clientWidth as body padding. The CRM already
      // reserves the same gutter on html, so that second reserve must be removed.
      if (stable && CSS.supports('scrollbar-gutter', 'stable')) {
        root.style.setProperty(padding, getComputedStyle(document.body).paddingRight);
        root.setAttribute(attribute, '');
      }
      try { show(() => host); } catch (error) { release(true); throw error; }
    },
    destroy() { observer.disconnect(); cancelAnimationFrame(frame); release(false); },
  };
}
