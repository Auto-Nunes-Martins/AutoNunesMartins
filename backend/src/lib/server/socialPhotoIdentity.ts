import { createHash } from 'node:crypto';
import { galleryFramingSchema, type PhotoFraming } from '@anm/types';

// Matches --inline-gallery-photo-ratio on desktop. A wider crop would change
// the composition the owner approved in the main-photo editor.
export const socialPhotoSize = { width: 1260, height: 900 };
export function socialPhotoPosition(framing?: PhotoFraming | null) {
  const position = framing?.desktop;
  return {
    x: position?.x ?? 50,
    y: position?.y ?? 50,
    zoom: position?.zoom ?? 1,
    fit: position?.fit ?? ('cover' as const),
  };
}
export function savedSocialPhotoPosition(value: unknown, path: string) {
  return socialPhotoPosition(galleryFramingSchema.safeParse(value).data?.[path]);
}
export function socialPhotoVersion(path: string, position: ReturnType<typeof socialPhotoPosition>) {
  return createHash('sha256')
    .update(JSON.stringify(['social-main-v1', path, position]))
    .digest('hex');
}
