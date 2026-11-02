// Disposable codec process. No database, Storage, dotenv or application imports.
import { writeFileSync } from 'node:fs';
import { optimizePhoto, PhotoUploadError, MAX_UPLOAD_BYTES } from './photoOptimization.js';
import { buildPhotoVariants, encodeVariantManifest } from './photoVariantEncoding.js';
import { normalizeReviewAvatar } from './reviewAvatar.js';
const MAX_RESULT_BYTES = 16 * 1024 * 1024;
let busy = false,
  jobs = 0;
globalThis.fetch = async () => {
  throw Error('Network unavailable in photo codec process');
};
if (process.platform === 'linux') {
  try {
    writeFileSync('/proc/self/oom_score_adj', '500');
  } catch {
    /* Best effort: the disposable child remains unprivileged. */
  }
}
const send = (message: object) => {
  if (process.connected) process.send?.(message, () => {});
};
process.on('disconnect', () => process.exit(0));
process.on('message', async (message: unknown) => {
  const request = message as { type?: string; id?: number; kind?: string; input?: Buffer };
  if (request.type === 'shutdown') process.exit(0);
  if (
    request.type !== 'job' ||
    !Number.isSafeInteger(request.id) ||
    !Buffer.isBuffer(request.input) ||
    request.input.length > MAX_UPLOAD_BYTES ||
    !['optimize', 'variants', 'avatar'].includes(request.kind ?? '') ||
    busy ||
    ++jobs > 2
  ) {
    send({ type: 'failure', id: request.id, status: 422 });
    return;
  }
  busy = true;

  try {
    let result: unknown;
    if (request.kind === 'optimize') result = await optimizePhoto(request.input);
    else if (request.kind === 'avatar') result = await normalizeReviewAvatar(request.input);
    else {
      const built = await buildPhotoVariants(request.input);
      const sidecar = await encodeVariantManifest(built.manifest);
      if (built.files.reduce((sum, f) => sum + f.buffer.length, sidecar.length) > MAX_RESULT_BYTES)
        throw new PhotoUploadError(
          422,
          'Os tamanhos da fotografia excedem o limite de processamento.',
        );
      result = { ...built, sidecar };
    }

    send({ type: 'result', id: request.id, result });
  } catch (error) {
    send({
      type: 'failure',
      id: request.id,
      status: error instanceof PhotoUploadError ? error.status : 422,
    });
  } finally {
    busy = false;
  }
});
send({ type: 'ready' });
