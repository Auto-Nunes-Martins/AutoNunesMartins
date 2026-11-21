import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type {} from './photoPreparation.worker';
let width: number, height: number;
let closed: ReturnType<typeof vi.fn>;
let messages: Record<string, unknown>[];
let worker: {
  onmessage?: (event: { data: File }) => Promise<void>;
  postMessage: (value: Record<string, unknown>) => void;
};
beforeEach(async () => {
  vi.resetModules();
  width = 320;
  height = 200;
  closed = vi.fn();
  messages = [];
  worker = { postMessage: (value) => messages.push(value) };
  vi.stubGlobal('self', worker);
  vi.stubGlobal('createImageBitmap', async () => ({ width, height, close: closed }));
  vi.stubGlobal(
    'OffscreenCanvas',
    class {
      constructor(
        public width: number,
        public height: number,
      ) {}
      getContext() {
        return { fillRect() {}, drawImage() {}, fillStyle: '' };
      }
      async convertToBlob() {
        return new Blob(['converted'], { type: 'image/jpeg' });
      }
    },
  );
  await import('./photoPreparation.worker');
});
afterEach(() => vi.unstubAllGlobals());

it('signals passthrough only after bitmap validation ', async () => {
  width = 200;
  height = 320;
  const original = new File(['bytes'], 'portrait.jpg', { type: 'image/jpeg' });
  await worker.onmessage!({ data: original });
  expect(messages[0]).toMatchObject({
    unchanged: true,
  });
  expect(messages[0]).not.toHaveProperty('file');
  expect(closed).toHaveBeenCalledTimes(1);
});

it.each(['heic', 'pixels', 'bytes'])(
  'keeps the existing conversion path for %s',
  async (reason) => {
    const original = new File(['bytes'], reason === 'heic' ? 'photo.heic' : 'photo.png', {
      type: reason === 'heic' ? 'image/heic' : 'image/png',
    });
    if (reason === 'pixels') {
      width = 6000;
      height = 5000;
    }
    if (reason === 'bytes')
      Object.defineProperty(original, 'size', { value: 20 * 1024 * 1024 + 1 });
    await worker.onmessage!({ data: original });
    expect(messages[0]).not.toHaveProperty('unchanged');
    expect(messages[0]?.file).toBeInstanceOf(File);
    expect((messages[0]?.file as File).type).toBe('image/jpeg');
    expect(closed).toHaveBeenCalledTimes(1);
  },
);

it('rejects oversized decoded images instead of marking them unchanged', async () => {
  width = 10000;
  height = 6000;
  await worker.onmessage!({ data: new File(['bytes'], 'big.png', { type: 'image/png' }) });
  expect(messages[0]?.error).toContain('50 megapíxeis');
  expect(messages[0]).not.toHaveProperty('unchanged');
  expect(closed).toHaveBeenCalledTimes(1);
});
