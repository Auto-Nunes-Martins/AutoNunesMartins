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
    .composite([{ input: foreground, left: Math.round(left), top: Math.round(top) }])
    .jpeg({ quality: 84, progressive: true, chromaSubsampling: '4:4:4' })
    .toBuffer();
}

export function readSocialPhoto(path: string, version: string, position: PhotoFraming['desktop']) {
  return cachedSocialImage(`photo:${version}`, async () => {
    const photo = await readPhotoBytes(path, 1600);
    return photo ? renderSocialPhoto(photo.buffer, position) : null;
  });
}

const fontfile = fileURLToPath(new URL('./social/Inter-SemiBold.woff2', import.meta.url));
const logoFile = fileURLToPath(new URL('./social/logo.png', import.meta.url));
const escapeMarkup = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[char]!,
  );
async function lettering(text: string, size: number, colour: string, maxWidth: number) {
  const rendered = await sharp({
    text: {
      text: `<span foreground="${colour}">${escapeMarkup(text)}</span>`,
      font: `Inter SemiBold ${size}`,
      fontfile,
      rgba: true,
    },
  })
    .png()
    .toBuffer();
  return sharp(rendered).resize({ width: maxWidth, withoutEnlargement: true }).png().toBuffer();
}
/** Server-only artwork. No image generator, font or renderer reaches browser JS. */
export async function renderBrandSocialImage(brand = '', homepage = false) {
  const heading = homepage
    ? 'O seu próximo carro.'
    : brand
      ? `${brand} usados`
      : 'Encontre o seu próximo carro.';
  const logo = await sharp(logoFile).trim().resize({ width: 310 }).png().toBuffer();
  const title = await lettering(heading, 76, '#f4f4f2', 1072);
  const subtitle = await lettering(
    homepage ? 'Há mais caminho pela frente.' : 'Explore as viaturas. Conheça os detalhes.',
    28,
    '#aaa9ad',
    1072,
  );
  const footer = await lettering('AUTO NUNES MARTINS  /  CASTELO BRANCO', 19, '#aaa9ad', 1072);
  const background = Buffer.from(
    '<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg"><rect width="1200" height="630" fill="#101112"/><path d="M64 245H1136" stroke="#303033"/><path d="M64 245H152" stroke="#ed1024" stroke-width="4"/><path d="M64 535H1136" stroke="#303033"/></svg>',
  );
  return sharp(background)
    .composite([
      { input: logo, left: 64, top: 54 },
      { input: title, left: 64, top: 291 },
      { input: subtitle, left: 64, top: 405 },
      { input: footer, left: 64, top: 565 },
    ])
    .jpeg({ quality: 90, chromaSubsampling: '4:4:4' })
    .toBuffer();
}
