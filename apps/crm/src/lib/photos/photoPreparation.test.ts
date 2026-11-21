import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const fake = vi.hoisted(() => {
  type Data = {
    unchanged?: boolean;
    file?: File;
    error?: string;
    metrics?: Record<string, number>;
  };
  const workers: WorkerMock[] = [];
  class WorkerMock {
    onmessage?: (event: { data: Data }) => void;
    onerror?: () => void;
    postMessage = vi.fn();
    terminate = vi.fn();
    constructor() {
      workers.push(this);
    }
  }
  return { workers, WorkerMock };
});
vi.mock('./photoPreparation.worker?worker', () => ({ default: fake.WorkerMock }));
import { preparePhoto } from './photoPreparation';
const input = () => new File(['original'], 'original.png', { type: 'image/png' });
const flush = async () => {
  for (let i = 0; i < 12; i++) await Promise.resolve();
};
beforeEach(() => {
  fake.workers.length = 0;
  vi.clearAllMocks();
});
afterEach(() => vi.useRealTimers());

it('returns the exact original File only for explicit validated passthrough ', async () => {
  const original = input(),
    pending = preparePhoto(original);
  await flush();
  const worker = fake.workers[0]!;
  worker.onmessage?.({
    data: { unchanged: true },
  });
  expect(await pending).toBe(original);
  expect(worker.postMessage).toHaveBeenCalledWith(original);
  expect(worker.terminate).toHaveBeenCalledTimes(1);
});

it('keeps converted output even when size/name/type happen to match', async () => {
  const original = input(),
    converted = input(),
    pending = preparePhoto(original);
  await flush();
  fake.workers[0]!.onmessage?.({ data: { file: converted } });
  expect(await pending).toBe(converted);
  expect(converted).not.toBe(original);
});

it('cancels in-flight work, ignores a late reply, and allows the queued file to proceed', async () => {
  const controller = new AbortController();
  const first = preparePhoto(input(), controller.signal);
  const failed = expect(first).rejects.toMatchObject({ name: 'AbortError' });
  const original = input(),
    second = preparePhoto(original);
  await flush();
  const old = fake.workers[0]!;
  controller.abort();
  await failed;
  await flush();
  old.onmessage?.({ data: { unchanged: true } });
  fake.workers[1]!.onmessage?.({ data: { unchanged: true } });
  expect(await second).toBe(original);
  expect(old.terminate).toHaveBeenCalledTimes(1);
});

it('does not start a worker for an already cancelled request', async () => {
  const controller = new AbortController();
  controller.abort();
  await expect(preparePhoto(input(), controller.signal)).rejects.toMatchObject({
    name: 'AbortError',
  });
  expect(fake.workers).toHaveLength(0);
});

it('keeps worker failures and timeout terminal and releases the worker', async () => {
  vi.useFakeTimers();
  const pending = preparePhoto(input());
  const failed = expect(pending).rejects.toThrow('demorou demasiado');
  await flush();
  await vi.advanceTimersByTimeAsync(120000);
  await failed;
  expect(fake.workers[0]!.terminate).toHaveBeenCalledTimes(1);
  const next = preparePhoto(input());
  const invalid = expect(next).rejects.toThrow('invalid');
  await flush();
  fake.workers[1]!.onmessage?.({ data: { error: 'invalid', unchanged: true } });
  await invalid;
});
