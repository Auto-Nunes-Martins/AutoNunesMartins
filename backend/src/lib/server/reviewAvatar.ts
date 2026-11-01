import sharp from 'sharp';
import { createHash } from 'node:crypto';

export const MAX_REVIEW_AVATAR_BYTES = 5 * 1024 * 1024;
export async function normalizeReviewAvatar(input: Buffer) {
  if (!input.length || input.length > MAX_REVIEW_AVATAR_BYTES) throw new Error('Invalid image size');
  const image = sharp(input, { limitInputPixels: 16_000_000, failOn: 'warning' });
  const metadata = await image.metadata();
  if (!['jpeg', 'png', 'webp', 'avif', 'heif', 'gif'].includes(metadata.format ?? '') || (metadata.pages ?? 1) > 1)
    throw new Error('Unsupported image');
  // Re-encode raster pixels only: no SVG, animation, original bytes or EXIF are published.
  const data = await image.rotate().resize(128, 128, { fit: 'cover' }).webp({ quality: 84 }).toBuffer();
  if (data.length > 65536) throw new Error('Image too large');
  return { avatarData: data, avatarVersion: createHash('sha256').update(data).digest('hex') };
}
