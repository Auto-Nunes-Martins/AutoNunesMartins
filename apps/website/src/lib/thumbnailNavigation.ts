/** Overlay arrows move the thumbnail viewport by two items, leaving selection unchanged. */
export function thumbnailNavigation(frame: HTMLElement) {
  const strip = frame.querySelector<HTMLElement>('.detail-thumbnails')!;
  const previous = frame.querySelector<HTMLButtonElement>('.thumbnail-previous')!;
  const next = frame.querySelector<HTMLButtonElement>('.thumbnail-next')!;
  function measure() {
    previous.disabled = strip.scrollLeft < 1;
    next.disabled = strip.scrollLeft >= strip.scrollWidth - strip.clientWidth - 1;
  }
  function move(direction: number) {
    strip.dispatchEvent(new Event('thumbnail-scroll-interrupt'));
    const item = strip.querySelector('button');
    if (!item) return;
    const step =
      item.getBoundingClientRect().width + parseFloat(getComputedStyle(strip).columnGap || '0');
    strip.scrollBy({
      left: direction * step * 2,
      behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
    });
  }
  const back = () => move(-1),
    forward = () => move(1);
  previous.addEventListener('click', back);
  next.addEventListener('click', forward);
  strip.addEventListener('scroll', measure, { passive: true });
  const observer = new ResizeObserver(measure);
  observer.observe(strip);
  measure();
  return {
    destroy() {
      observer.disconnect();
      strip.removeEventListener('scroll', measure);
      previous.removeEventListener('click', back);
      next.removeEventListener('click', forward);
    },
  };
}
