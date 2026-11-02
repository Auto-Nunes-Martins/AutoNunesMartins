import sharp from 'sharp';
import { createHash } from 'node:crypto';
import { getSupabase, getBucketName } from '../data/storageClient.js';
import { MAX_UPLOAD_BYTES } from './photoOptimization.js';
import { PhotoByteCache, type CachedPhoto } from './photoByteCache.js';
import { sanitizePhotoMetadata } from './photoMetadata.js';

export {
  PHOTO_WIDTHS,
  PHOTO_ENCODING_VERSION,
  buildPhotoVariants,
  isPhotoWidth,
  validManifest,
} from './photoVariantEncoding.js';
export type { PhotoWidth, VariantManifest } from './photoVariantEncoding.js';
import {
  PHOTO_ENCODING_VERSION,
  buildPhotoVariants,
  inspectDerivative,
  encodeVariantManifest,
  validManifest,
} from './photoVariantEncoding.js';
import type { PhotoWidth, VariantManifest, EncodedVariants } from './photoVariantEncoding.js';
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
  for (const key of photoReads.keys()) if (key.startsWith(path + '|')) photoReads.delete(key);
  const master = masterReads.get(path);
  if (master) master.invalidated = true;
  masterReads.delete(path);
  bytesCache.forget(path);
}
function remember(path: string, value: VariantManifest | null, ttl = value ? 40 * 60_000 : 5_000) {
  if (manifests.size >= 500) manifests.delete(manifests.keys().next().value!);
  manifests.set(path, { until: Date.now() + ttl, value });
}
export async function readVariantManifest(path: string): Promise<VariantManifest | null> {
  const cached = manifests.get(path);
  if (cached && cached.until > Date.now()) {
    return cached.value;
  }

  const pending = manifestReads.get(path);
  if (pending) {
    return pending;
  }
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
    const bytes = Buffer.from(await data.arrayBuffer());
    const meta = await sharp(bytes, {
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
/** Publish the manifest last to track complete batches. Individually valid derivatives are reusable. */
export async function ensurePhotoVariants(
  path: string,
  input?: Buffer,
  encode?: (input: Buffer) => Promise<EncodedVariants>,
  beforeWrite?: () => Promise<void>,
) {
  const bucket = getSupabase().storage.from(getBucketName());
  const existing = await readVariantManifest(path);
  if (existing) {
    if (input && createHash('sha256').update(input).digest('hex') !== existing.sourceHash)
      throw new Error('Immutable master content changed');
    let complete = existing.encodingVersion === PHOTO_ENCODING_VERSION;
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

  const built: EncodedVariants = await (encode ?? buildPhotoVariants)(input);

  for (const file of built.files) {
    // Deterministic, private derivative namespace; safe to replace partial derivatives only.
    await beforeWrite?.();
    const { error } = await bucket.upload(variantPath(path, file.width), file.buffer, {
      contentType: 'image/webp',
      cacheControl: '3600',
      upsert: true,
    });
    if (error) throw new Error('Derivative upload failed');
  }
  const sidecar = built.sidecar ?? (await encodeVariantManifest(built.manifest));
  await beforeWrite?.();
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
const bytesCache = new PhotoByteCache();
type PhotoBytes = CachedPhoto;
const photoReads = new Map<string, { promise: Promise<PhotoBytes | null> }>();
type MasterRead = {
  promise: Promise<PhotoBytes | null>;
  invalidated: boolean;
  published: boolean;
  users: number;
};
// Active reads only. No persistent path/epoch registry; settled work is removed.
const masterReads = new Map<string, MasterRead>();
export async function readPhotoBytes(path: string, width?: PhotoWidth): Promise<PhotoBytes | null> {
  const key = path + '|' + (width ?? 'original'),
    hit = bytesCache.get(key);
  if (width && hit && hit.until > Date.now()) {
    return hit;
  }
  // Share pixels only: every caller must still complete live authorization first.
  const pending = photoReads.get(key);
  if (pending) {
    return pending.promise;
  }
  const read: Promise<PhotoBytes | null> = Promise.resolve().then(() =>
    loadPhotoBytes(path, width, () => photoReads.get(key)?.promise === read),
  );
  photoReads.set(key, { promise: read });
  try {
    return await read;
  } finally {
    if (photoReads.get(key)?.promise === read) photoReads.delete(key);
  }
}
async function downloadMaster(path: string): Promise<PhotoBytes | null> {
  const { data, error } = await getSupabase().storage.from(getBucketName()).download(path);
  if (
    error ||
    !data ||
    data.size > MAX_UPLOAD_BYTES ||
    !['image/jpeg', 'image/png', 'image/webp'].includes(data.type)
  )
    return null;
  const input = Buffer.from(await data.arrayBuffer());
  let buffer: Buffer;
  try {
    buffer = await sanitizePhotoMetadata(input);
  } catch {
    return null;
  }
  const etag = '"' + createHash('sha256').update(path).update(buffer).digest('hex') + '"';
  return { until: Date.now() + 60_000, buffer, contentType: data.type, etag };
}
async function readResolvedMaster(
  path: string,
  width: PhotoWidth | undefined,
  isCurrent: () => boolean,
): Promise<PhotoBytes | null> {
  const key = path + '|resolved-master';
  // A request invalidated while resolving its manifest/derivative must not join
  // or create reusable work, even if no master flight existed at invalidation.
  const hit = isCurrent() && width ? bytesCache.get(key) : undefined;
  if (hit) {
    return hit; // Do not refresh TTL on hits.
  }

  const reusable = isCurrent();
  let flight = reusable ? masterReads.get(path) : undefined;
  if (!flight) {
    flight = {
      promise: Promise.resolve().then(() => downloadMaster(path)),
      invalidated: !reusable,
      published: false,
      users: 0,
    };
    if (reusable) masterReads.set(path, flight);
  }
  flight.users++;
  try {
    const photo = await flight.promise;
    if (photo && width && isCurrent() && !flight.invalidated && !flight.published) {
      flight.published = true;
      // One physical buffer, one budget charge. Masters never occupy derivative
      // keys or the thumbnail reservation, including fallbacks requested at 320px.
      bytesCache.set(key, photo, width, false);
    }
    return photo;
  } finally {
    flight.users--;
    if (!flight.users && masterReads.get(path) === flight) masterReads.delete(path);
  }
}
async function loadPhotoBytes(
  path: string,
  width: PhotoWidth | undefined,
  isCurrent: () => boolean,
): Promise<PhotoBytes | null> {
  const key = path + '|' + (width ?? 'original');

  const thumbnail = width !== undefined && width <= 800;
  // Requested widths have deterministic private paths. A cold read need not download
  // the manifest first. Reuse a known manifest when present (including small masters).
  const known = manifests.get(path);
  const current = known && known.until > Date.now() ? known : undefined;
  const part = width && current?.value?.variants.find((variant) => variant.width >= width);
  const chosen = width
    ? current
      ? part
        ? variantPath(path, part.width)
        : path
      : thumbnail
        ? variantPath(path, width)
        : await preferredVariantPath(path, width)
    : path;

  if (chosen === path) {
    const photo = await readResolvedMaster(path, width, isCurrent);

    return photo;
  }
  const bucket = getSupabase().storage.from(getBucketName());
  const result = await bucket.download(chosen);
  let derivative: Buffer | undefined;
  if (thumbnail && !result.error && result.data && chosen !== path) {
    try {
      if (result.data.size > MAX_UPLOAD_BYTES || result.data.type !== 'image/webp')
        throw new Error('Invalid derivative');
      const data = result.data;
      derivative = Buffer.from(await data.arrayBuffer());
      const bytes = derivative;
      await inspectDerivative(bytes, part ? part.width : width!);
    } catch {
      derivative = undefined;
    }
  }
  const missing = thumbnail ? String(result.error?.statusCode) === '404' : !!result.error;
  const invalidDerivative = !result.error && (!result.data || (thumbnail && !derivative));
  if ((missing || invalidDerivative) && chosen !== path) {
    const photo = await readResolvedMaster(path, width, isCurrent);

    return photo;
  }

  if (
    result.error ||
    !result.data ||
    result.data.size > MAX_UPLOAD_BYTES ||
    !['image/jpeg', 'image/png', 'image/webp'].includes(result.data.type)
  ) {
    return null;
  }
  const data = result.data;
  const buffer = derivative ?? Buffer.from(await data.arrayBuffer());
  const contentType = result.data.type;

  const etag = '"' + createHash('sha256').update(path).update(buffer).digest('hex') + '"';
  const value = { until: Date.now() + 60_000, buffer, contentType, etag };
  if (isCurrent() && width) bytesCache.set(key, value, width, true);
  return value;
}
