import sharp from 'sharp';

export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
export const MAX_UPLOAD_PIXELS = 24_000_000;
export const PHOTO_TARGET_BYTES = 1_100_000;
export const MAX_OUTPUT_BYTES = 2_000_000;
sharp.cache(false);
sharp.concurrency(1);
export class PhotoUploadError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}
/** One admission covers reading, decoding and storage; no waiting bodies are buffered. */
export class PhotoAdmission {
  private active = false;
  acquire(): (() => void) | null {
    if (this.active) return null;
    this.active = true;
    let released = false;
    return () => {
      if (!released) {
        released = true;
        this.active = false;
      }
    };
  }
}
export const photoAdmission = new PhotoAdmission();
export async function optimizePhoto(input: Buffer) {
  if (!input.length || input.length > MAX_UPLOAD_BYTES)
    throw new PhotoUploadError(413, 'Fotografia acima do limite de 20 MB.');
  try {
    const image = sharp(input, {
      limitInputPixels: MAX_UPLOAD_PIXELS,
      failOn: 'warning',
      sequentialRead: true,
    });
    const meta = await image.metadata();
    if (
      !meta.width ||
      !meta.height ||
      (meta.pages ?? 1) !== 1 ||
      !['jpeg', 'png', 'webp'].includes(meta.format || '')
    ) {
      throw new PhotoUploadError(415, 'Apenas JPEG, PNG e WebP estáticos são aceites.');
    }
    if (
      input.length <= PHOTO_TARGET_BYTES &&
      Math.max(meta.width, meta.height) <= 2560 &&
      (!meta.orientation || meta.orientation === 1)
    ) {
      // Decode once to reject truncated/corrupt inputs even on the passthrough path.
      await image.timeout({ seconds: 15 }).stats();
      return {
        buffer: input,
        contentType: `image/${meta.format}`,
        extension: meta.format === 'jpeg' ? 'jpg' : meta.format!,
        optimized: false,
      };
    }
    let output: Buffer = Buffer.alloc(0);
    const deadline = Date.now() + 45_000;
    // Preserve quality: the 1.1 MB target is approximate, with a separate defensive output limit.
    for (const [edge, quality] of [
      [2560, 90],
      [2560, 86],
      [2560, 82],
      [2200, 82],
      [1920, 82],
      [1600, 82],
      [1280, 82],
    ] as const) {
      // Additional downscaling is only needed for the hard cap, not just the approximate target.
      if (edge < 2200 && output.length > 0 && output.length <= MAX_OUTPUT_BYTES) break;
      const remaining = Math.min(15, Math.floor((deadline - Date.now()) / 1000));
      if (remaining < 1)
        throw new PhotoUploadError(
          422,
          'Não foi possível otimizar a fotografia dentro do tempo limite.',
        );
      output = await sharp(input, {
        limitInputPixels: MAX_UPLOAD_PIXELS,
        failOn: 'warning',
        sequentialRead: true,
      })
        .rotate()
        .resize({ width: edge, height: edge, fit: 'inside', withoutEnlargement: true })
        .webp({ quality, effort: 4 })
        .timeout({ seconds: remaining })
        .toBuffer();
      if (output.length <= PHOTO_TARGET_BYTES) break;
    }
    if (output.length > MAX_OUTPUT_BYTES)
      throw new PhotoUploadError(
        422,
        'Não foi possível reduzir a fotografia ao limite de 2 MB mantendo a qualidade mínima. Exporte uma versão menor.',
      );
    return { buffer: output, contentType: 'image/webp', extension: 'webp', optimized: true };
  } catch (error) {
    if (error instanceof PhotoUploadError) throw error;
    throw new PhotoUploadError(422, 'Fotografia inválida ou acima do limite de 24 megapíxeis.');
  }
}
