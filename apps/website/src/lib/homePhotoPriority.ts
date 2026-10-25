/** Preserve the real photo's aspect ratio while the offscreen mobile request waits. */
export function homePhotoPlaceholder(dimensions?: { width: number; height: number } | null) {
  if (!dimensions || !Number.isSafeInteger(dimensions.width) || !Number.isSafeInteger(dimensions.height) ||
      dimensions.width <= 0 || dimensions.height <= 0) return undefined;
  let divisor = dimensions.width;
  let remainder = dimensions.height;
  while (remainder) [divisor, remainder] = [remainder, divisor % remainder];
  return `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${dimensions.width / divisor}" height="${dimensions.height / divisor}"/>`)}`;
}

/** Also initialize after client-side navigation; first document loads run before hydration. */
export function homePhotoPriority(node: HTMLPictureElement) {
  const startup = window as Window & { initializeHomePhotoPriority?: (root: ParentNode) => void };
  const source = node.querySelector<HTMLSourceElement & { _releaseHomePhoto?: () => void }>('source[data-home-photo-priority]');
  if (startup.initializeHomePhotoPriority) startup.initializeHomePhotoPriority(node);
  else if (source) source.media = 'not all';
  return { destroy() { source?._releaseHomePhoto?.(); } };
}
