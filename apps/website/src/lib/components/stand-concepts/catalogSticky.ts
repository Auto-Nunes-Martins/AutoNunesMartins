import { scrollFrame, setScrollStyle } from './scrollFrame';

export type CatalogSidebarFrame = {
  width: number;
  viewportHeight: number;
  viewportTop?: number;
  navigationHeight?: number;
  scrollY: number;
  start: number;
  end: number;
  panelHeight: number;
};
export type CatalogSidebarPosition = { offset: number; scrollY: number };

/**
 * A tall panel travels with normal page scrolling until its lower/upper edge is visible.
 * Reversing direction retains its document position (no jump between sticky edges).
 * The last car bounds travel, not the editorial, pagination or the stretched grid row.
 */
export function catalogSidebarPosition(
  frame: CatalogSidebarFrame,
  previous?: CatalogSidebarPosition,
): CatalogSidebarPosition {
  const { width, viewportHeight, scrollY, start, end, panelHeight } = frame;
  const maxOffset = Math.max(0, end - start - panelHeight);
  const clamp = (offset: number) => Math.min(maxOffset, Math.max(0, offset));
  if (width <= 800 || panelHeight <= 0 || maxOffset === 0) return { offset: 0, scrollY };
  const navigationHeight = Math.max(0, frame.navigationHeight ?? 0);
  const top = scrollY + (frame.viewportTop ?? 0) + navigationHeight + 24 - start;
  const bottom = scrollY + (frame.viewportTop ?? 0) + viewportHeight - 24 - panelHeight - start;
  let offset: number;
  if (panelHeight <= viewportHeight - navigationHeight - 48) offset = top;
  else if (!previous) offset = bottom;
  else if (scrollY > previous.scrollY) offset = Math.max(previous.offset, bottom);
  else if (scrollY < previous.scrollY) offset = Math.min(previous.offset, top);
  else offset = previous.offset;
  return { offset: clamp(offset), scrollY };
}

export function catalogSticky(node: HTMLElement) {
  const layout = node.closest('.catalog-layout');
  const sidebar = node.closest<HTMLElement>('.catalog-filters');
  const results = layout?.querySelector<HTMLElement>('.catalog-results');
  const grid = results?.querySelector<HTMLElement>('.catalog-grid');
  const header = node.closest('.design')?.querySelector<HTMLElement>('.stand-header');
  const root = node.closest<HTMLElement>('.design');
  let nativeSticky = false;
  let previous: CatalogSidebarPosition | undefined;
  let geometry = '';
  const measure = () => {
    if (!sidebar || !grid) return;
    const scrollY = window.scrollY;
    const width = window.innerWidth;
    if (width <= 800) {
      return () => {
        nativeSticky = false;
        previous = undefined;
        geometry = '';
        node.classList.remove('native-sticky');
        node.style.removeProperty('--catalog-filter-shift');
        sidebar.style.removeProperty('height');
      };
    }
    const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
    const panelHeight = node.getBoundingClientRect().height;
    const compactHeight = root
      ? Number.parseFloat(getComputedStyle(root).getPropertyValue('--nav-compact-row-height'))
      : 0;
    const nextNativeSticky =
      panelHeight <= viewportHeight - (compactHeight || header?.offsetHeight || 0) - 48;
    const gridBounds = grid.getBoundingClientRect();
    const sidebarBounds = sidebar.getBoundingClientRect();
    if (nextNativeSticky) {
      // Native sticky follows the browser's scroll, without a one-frame JS transform lag.
      // Bound its containing block at the last car, preserving the existing stopping point.
      const available = Math.max(panelHeight, gridBounds.bottom - sidebarBounds.top);
      const height = `${available}px`;
      return () => {
        nativeSticky = true;
        node.classList.add('native-sticky');
        if (sidebar.style.height !== height) sidebar.style.height = height;
        node.style.removeProperty('--catalog-filter-shift');
        previous = undefined;
      };
    }
    const nextGeometry = `${width}:${viewportHeight}:${panelHeight}`;
    const next = catalogSidebarPosition(
      {
        width,
        viewportHeight,
        viewportTop: window.visualViewport?.offsetTop ?? 0,
        navigationHeight: Math.max(
          0,
          (header?.getBoundingClientRect().bottom ?? 0) - (window.visualViewport?.offsetTop ?? 0),
        ),
        scrollY,
        panelHeight,
        start: sidebarBounds.top + scrollY,
        end: gridBounds.bottom + scrollY,
      },
      nextGeometry !== geometry ? undefined : previous,
    );
    return () => {
      nativeSticky = false;
      node.classList.remove('native-sticky');
      sidebar.style.removeProperty('height');
      geometry = nextGeometry;
      // Tall panels keep directional travel, using layout positioning and whole pixels.
      if (!previous || Math.abs(next.offset - previous.offset) > 0.01)
        setScrollStyle(node, '--catalog-filter-shift', `${Math.round(next.offset)}px`);
      previous = next;
    };
  };
  const task = scrollFrame(measure);
  const schedule = () => task.schedule();
  const scroll = () => {
    if (!nativeSticky && window.innerWidth > 800) schedule();
  };
  const observer = new ResizeObserver(schedule);
  observer.observe(node);
  if (results) observer.observe(results);
  if (grid) observer.observe(grid);
  if (header) observer.observe(header);
  header?.addEventListener('transitionend', schedule);
  window.addEventListener('resize', schedule);
  window.addEventListener('scroll', scroll, { passive: true });
  window.visualViewport?.addEventListener('resize', schedule);
  window.visualViewport?.addEventListener('scroll', scroll);
  schedule();
  return {
    destroy() {
      task.cancel();
      observer.disconnect();
      header?.removeEventListener('transitionend', schedule);
      window.removeEventListener('resize', schedule);
      window.removeEventListener('scroll', scroll);
      window.visualViewport?.removeEventListener('resize', schedule);
      window.visualViewport?.removeEventListener('scroll', scroll);
      node.style.removeProperty('--catalog-filter-shift');
      node.classList.remove('native-sticky');
      sidebar?.style.removeProperty('height');
    },
  };
}
