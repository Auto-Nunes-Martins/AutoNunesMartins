import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const codec = vi.hoisted(() => ({
  inline: vi.fn(),
  avatar: vi.fn(),
  close: vi.fn(),
  created: vi.fn(),
}));
vi.mock('./reviewAvatar.js', () => ({ normalizeReviewAvatar: codec.inline }));
vi.mock('./photoEncodingSession.js', () => ({
  PhotoEncodingSession: class {
    constructor() {
      codec.created();
    }
    avatar = codec.avatar;
    close = codec.close;
  },
}));
import { processReviewAvatar } from './reviewAvatarProcessor';

const input = Buffer.from('synthetic-input');
const result = { avatarData: Buffer.from('synthetic-output'), avatarVersion: 'fixture' };
beforeEach(() => {
  vi.resetAllMocks();
  codec.inline.mockResolvedValue(result);
  codec.avatar.mockResolvedValue(result);
  codec.close.mockResolvedValue(undefined);
  vi.stubEnv('PHOTO_PROCESSING_MODE', '');
});
afterEach(() => vi.unstubAllEnvs());

it('keeps the existing inline recipe in local development', async () => {
  vi.stubEnv('NODE_ENV', 'development');
  expect(await processReviewAvatar(input)).toBe(result);
  expect(codec.inline).toHaveBeenCalledWith(input);
  expect(codec.created).not.toHaveBeenCalled();
});

it('waits for worker closure before making a successful production result available', async () => {
  vi.stubEnv('NODE_ENV', 'production');
  let close!: () => void;
  codec.close.mockReturnValue(new Promise<void>((resolve) => (close = resolve)));
  let completed = false;
  const pending = processReviewAvatar(input).then((value) => {
    completed = true;
    return value;
  });
  await vi.waitFor(() => expect(codec.close).toHaveBeenCalledOnce());
  expect(completed).toBe(false);
  expect(codec.inline).not.toHaveBeenCalled();
  close();
  expect(await pending).toBe(result);
  expect(codec.avatar).toHaveBeenCalledWith(input);
});

it.each([422, 502, 503, 504])(
  'closes a failed worker (%i) without retrying a parent decode',
  async (status) => {
    vi.stubEnv('NODE_ENV', 'production');
    const failure = Object.assign(new Error('synthetic failure'), { status });
    codec.avatar.mockRejectedValue(failure);
    await expect(processReviewAvatar(input)).rejects.toBe(failure);
    expect(codec.close).toHaveBeenCalledOnce();
    expect(codec.inline).not.toHaveBeenCalled();
  },
);

it('honours only the existing explicit inline override in production', async () => {
  vi.stubEnv('NODE_ENV', 'production');
  vi.stubEnv('PHOTO_PROCESSING_MODE', 'inline');
  expect(await processReviewAvatar(input)).toBe(result);
  expect(codec.inline).toHaveBeenCalledOnce();
  expect(codec.created).not.toHaveBeenCalled();
});
