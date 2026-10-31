import { it, expect, vi } from 'vitest';
import sharp from 'sharp';
import { PhotoEncodingSession } from './photoEncodingSession';
import { optimizePhoto, MAX_UPLOAD_BYTES } from './photoOptimization';
import { buildPhotoVariants, encodeVariantManifest } from './photoVariantEncoding';
import type { UploadTrace } from '../../../../shared/runtimeDiagnostics.mjs';
import { readFile } from 'node:fs/promises';
const memory = vi.hoisted(() => ({ headroom: null as number | null }));
vi.mock('../../../../shared/containerMemory.mjs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../../shared/containerMemory.mjs')>();
  return {
    ...actual,
    createCgroupReader: () =>
      memory.headroom === null
        ? actual.createCgroupReader()
        : { read: () => ({ available: true, effectiveHeadroomBytes: memory.headroom }) },
  };
});
function telemetry() {
  const values: Record<string, number> = {};
  const trace: UploadTrace = {
    phase: vi.fn(),
    fields: (fields) => Object.assign(values, fields),
    finish: vi.fn(),
  };
  return { trace, values };
}
it('preserves photographic pixels, EXIF rotation and bytes through the same isolated recipe', async () => {
  const fixture = await readFile(
    new URL(
      '../../../../apps/website/static/images/about/auto-nunes-martins-fachada-v2-1024.jpg',
      import.meta.url,
    ),
  );
  const input = await sharp(fixture).jpeg().withMetadata({ orientation: 6 }).toBuffer();
  const inline = await optimizePhoto(input),
    expected = await buildPhotoVariants(inline.buffer);
  const { trace, values } = telemetry();
  const session = new PhotoEncodingSession(trace);
  try {
    const result = await session.optimize(input);
    expect(result).toEqual(inline);
    const built = await session.variants(result.buffer);
    expect(built.manifest).toEqual(expected.manifest);
    expect(built.files.map((f) => f.buffer)).toEqual(expected.files.map((f) => f.buffer));
  } finally {
    await session.close();
  }
  expect(values.workerRss).toBe(0);
  expect(values.workerExited).toBe(1);
}, 30000);
it('real isolated codec produces identical master, five variants and sidecar, reports memory, then exits', async () => {
  const input = await sharp({
    create: { width: 1976, height: 1476, channels: 3, background: '#42759d' },
  })
    .jpeg({ quality: 90 })
    .toBuffer();
  const inline = await optimizePhoto(input),
    expected = await buildPhotoVariants(inline.buffer);
  const { trace, values } = telemetry();
  const session = new PhotoEncodingSession(trace);
  try {
    const actual = await session.optimize(input);
    expect(actual).toEqual(inline);
    const variants = await session.variants(actual.buffer);
    expect(variants.manifest).toEqual(expected.manifest);
    expect(
      variants.files.map((f) =>
        f.buffer.equals(expected.files.find((e) => e.width === f.width)!.buffer),
      ),
    ).not.toContain(false);
    expect(variants.sidecar).toEqual(await encodeVariantManifest(expected.manifest));
    expect(variants.files).toHaveLength(5);
    expect(values.workerNoCredentials).toBe(1);
    expect(values.workerPeakRss).toBeGreaterThan(0);
    await session.close();
    expect(values.workerExited).toBe(1);
    expect(() => process.kill(values.workerPid!, 0)).toThrow();
    expect(trace.phase).toHaveBeenCalledWith('worker_exit');
  } finally {
    await session.close();
  }
}, 30000);
it('invalid input rejects with the bounded photo status and cleanup still waits for exit', async () => {
  const { trace, values } = telemetry();
  const session = new PhotoEncodingSession(trace);
  try {
    await expect(session.optimize(Buffer.from('not-an-image'))).rejects.toMatchObject({
      status: 422,
    });
  } finally {
    await session.close();
  }
  expect(values.workerExited).toBe(1);
});
it('rejects overlapping commands and oversized input, and aborts a pending process without keeping it alive', async () => {
  const { trace, values } = telemetry();
  const session = new PhotoEncodingSession(trace);
  try {
    await expect(session.optimize(Buffer.alloc(MAX_UPLOAD_BYTES + 1))).rejects.toMatchObject({
      status: 422,
    });
    const pending = session.optimize(Buffer.from('invalid'));
    const rejected = expect(pending).rejects.toMatchObject({ status: 502 });
    await expect(session.variants(Buffer.from('invalid'))).rejects.toMatchObject({ status: 422 });
    session.abort();
    await rejected;
  } finally {
    await session.close();
  }
  expect(values.workerExited).toBe(1);
});
it('terminates only its disposable child on cgroup pressure and releases the waiting request', async () => {
  memory.headroom = 0;
  const { trace, values } = telemetry();
  const session = new PhotoEncodingSession(trace);
  try {
    await expect(session.optimize(Buffer.from('invalid'))).rejects.toMatchObject({ status: 503 });
  } finally {
    await session.close();
    memory.headroom = null;
  }
  expect(values.workerMemoryGuard).toBe(1);
  expect(values.workerExited).toBe(1);
  expect(values.workerExitSignal).toBe(9);
});
