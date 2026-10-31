import sharp from 'sharp';
import { createHash } from 'node:crypto';
import { vehiclePhotoWidths } from '@anm/types/photoWidths';
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_PIXELS } from './photoOptimization.js';
export const PHOTO_WIDTHS = vehiclePhotoWidths;
// Schema/paths remain compatible; existing derivatives are regenerated from their master.
export const PHOTO_ENCODING_VERSION = 3;
export type PhotoWidth = (typeof PHOTO_WIDTHS)[number];
export type VariantManifest = {
  version: 1;
  encodingVersion?: number;
  sourceHash: string;
  width: number;
  height: number;
  variants: { width: number; height: number; bytes: number }[];
};

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
    encodingVersion: PHOTO_ENCODING_VERSION,
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
      .webp({ quality: 84, effort: 6, smartSubsample: true })
      .timeout({ seconds: 20 })
      .toBuffer({ resolveWithObject: true });
    // Pay for a full integrity decode once, before publishing the derivative.
    // Delivery checks the container/dimensions, not every decoded pixel again.
    await inspectDerivative(data, target, true);
    files.push({ width: target, buffer: data });
    manifest.variants.push({ width: info.width, height: info.height, bytes: data.length });
  }
  return { manifest, files };
}

/** Private derivative paths are written by our encoder. Check the complete RIFF
 * container and dimensions on reads, including old derivatives; full pixel
 * decoding belongs to generation. This does not re-encode or change the bytes. */
export async function inspectDerivative(buffer: Buffer, width: number, decode = false) {
  if (
    buffer.length < 20 ||
    buffer.length > MAX_UPLOAD_BYTES ||
    buffer.toString('ascii', 0, 4) !== 'RIFF' ||
    buffer.toString('ascii', 8, 12) !== 'WEBP' ||
    buffer.readUInt32LE(4) + 8 !== buffer.length
  )
    throw new Error('Invalid derivative container');
  let offset = 12,
    frames = 0;
  while (offset < buffer.length) {
    if (offset + 8 > buffer.length) throw new Error('Truncated derivative chunk');
    const type = buffer.toString('ascii', offset, offset + 4);
    const length = buffer.readUInt32LE(offset + 4);
    if (type === 'ANIM' || type === 'ANMF') throw new Error('Animated derivative');
    if (type === 'VP8 ' || type === 'VP8L') frames++;
    offset += 8 + length + (length % 2);
    if (offset > buffer.length) throw new Error('Truncated derivative chunk');
  }
  if (frames !== 1) throw new Error('Invalid derivative frame');
  const image = sharp(buffer, { limitInputPixels: MAX_UPLOAD_PIXELS, failOn: 'warning' });
  const metadata = await image.metadata();
  if (
    metadata.format !== 'webp' ||
    metadata.width !== width ||
    !metadata.height ||
    metadata.width * metadata.height > MAX_UPLOAD_PIXELS ||
    (metadata.pages ?? 1) !== 1
  )
    throw new Error('Invalid derivative dimensions');
  if (decode) await image.timeout({ seconds: 20 }).stats();
}

export async function encodeVariantManifest(manifest: VariantManifest) {
  const encoded = Buffer.from(JSON.stringify(manifest)).toString('base64');
  return await sharp({ create: { width: 1, height: 1, channels: 3, background: '#fff' } })
    .webp({ lossless: true })
    .withXmp(
      `<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"><rdf:Description xmlns:anm="urn:anm:photo-variants:v1"><anm:manifest>${encoded}</anm:manifest></rdf:Description></rdf:RDF></x:xmpmeta>`,
    )
    .toBuffer();
}
export type EncodedVariants = Awaited<ReturnType<typeof buildPhotoVariants>> & { sidecar?: Buffer };

export function isPhotoWidth(value: number): value is PhotoWidth {
  return PHOTO_WIDTHS.includes(value as PhotoWidth);
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
    v.variants.length <= PHOTO_WIDTHS.length &&
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
