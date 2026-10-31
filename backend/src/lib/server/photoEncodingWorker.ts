// Disposable codec process. No database, Storage, dotenv or application imports.
import { writeFileSync } from 'node:fs';
import sharp from 'sharp';
import { optimizePhoto, PhotoUploadError, MAX_UPLOAD_BYTES } from './photoOptimization.js';
import { buildPhotoVariants, encodeVariantManifest } from './photoVariantEncoding.js';
import type { UploadTrace } from '../../../../shared/runtimeDiagnostics.mjs';
const MAX_RESULT_BYTES = 16 * 1024 * 1024;
let busy = false,
  jobs = 0,
  oomPriorityAdjusted = false;
globalThis.fetch = async () => {
  throw Error('Network unavailable in photo codec process');
};
if (process.platform === 'linux') {
  try {
    writeFileSync('/proc/self/oom_score_adj', '500');
    oomPriorityAdjusted = true;
  } catch {
    /* Observe failure; do not require elevated permissions. */
  }
}
const send = (message: object) => {
  if (process.connected) process.send?.(message, () => {});
};
function sample() {
  const memory = process.memoryUsage(),
    cpu = process.cpuUsage();
  send({
    type: 'sample',
    metrics: {
      workerPid: process.pid,
      workerRss: memory.rss,
      workerPeakRss: process.resourceUsage().maxRSS * 1024,
      workerHeapUsed: memory.heapUsed,
      workerExternal: memory.external,
      workerArrayBuffers: memory.arrayBuffers,
      workerCpuUserUs: cpu.user,
      workerCpuSystemUs: cpu.system,
      workerProcessing: sharp.counters().process,
      workerQueue: sharp.counters().queue,
      workerOomPriorityAdjusted: Number(oomPriorityAdjusted),
      workerNoCredentials: Number(
        !Object.keys(process.env).some((k) =>
          /DATABASE|DIRECT_URL|SUPABASE|CLERK|SECRET|TOKEN|PASSWORD/.test(k),
        ),
      ),
      workerNodeMajor: Number(process.versions.node.split('.')[0]),
    },
  });
}
const trace: UploadTrace = {
  phase: (name, metrics) => send({ type: 'phase', name, metrics }),
  fields: (metrics) => send({ type: 'fields', metrics }),
  finish: () => {},
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
    !['optimize', 'variants'].includes(request.kind ?? '') ||
    busy ||
    ++jobs > 2
  ) {
    send({ type: 'failure', id: request.id, status: 422 });
    return;
  }
  busy = true;
  sample();
  const timer = setInterval(sample, 100);
  timer.unref();
  try {
    let result: unknown;
    if (request.kind === 'optimize') result = await optimizePhoto(request.input, trace);
    else {
      trace.phase('variant_encode');
      const built = await buildPhotoVariants(request.input);
      const sidecar = await encodeVariantManifest(built.manifest);
      if (built.files.reduce((sum, f) => sum + f.buffer.length, sidecar.length) > MAX_RESULT_BYTES)
        throw new PhotoUploadError(
          422,
          'Os tamanhos da fotografia excedem o limite de processamento.',
        );
      result = { ...built, sidecar };
    }
    sample();
    send({ type: 'result', id: request.id, result });
  } catch (error) {
    sample();
    send({
      type: 'failure',
      id: request.id,
      status: error instanceof PhotoUploadError ? error.status : 422,
    });
  } finally {
    clearInterval(timer);
    busy = false;
  }
});
send({ type: 'ready' });
