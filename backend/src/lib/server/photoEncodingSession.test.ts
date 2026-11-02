import { it, expect, vi } from 'vitest';
import sharp from 'sharp';
const workers = vi.hoisted(() => ({
  children: [] as import('node:child_process').ChildProcess[],
  environments: [] as NodeJS.ProcessEnv[],
}));
vi.mock('node:child_process', async (original) => {
  const actual = await original<typeof import('node:child_process')>();
  return {
    ...actual,
    spawn: (file: string, args: string[], options: import('node:child_process').SpawnOptions) => {
      const child = actual.spawn(file, args, options);
      workers.children.push(child);
      workers.environments.push(options.env ?? {});
      return child;
    },
  };
});
import { PhotoEncodingSession } from './photoEncodingSession';
import { optimizePhoto, MAX_UPLOAD_BYTES } from './photoOptimization';
import { buildPhotoVariants, encodeVariantManifest } from './photoVariantEncoding';
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

  const session = new PhotoEncodingSession();
  const child = workers.children.at(-1)!;
  expect(
    Object.keys(workers.environments.at(-1)!).some((key) =>
      /DATABASE|DIRECT_URL|SUPABASE|CLERK|SECRET|TOKEN|PASSWORD/.test(key),
    ),
  ).toBe(false);
  try {
    const result = await session.optimize(input);
    expect(result).toEqual(inline);
    const built = await session.variants(result.buffer);
    expect(built.manifest).toEqual(expected.manifest);
    expect(built.files.map((f) => f.buffer)).toEqual(expected.files.map((f) => f.buffer));
  } finally {
    await session.close();
    expect(child.exitCode !== null || child.signalCode !== null).toBe(true);
  }
}, 30000);
it('real isolated codec produces identical master, five variants and sidecar, then exits', async () => {
  const input = await sharp({
    create: { width: 1976, height: 1476, channels: 3, background: '#42759d' },
  })
    .jpeg({ quality: 90 })
    .toBuffer();
  const inline = await optimizePhoto(input),
    expected = await buildPhotoVariants(inline.buffer);

  const session = new PhotoEncodingSession();
  const child = workers.children.at(-1)!;
  expect(
    Object.keys(workers.environments.at(-1)!).some((key) =>
      /DATABASE|DIRECT_URL|SUPABASE|CLERK|SECRET|TOKEN|PASSWORD/.test(key),
    ),
  ).toBe(false);
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

    await session.close();
    expect(child.exitCode !== null || child.signalCode !== null).toBe(true);
  } finally {
    await session.close();
    expect(child.exitCode !== null || child.signalCode !== null).toBe(true);
  }
}, 30000);
it('invalid input rejects with the bounded photo status and cleanup still waits for exit', async () => {
  const session = new PhotoEncodingSession();
  const child = workers.children.at(-1)!;
  expect(
    Object.keys(workers.environments.at(-1)!).some((key) =>
      /DATABASE|DIRECT_URL|SUPABASE|CLERK|SECRET|TOKEN|PASSWORD/.test(key),
    ),
  ).toBe(false);
  try {
    await expect(session.optimize(Buffer.from('not-an-image'))).rejects.toMatchObject({
      status: 422,
    });
  } finally {
    await session.close();
    expect(child.exitCode !== null || child.signalCode !== null).toBe(true);
  }
});
it('rejects overlapping commands and oversized input, and aborts a pending process without keeping it alive', async () => {
  const session = new PhotoEncodingSession();
  const child = workers.children.at(-1)!;
  expect(
    Object.keys(workers.environments.at(-1)!).some((key) =>
      /DATABASE|DIRECT_URL|SUPABASE|CLERK|SECRET|TOKEN|PASSWORD/.test(key),
    ),
  ).toBe(false);
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
    expect(child.exitCode !== null || child.signalCode !== null).toBe(true);
  }
});
it('terminates only its disposable child on cgroup pressure and releases the waiting request', async () => {
  memory.headroom = 0;

  const session = new PhotoEncodingSession();
  const child = workers.children.at(-1)!;
  expect(
    Object.keys(workers.environments.at(-1)!).some((key) =>
      /DATABASE|DIRECT_URL|SUPABASE|CLERK|SECRET|TOKEN|PASSWORD/.test(key),
    ),
  ).toBe(false);
  try {
    await expect(session.optimize(Buffer.from('invalid'))).rejects.toMatchObject({ status: 503 });
  } finally {
    await session.close();
    expect(child.exitCode !== null || child.signalCode !== null).toBe(true);
    memory.headroom = null;
  }
});
