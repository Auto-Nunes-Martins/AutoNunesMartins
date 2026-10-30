import { remember } from './publicThumbnail';
// One navigation's decoded pixels, never an authorization.
let preview: { identity: string; pixels: string; expires: number } | undefined;

function identity(src: string) {
  const url = new URL(src, location.href);
  if (
    url.origin !== location.origin ||
    !/^\/viaturas\/[^/]+\/photos\/0$/.test(url.pathname) ||
    !/^[a-f0-9]{64}$/.test(url.searchParams.get('v') ?? '')
  )
    return undefined;
  url.searchParams.delete('w');
  return url.pathname + url.search;
}

export function captureCardPhoto(image?: HTMLImageElement | null) {
  preview = undefined;
  if (!image?.complete || !image.naturalWidth) return;
  const key = identity(image.currentSrc || image.src);
  if (!key) return;
  try {
    const canvas = document.createElement('canvas');
    const scale = Math.min(1, 1600 / Math.max(image.naturalWidth, image.naturalHeight));
    canvas.width = Math.round(image.naturalWidth * scale);
    canvas.height = Math.round(image.naturalHeight * scale);
    const context = canvas.getContext('2d');
    if (!context) return;
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    preview = {
      identity: key,
      pixels: canvas.toDataURL('image/webp'),
      expires: Date.now() + 15000,
    };
    if (typeof window !== 'undefined')
      return (async () => {
        try {
          const url = new URL(image.currentSrc || image.src, location.href),
            version = url.searchParams.get('v')!,
            width = Number(url.searchParams.get('w'));
          if (![320, 384, 800, 1280, 1600, 2560].includes(width)) return;
          const response = await fetch(url, {
            cache: 'only-if-cached',
            mode: 'same-origin',
            credentials: 'omit',
          });
          if (response.ok && response.headers.get('x-photo-version') === version)
            remember(url.pathname.split('/')[2]!, version, width, await response.blob());
        } catch {
          /* The decoded preview remains available without a cached response. */
        }
      })();
  } catch {
    /* The normal authorized detail request remains available. */
  }
}

/** Only call with a photo identity supplied by this visit's fresh vehicle query. */
export function takeCardPhotoPreview(src: string) {
  const copy = preview;
  preview = undefined;
  return copy && copy.expires > Date.now() && copy.identity === identity(src)
    ? copy.pixels
    : undefined;
}
