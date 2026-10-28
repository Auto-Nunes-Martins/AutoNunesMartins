// One navigation's decoded pixels, never an authorization or a detail source.
let preview: { identity: string; pixels: string; expires: number } | undefined;

function identity(src: string) {
  const url = new URL(src, location.href);
  if (url.origin !== location.origin || !/^\/viaturas\/[^/]+\/photos\/0$/.test(url.pathname) ||
      !/^[a-f0-9]{64}$/.test(url.searchParams.get('v') ?? '')) return undefined;
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
    preview = { identity: key, pixels: canvas.toDataURL('image/webp'), expires: Date.now() + 15000 };
  } catch { /* The normal authorized detail request remains available. */ }
}

/** Only call with a photo identity supplied by this visit's fresh vehicle query. */
export function takeCardPhotoPreview(src: string) {
  const copy = preview;
  preview = undefined;
  return copy && copy.expires > Date.now() && copy.identity === identity(src) ? copy.pixels : undefined;
}
