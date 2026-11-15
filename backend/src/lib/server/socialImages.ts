import sharp from 'sharp';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { photoGeometry, type PhotoFraming } from '@anm/types';
import { readPhotoBytes } from './photoVariants.js';
import { socialPhotoSize } from './socialPhotoIdentity.js';

type SocialImage = { buffer: Buffer; etag: string; contentType: string };
// Pixels only: callers must check publication/membership before every access,
// including conditional requests. Bounded memory and two simultaneous renders.
const cache = new Map<string, SocialImage & { until: number }>();
const pending = new Map<string, Promise<SocialImage | null>>();
let cachedBytes = 0;

// One rasterised brand overlay per process; no fonts or client-side work.
let watermark: Promise<{ input: Buffer; left: number; top: number }> | undefined;
function vehicleWatermark() {
  return (watermark ??= (async () => {
    // Give the mark breathing room within the dark, raised story-style plate.
    const width = 358;
    const height = 136;
    const { data: logo, info } = await sharp(
      fileURLToPath(new URL('./social/logo.png', import.meta.url)),
    )
      .trim()
      .resize({ width: 248 })
      .png()
      .toBuffer({ resolveWithObject: true });
    const logoLeft = Math.round((width - info.width) / 2);
    const logoTop = Math.floor((height - info.height) / 2);
    // Include room for the shadow to fall left and below the plate.
    const shadowSpace = 24;
    const overlayWidth = width + shadowSpace;
    const overlayHeight = height + shadowSpace;
    const platePath = `M${overlayWidth + 24} 1H${shadowSpace + 16}
      A15 15 0 0 0 ${shadowSpace + 1} 16V${height - 16}
      A15 15 0 0 0 ${shadowSpace + 16} ${height - 1}H${overlayWidth + 24}Z`;
    const ambientShadow = await sharp(
      Buffer.from(
        `<svg xmlns="http://www.w3.org/2000/svg" width="${overlayWidth}" height="${overlayHeight}">
        <path d="${platePath}" transform="translate(-2 7)" fill="#000" opacity=".32"/>
      </svg>`,
      ),
    )
      .blur(6)
      .png()
      .toBuffer();
    const contactShadow = await sharp(
      Buffer.from(
        `<svg xmlns="http://www.w3.org/2000/svg" width="${overlayWidth}" height="${overlayHeight}">
          <path d="${platePath}" transform="translate(0 3)" fill="#000" opacity=".72"/>
        </svg>`,
      ),
    )
      .blur(1.5)
      .png()
      .toBuffer();
    const panel = Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${overlayWidth}" height="${overlayHeight}">
        <defs>
          <linearGradient id="face" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop stop-color="#101314"/><stop offset=".6" stop-color="#0e1112"/><stop offset="1" stop-color="#0c0f10"/>
          </linearGradient>
          <linearGradient id="edge" x2="0%" y2="100%">
            <stop stop-color="#303335"/><stop offset=".45" stop-color="#141718"/><stop offset="1" stop-color="#030405"/>
          </linearGradient>
        </defs>
        <path d="${platePath}" fill="url(#face)" stroke="url(#edge)" stroke-width="1.5"/>
      </svg>`,
    );
    const input = await sharp(ambientShadow)
      .composite([
        { input: contactShadow, left: 0, top: 0 },
        { input: panel, left: 0, top: 0 },
        { input: logo, left: shadowSpace + logoLeft, top: logoTop },
      ])
      .png()
      .toBuffer();
    return {
      input,
      left: socialPhotoSize.width - overlayWidth,
      top: socialPhotoSize.height - height - 70,
    };
  })().catch((error) => {
    watermark = undefined;
    throw error;
  }));
}

export async function cachedSocialImage(key: string, generate: () => Promise<Buffer | null>) {
  const hit = cache.get(key);
  if (hit && hit.until > Date.now()) {
    cache.delete(key);
    cache.set(key, hit);
    return hit;
  }
  const running = pending.get(key);
  if (running) return running;
  if (pending.size >= 2) throw new Error('Social image renderer busy');
  const work = Promise.resolve().then(async () => {
    const buffer = await generate();
    if (!buffer) return null;
    const image = {
      buffer,
      contentType: 'image/jpeg',
      etag: `"${createHash('sha256').update(buffer).digest('hex')}"`,
      until: Date.now() + 60 * 60_000,
    };
    for (const [id, entry] of cache) {
      if (id === key || entry.until <= Date.now()) {
        cache.delete(id);
        cachedBytes -= entry.buffer.length;
      }
    }
    if (buffer.length <= 2_000_000) {
      while (cache.size && (cache.size >= 64 || cachedBytes + buffer.length > 8 * 1024 * 1024)) {
        const [id, entry] = cache.entries().next().value!;
        cache.delete(id);
        cachedBytes -= entry.buffer.length;
      }
      cache.set(key, image);
      cachedBytes += buffer.length;
    }
    return image;
  });
  pending.set(key, work);
  try {
    return await work;
  } finally {
    pending.delete(key);
  }
}

/** Bake the same object-position, fit and zoom as the main desktop photograph.
 * Extract before resize so extreme aspect ratios/zoom cannot create huge rasters.
 * Masters and normal responsive derivatives are never overwritten.
 */
export async function renderSocialPhoto(input: Buffer, position: PhotoFraming['desktop']) {
  const metadata = await sharp(input, { limitInputPixels: 24_000_000 }).metadata();
  if (!metadata.width || !metadata.height) throw new Error('Invalid photo dimensions');
  const frame = socialPhotoSize;
  const geometry = photoGeometry(
    { width: metadata.width, height: metadata.height },
    frame,
    position,
  )!;
  const left = Math.max(0, geometry.left),
    top = Math.max(0, geometry.top);
  const right = Math.min(frame.width, geometry.left + geometry.width);
  const bottom = Math.min(frame.height, geometry.top + geometry.height);
  // Do not expand an exact integer edge because of floating-point rounding.
  const sourceLeft = Math.max(0, Math.floor((left - geometry.left) / geometry.scale + 1e-7));
  const sourceTop = Math.max(0, Math.floor((top - geometry.top) / geometry.scale + 1e-7));
  const sourceRight = Math.min(
    metadata.width,
    Math.ceil((right - geometry.left) / geometry.scale - 1e-7),
  );
  const sourceBottom = Math.min(
    metadata.height,
    Math.ceil((bottom - geometry.top) / geometry.scale - 1e-7),
  );
  const foreground = await sharp(input, { limitInputPixels: 24_000_000 })
    .extract({
      left: sourceLeft,
      top: sourceTop,
      width: sourceRight - sourceLeft,
      height: sourceBottom - sourceTop,
    })
    .resize(
      Math.max(1, Math.round(right) - Math.round(left)),
      Math.max(1, Math.round(bottom) - Math.round(top)),
      { fit: 'fill' },
    )
    .png()
    .toBuffer();
  const background = geometry.backdrop
    ? await sharp(input, { limitInputPixels: 24_000_000 })
        .resize(Math.round(frame.width * 1.08), Math.round(frame.height * 1.08), { fit: 'cover' })
        .blur(17)
        .modulate({ brightness: 0.55 })
        .extract({
          left: Math.round(frame.width * 0.04),
          top: Math.round(frame.height * 0.04),
          ...frame,
        })
        .png()
        .toBuffer()
    : await sharp({ create: { ...frame, channels: 3, background: '#101112' } })
        .png()
        .toBuffer();
  return sharp(background)
    .composite([
      { input: foreground, left: Math.round(left), top: Math.round(top) },
      await vehicleWatermark(),
    ])
    .jpeg({ quality: 84, progressive: true, chromaSubsampling: '4:4:4' })
    .toBuffer();
}

export function readSocialPhoto(path: string, version: string, position: PhotoFraming['desktop']) {
  return cachedSocialImage(`photo:${version}`, async () => {
    const photo = await readPhotoBytes(path, 1600);
    return photo ? renderSocialPhoto(photo.buffer, position) : null;
  });
}

/** Compatibility for already-shared artwork URLs: return the original logo,
 * without font rendering. New metadata points directly at the original PNG.
 */
export async function renderBrandSocialImage() {
  return sharp(fileURLToPath(new URL('./social/logo-preview.png', import.meta.url)))
    .jpeg({ quality: 90, chromaSubsampling: '4:4:4' })
    .toBuffer();
}
