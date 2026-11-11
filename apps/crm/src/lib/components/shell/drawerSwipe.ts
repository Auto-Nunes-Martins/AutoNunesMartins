import { get } from 'svelte/store';
import { mobileDrawer } from '$lib/stores/sidebar';

const nativeEdge = 40;
const intentDistance = 12;
const openDistance = 72;
const horizontalRatio = 1.5;
const fields = 'input, textarea, select, [contenteditable]:not([contenteditable="false"])';
const protectedSurface = [
  fields,
  'a, button, label, summary, [role="button"], [role="slider"], [draggable="true"]',
  '[data-photo-resolution-group], [data-swipe-surface], [aria-roledescription="carrossel"]',
  '[data-task-column], [data-drawer-swipe-ignore], dialog, [role="dialog"]',
].join(', ');

export function watchDrawerSwipe(content: HTMLElement) {
  const mobile = matchMedia('(max-width: 767px)');
  const viewport = window.visualViewport;
  let gesture: { id: number; x: number; y: number; horizontal: boolean } | undefined;

  function cancel() {
    gesture = undefined;
  }

  function available() {
    return (
      mobile.matches &&
      !get(mobileDrawer) &&
      (viewport?.scale ?? 1) <= 1.01 &&
      !document.activeElement?.matches(fields) &&
      !document.querySelector(
        'dialog[open], :popover-open, [role="dialog"]:not(dialog, [popover], [inert], [hidden], [aria-hidden="true"]), .topbar.searching',
      )
    );
  }

  function ownsScroll(target: Element) {
    for (let node: Element | null = target; node && node !== content; node = node.parentElement) {
      if (node.scrollWidth <= node.clientWidth + 1) continue;
      if (/^(auto|scroll)$/.test(getComputedStyle(node).overflowX)) return true;
    }
    return false;
  }

  function start(event: TouchEvent) {
    cancel();
    const touch = event.touches[0];
    const target = event.target;
    if (
      event.touches.length !== 1 ||
      !touch ||
      touch.clientX < nativeEdge ||
      touch.clientX >= window.innerWidth / 2 ||
      !(target instanceof Element) ||
      !content.contains(target) ||
      target.closest(protectedSurface) ||
      !available() ||
      ownsScroll(target)
    )
      return;
    gesture = { id: touch.identifier, x: touch.clientX, y: touch.clientY, horizontal: false };
  }

  function move(event: TouchEvent) {
    if (!gesture) return;
    const touch = event.touches[0];
    if (event.defaultPrevented || event.touches.length !== 1 || touch?.identifier !== gesture.id) {
      cancel();
      return;
    }
    if (gesture.horizontal) return;
    const dx = touch.clientX - gesture.x;
    const dy = Math.abs(touch.clientY - gesture.y);
    if (Math.max(Math.abs(dx), dy) < intentDistance) return;
    if (dx < dy * horizontalRatio || dx <= 0) cancel();
    else gesture.horizontal = true;
  }

  function end(event: TouchEvent) {
    const previous = gesture;
    cancel();
    if (!previous?.horizontal || event.defaultPrevented || event.touches.length || !available())
      return;
    const touch = event.changedTouches[0];
    if (touch?.identifier !== previous.id) return;
    const dx = touch.clientX - previous.x;
    const dy = Math.abs(touch.clientY - previous.y);
    if (dx >= openDistance && dx >= dy * horizontalRatio) mobileDrawer.open();
  }

  // Observe the gesture without claiming scrolling, browser history, or pinch.
  const listeners: [string, EventListener, AddEventListenerOptions?][] = [
    ['touchstart', start as EventListener, { passive: true, capture: true }],
    ['touchmove', move as EventListener, { passive: true }],
    ['touchend', end as EventListener, { passive: true }],
    ['touchcancel', cancel, { passive: true, capture: true }],
    ['scroll', cancel, { passive: true }],
    ['popstate', cancel],
    ['hashchange', cancel],
    ['pagehide', cancel],
  ];
  for (const [event, handler, options] of listeners)
    window.addEventListener(event, handler, options);
  mobile.addEventListener('change', cancel);
  viewport?.addEventListener('resize', cancel);
  return {
    cancel,
    destroy() {
      for (const [event, handler, options] of listeners)
        window.removeEventListener(event, handler, options);
      mobile.removeEventListener('change', cancel);
      viewport?.removeEventListener('resize', cancel);
    },
  };
}
