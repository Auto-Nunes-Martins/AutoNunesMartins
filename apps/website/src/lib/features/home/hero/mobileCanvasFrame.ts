/** Keep the fixed mobile wallpaper's natural pixel frame through toolbar-height
 * changes. Width/orientation changes release it before CSS is measured again. */
export function mobileCanvasFrame(canvas: HTMLElement) {
  const properties = ['left', 'top', 'width', 'height'] as const;
  const original = properties.map((property) => ({
    property,
    value: canvas.style.getPropertyValue(property),
    priority: canvas.style.getPropertyPriority(property),
  }));
  let frameKey: string | undefined;
  let sources = [...canvas.querySelectorAll('source')];
  let heightMedia = sources
    .filter((source) => /\((?:min|max)-height:/.test(source.media))
    .map((source) => ({ source, media: source.media }));
  function restore() {
    for (const { property, value, priority } of original) {
      if (value) canvas.style.setProperty(property, value, priority);
      else canvas.style.removeProperty(property);
    }
    for (const { source, media } of heightMedia) source.media = media;
  }
  return {
    prepare(enabled: boolean, viewportWidth: number, layoutWidth: number, orientation: number) {
      const current = [...canvas.querySelectorAll('source')];
      if (current.length !== sources.length || current.some((source, i) => source !== sources[i])) {
        restore();
        sources = current;
        heightMedia = sources
          .filter((source) => /\((?:min|max)-height:/.test(source.media))
          .map((source) => ({ source, media: source.media }));
        frameKey = undefined;
      }
      const key = enabled ? `${viewportWidth}:${layoutWidth}:${orientation}` : undefined;
      if (key === frameKey) return false;
      restore();
      frameKey = key;
      return enabled;
    },
    capture() {
      const bounds = canvas.getBoundingClientRect();
      canvas.style.left = `${bounds.left}px`;
      canvas.style.top = `${bounds.top}px`;
      canvas.style.width = `${bounds.width}px`;
      canvas.style.height = `${bounds.height}px`;
      // Crossing a height media breakpoint must not switch the portrait crop
      // when only browser chrome changed. Native srcset density stays adaptive.
      for (const { source, media } of heightMedia)
        source.media = matchMedia(media).matches ? 'all' : 'not all';
    },
    destroy: restore,
  };
}
