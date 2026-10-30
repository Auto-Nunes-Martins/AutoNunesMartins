import { fullscreenPhotoWidth, nearestPhotoWidth } from '../../../../shared/photoResolution.mjs';
type Photo = {
  url: string | null;
  width?: number;
  height?: number;
  variants?: { url: string; width: number; height?: number }[];
};
type Copy = { url: string; width: number };
type Entry = {
  identity: string;
  width: number;
  nodes: Set<HTMLImageElement>;
  requests: Map<string, Promise<Copy | undefined>>;
  listeners: Set<() => void>;
};
const entries = new WeakMap<Photo, Entry>();
function entry(photo: Photo) {
  let value = entries.get(photo);
  if (!value || value.identity !== photo.url) {
    value = {
      identity: photo.url ?? '',
      width: 0,
      nodes: new Set(),
      requests: new Map(),
      listeners: new Set(),
    };
    entries.set(photo, value);
  }
  return value;
}
export function selectPhoto(photo: Photo, pixels: number): Copy | undefined {
  const choices = [
    ...(photo.variants ?? []),
    ...(photo.url ? [{ url: photo.url, width: photo.width ?? Infinity }] : []),
  ].sort((a, b) => a.width - b.width);
  return choices.find((p) => p.width >= pixels) ?? choices.at(-1);
}
async function decoded(photo: Photo, record: Entry, width: number) {
  const candidate = selectPhoto(photo, width);
  if (!candidate) return;
  const previous = record.requests.get(candidate.url);
  if (previous) return previous;
  const pending = (async () => {
    for (const url of [...new Set([candidate.url, photo.url].filter(Boolean) as string[])]) {
      const image = new Image();
      image.decoding = 'async';
      image.src = url;
      try {
        await image.decode();
        return { url, width: image.naturalWidth };
      } catch {
        /* One native-master fallback, shared by the group. */
      }
    }
  })();
  record.requests.set(candidate.url, pending);
  return pending;
}
/** Current signed payload only; no retained credentials/authorization across photo objects. */
export function reusablePhoto(
  node: HTMLImageElement,
  initial: { photo: Photo; fullscreen?: boolean },
) {
  let source = initial,
    record = entry(source.photo),
    alive = true,
    generation = 0,
    removePreview: (() => void) | undefined,
    displayed: Copy | undefined;
  record.nodes.add(node);
  function snapshot() {
    removePreview?.();
    const ready = [...record.nodes].find(
      (image) => image !== node && image.complete && image.naturalWidth > 0,
    );
    if (!ready || !node.parentElement) return;
    const canvas = document.createElement('canvas'),
      scale = Math.min(1, 1600 / Math.max(ready.naturalWidth, ready.naturalHeight));
    canvas.width = Math.round(ready.naturalWidth * scale);
    canvas.height = Math.round(ready.naturalHeight * scale);
    const context = canvas.getContext('2d');
    if (!context) return;
    try {
      context.drawImage(ready, 0, 0, canvas.width, canvas.height);
    } catch {
      return;
    }
    canvas.setAttribute('aria-hidden', 'true');
    canvas.dataset.photoPreview = '';
    canvas.style.cssText =
      'position:absolute;inset:0;width:100%;height:100%;object-fit:contain;pointer-events:none';
    node.parentElement.append(canvas);
    removePreview = () => canvas.remove();
  }
  function needed() {
    const main = node.closest('[data-photo-resolution-group]')?.querySelector('.photo-preview');
    const metadata =
      source.photo.width && source.photo.height
        ? source.photo
        : source.photo.variants?.find((p) => p.height);
    const ratio =
      metadata?.width && metadata.height
        ? metadata.width / metadata.height
        : node.naturalWidth && node.naturalHeight
          ? node.naturalWidth / node.naturalHeight
          : 0;
    const size = (element: Element) => {
      const box = element.getBoundingClientRect();
      return Math.max(
        box.width,
        getComputedStyle(element).objectFit === 'cover' || element === main
          ? box.height * ratio
          : 0,
      );
    };
    const width =
      (main ? size(main) : undefined) ??
      Math.max(...[...record.nodes].filter((n) => !n.closest('dialog')).map(size), 0);
    return nearestPhotoWidth(Math.max(1, width || 320) * (window.devicePixelRatio || 1));
  }
  async function show() {
    const token = ++generation;
    if (source.fullscreen && !node.naturalWidth) snapshot();
    const width = needed();
    if (width > record.width) {
      record.width = width;
      for (const notify of record.listeners) if (notify !== refresh) notify();
    }
    const copy = await decoded(source.photo, record, record.width);
    if (!alive || token !== generation) return;
    if (!copy) {
      if (!node.naturalWidth) node.dispatchEvent(new Event('error'));
      return;
    }
    node.removeAttribute('srcset');
    if (!source.fullscreen || !displayed || displayed.width < copy.width) {
      node.src = copy.url;
      displayed = copy;
    }
    try {
      await node.decode();
    } catch {
      return;
    }
    if (!alive || token !== generation) return;
    removePreview?.();
    removePreview = undefined;
    if (needed() > record.width) {
      queueMicrotask(refresh);
      return;
    }
    if (!source.fullscreen) return;
    const box = node.getBoundingClientRect(),
      target = fullscreenPhotoWidth(
        box.width,
        box.height,
        node.naturalWidth / node.naturalHeight,
        (window.devicePixelRatio || 1) * (window.visualViewport?.scale ?? 1),
        displayed?.width ?? copy.width,
      );
    if (target <= (displayed?.width ?? copy.width)) return;
    const larger = await decoded(source.photo, record, target);
    if (!alive || token !== generation || !larger) return;
    node.src = larger.url;
    displayed = larger;
  }
  function refresh() {
    void show();
  }
  record.listeners.add(refresh);
  const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(refresh);
  observer?.observe(
    node.closest('[data-photo-resolution-group]')?.querySelector('.photo-preview') ?? node,
  );
  window.addEventListener('resize', refresh);
  queueMicrotask(refresh);
  window.visualViewport?.addEventListener('resize', refresh);
  return {
    update(next: typeof initial) {
      if (
        next.photo === source.photo &&
        next.photo.url === record.identity &&
        next.fullscreen === source.fullscreen
      )
        return;
      record.nodes.delete(node);
      record.listeners.delete(refresh);
      source = next;
      displayed = undefined;
      record = entry(source.photo);
      record.nodes.add(node);
      record.listeners.add(refresh);
      removePreview?.();
      refresh();
    },
    destroy() {
      alive = false;
      generation++;
      observer?.disconnect();
      window.removeEventListener('resize', refresh);
      window.visualViewport?.removeEventListener('resize', refresh);
      record.nodes.delete(node);
      record.listeners.delete(refresh);
      removePreview?.();
    },
  };
}
