import sharp from 'sharp';
import { createHash } from 'node:crypto';
import { getSupabase, getBucketName } from '../data/storage.js';
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_PIXELS } from './photoOptimization.js';

export const PHOTO_WIDTHS = [320, 800, 1600, 2560] as const;
export type PhotoWidth = (typeof PHOTO_WIDTHS)[number];
export type VariantManifest = {
  version: 1;
  sourceHash: string;
  width: number;
  height: number;
  variants: { width: number; height: number; bytes: number }[];
};
export function isPhotoWidth(value: number): value is PhotoWidth {
  return PHOTO_WIDTHS.includes(value as PhotoWidth);
}
/** Derivatives are never valid master-photo paths or publication identifiers. */
export function variantRoot(path: string) {
  if (!/^[a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+\.(?:jpe?g|png|webp)$/i.test(path))
    throw new Error('Invalid master photo path');
  const [owner, file] = path.split('/');
  return `${owner}/.variants/v1/${file}`;
}
export const variantPath = (path: string, width: number) => `${variantRoot(path)}/${width}.webp`;
// Valid 1x1 WebP sidecar: this bucket intentionally permits raster MIME types only.
// XMP carries our generated manifest, never user EXIF/location data.
export const manifestPath = (path: string) => `${variantRoot(path)}/manifest.webp`;
const manifests = new Map<string, { until: number; value: VariantManifest | null }>();
const manifestReads = new Map<string, Promise<VariantManifest | null>>();
export function forgetPhotoVariants(path: string) {
  manifests.delete(path);
  manifestReads.delete(path);
  for (const key of bytesCache.keys()) if (key.startsWith(path + '|')) bytesCache.delete(key);
}
function remember(path: string, value: VariantManifest | null, ttl = value ? 40 * 60_000 : 5_000) {
  if (manifests.size >= 500) manifests.delete(manifests.keys().next().value!);
  manifests.set(path, { until: Date.now() + ttl, value });
}
export function validManifest(value: unknown): value is VariantManifest {
  const v = value as VariantManifest | null;
  return (
    !!v &&
    v.version === 1 &&
    /^[a-f0-9]{64}$/.test(v.sourceHash) &&
    Number.isInteger(v.width) &&
    v.width > 0 &&
    Number.isInteger(v.height) &&
    v.height > 0 &&
    Array.isArray(v.variants) &&
    v.variants.length <= 4 &&
    v.variants.every(
      (p) =>
        isPhotoWidth(p.width) &&
        p.width < v.width &&
        Number.isInteger(p.height) &&
        p.height > 0 &&
        p.bytes > 0 &&
        p.bytes <= MAX_UPLOAD_BYTES,
    )
  );
}
export async function readVariantManifest(path: string): Promise<VariantManifest | null> {
  const cached = manifests.get(path);
  if (cached && cached.until > Date.now()) return cached.value;
  const pending = manifestReads.get(path);
  if (pending) return pending;
  const read: Promise<VariantManifest | null> = Promise.resolve().then(() =>
    loadVariantManifest(path, () => manifestReads.get(path) === read),
  );
  manifestReads.set(path, read);
  try {
    return await read;
  } finally {
    if (manifestReads.get(path) === read) manifestReads.delete(path);
  }
}
async function loadVariantManifest(
  path: string,
  isCurrent: () => boolean,
): Promise<VariantManifest | null> {
  // Defer cache writes to the current read only: deletion/generation may
  // invalidate this request while its download is still in flight.
  const store = (value: VariantManifest | null, ttl?: number) => {
    if (isCurrent()) remember(path, value, ttl);
  };
  try {
    const { data, error } = await getSupabase()
      .storage.from(getBucketName())
      .download(manifestPath(path));
    if (error || !data || data.size > 8192) {
      // Immutable masters keep successful manifests useful for the signed-URL
      // lifetime. Missing legacy sidecars can be retried after one minute;
      // transient storage failures retain a short retry window.
      store(null, String(error?.statusCode) === '404' ? 60_000 : 5_000);
      return null;
    }
    const meta = await sharp(Buffer.from(await data.arrayBuffer()), {
      limitInputPixels: 1,
    }).metadata();
    const xmp = meta.xmpAsString ?? meta.xmp?.toString('utf8') ?? '';
    const encoded = /<anm:manifest>([A-Za-z0-9+/=]+)<\/anm:manifest>/.exec(xmp)?.[1];
    const value: unknown = encoded
      ? JSON.parse(Buffer.from(encoded, 'base64').toString('utf8'))
      : null;
    const manifest = validManifest(value) ? value : null;
    store(manifest);
    return manifest;
  } catch {
    store(null);
    return null;
  }
}
/** A bounded worker pool avoids waves waiting for their slowest download. */
export async function readVariantManifests(paths: string[]) {
  const unique = [...new Set(paths)];
  const result = new Map<string, VariantManifest | null>();
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(8, unique.length) }, async () => {
      while (next < unique.length) {
        const path = unique[next++]!;
        result.set(path, await readVariantManifest(path));
      }
    }),
  );
  return result;
}
/** Sequential decoding/encoding, bounded pixels and time. Masters are never overwritten. */
export async function buildPhotoVariants(
  input: Buffer,
): Promise<{ manifest: VariantManifest; files: { width: number; buffer: Buffer }[] }> {
  if (!input.length || input.length > MAX_UPLOAD_BYTES)
    throw new Error('Master exceeds supported byte limit');
  const options = {
    limitInputPixels: MAX_UPLOAD_PIXELS,
    sequentialRead: true,
    failOn: 'warning' as const,
  };
  const metadata = await sharp(input, options).metadata();
  if (
    !metadata.width ||
    !metadata.height ||
    !['jpeg', 'png', 'webp'].includes(metadata.format || '') ||
    (metadata.pages ?? 1) !== 1
  )
    throw new Error('Unsupported master image');
  const rotated = !!metadata.orientation && metadata.orientation >= 5;
  const width = rotated ? metadata.height : metadata.width,
    height = rotated ? metadata.width : metadata.height;
  const manifest: VariantManifest = {
    version: 1,
    sourceHash: createHash('sha256').update(input).digest('hex'),
    width,
    height,
    variants: [],
  };
  const files: { width: number; buffer: Buffer }[] = [];
  for (const target of PHOTO_WIDTHS) {
    // The original is the largest srcset candidate; never re-encode/upscale at its native width.
    if (target >= width) continue;
    const { data, info } = await sharp(input, options)
      .rotate()
      .resize({ width: target, withoutEnlargement: true })
      .webp({ quality: 94, effort: 3, smartSubsample: true })
      .timeout({ seconds: 20 })
      .toBuffer({ resolveWithObject: true });
    files.push({ width: target, buffer: data });
    manifest.variants.push({ width: info.width, height: info.height, bytes: data.length });
  }
  return { manifest, files };
}
/** Publish the manifest last. Interrupted runs remain retryable; originals/DB stay untouched. */
export async function ensurePhotoVariants(path: string, input?: Buffer) {
  const bucket = getSupabase().storage.from(getBucketName());
  const existing = await readVariantManifest(path);
  if (existing) {
    if (input && createHash('sha256').update(input).digest('hex') !== existing.sourceHash)
      throw new Error('Immutable master content changed');
    let complete = true;
    for (const part of existing.variants) {
      const { data, error } = await bucket.info(variantPath(path, part.width));
      if (error || !data) {
        complete = false;
        break;
      }
    }
    if (complete) return { created: 0, reused: true, manifest: existing };
  }
  if (!input) {
    const { data, error } = await bucket.download(path);
    if (error || !data || data.size > MAX_UPLOAD_BYTES)
      throw new Error('Master unavailable or too large');
    input = Buffer.from(await data.arrayBuffer());
  }
  const built = await buildPhotoVariants(input);
  for (const file of built.files) {
    // Deterministic, private derivative namespace; safe to replace partial derivatives only.
    const { error } = await bucket.upload(variantPath(path, file.width), file.buffer, {
      contentType: 'image/webp',
      cacheControl: '3600',
      upsert: true,
    });
    if (error) throw new Error('Derivative upload failed');
  }
  const encoded = Buffer.from(JSON.stringify(built.manifest)).toString('base64');
  const sidecar = await sharp({ create: { width: 1, height: 1, channels: 3, background: '#fff' } })
    .webp({ lossless: true })
    .withXmp(
      `<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"><rdf:Description xmlns:anm="urn:anm:photo-variants:v1"><anm:manifest>${encoded}</anm:manifest></rdf:Description></rdf:RDF></x:xmpmeta>`,
    )
    .toBuffer();
  const { error } = await bucket.upload(manifestPath(path), sidecar, {
    contentType: 'image/webp',
    cacheControl: '0',
    upsert: true,
  });
  if (error) throw new Error('Derivative manifest upload failed');
  forgetPhotoVariants(path);
  remember(path, built.manifest);
  return { created: built.files.length, reused: false, manifest: built.manifest };
}
export async function preferredVariantPath(path: string, width: number) {
  const manifest = await readVariantManifest(path);
  return manifest?.variants.find((v) => v.width >= width)
    ? variantPath(path, manifest.variants.find((v) => v.width >= width)!.width)
    : path;
}
// Pixel cache only. Callers MUST validate live authorization before every read/304.
const bytesCache = new Map<
  string,
  { until: number; buffer: Buffer; contentType: string; etag: string }
>();
const CACHE_BYTES = 12 * 1024 * 1024;
export async function readPhotoBytes(path: string, width?: PhotoWidth) {
  const key = path + '|' + (width ?? 'original'),
    hit = bytesCache.get(key);
  if (width && hit && hit.until > Date.now()) return hit;
  let chosen = width ? await preferredVariantPath(path, width) : path;
  const bucket = getSupabase().storage.from(getBucketName());
  let result = await bucket.download(chosen);
  if ((result.error || !result.data) && chosen !== path) {
    chosen = path;
    result = await bucket.download(path);
  }
  if (
    result.error ||
    !result.data ||
    result.data.size > MAX_UPLOAD_BYTES ||
    !['image/jpeg', 'image/png', 'image/webp'].includes(result.data.type)
  )
    return null;
  const buffer = Buffer.from(await result.data.arrayBuffer()),
    contentType = result.data.type;
  const etag = '"' + createHash('sha256').update(path).update(buffer).digest('hex') + '"';
  const value = { until: Date.now() + 60_000, buffer, contentType, etag };
  if (width && buffer.length <= 2_000_000) {
    for (const [k, v] of bytesCache) if (v.until < Date.now()) bytesCache.delete(k);
    let size = [...bytesCache.values()].reduce((n, v) => n + v.buffer.length, 0);
    while (size + buffer.length > CACHE_BYTES && bytesCache.size) {
      const first = bytesCache.keys().next().value!;
      size -= bytesCache.get(first)!.buffer.length;
      bytesCache.delete(first);
    }
    bytesCache.set(key, value);
  }
  return value;
}
