import { afterEach, expect, it, vi } from 'vitest';
import { publicGalleryPhoto } from './publicGalleryPhoto';
import type { PublicGallerySession } from './publicGallerySession';

class Image extends EventTarget {
  src = '';
  srcset = '';
  currentSrc = '';
  complete = false;
  naturalWidth = 0;
  style = { visibility: '', opacity: '' };
  attributes = new Map<string, string>();
  decode = vi.fn().mockResolvedValue(undefined);
  getAttribute(key: string) {
    return this.attributes.get(key) ?? null;
  }
  setAttribute(key: string, value: string) {
    this.attributes.set(key, value);
  }
  removeAttribute(key: string) {
    this.attributes.delete(key);
  }
}
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
it('finishes a pending base copy when a hidden fullscreen slide becomes active', async () => {
  const node = new Image();
  let resolve!: (copy: { url: string }) => void;
  const promise = new Promise<{ url: string }>((done) => (resolve = done)),
    session = {
      attach() {},
      detach() {},
      hasCopy() {
        return false;
      },
      read: () => promise,
    };
  const action = publicGalleryPhoto(node as unknown as HTMLImageElement, {
    src: '/photo',
    session: session as unknown as PublicGallerySession,
    fullscreen: false,
  });
  action.update({
    src: '/photo',
    session: session as unknown as PublicGallerySession,
    fullscreen: true,
  });
  resolve({ url: 'blob:ready' });
  await vi.waitFor(() => expect(node.src).toBe('blob:ready'));
  action.destroy();
});

it('keeps the card preview visible while the authorized 1600 copy is acquired and decoded', async () => {
  const node = new Image();
  const remove = vi.fn(),
    append = vi.fn();
  Object.assign(node, { parentElement: { append } });
  vi.stubGlobal('document', {
    createElement: () => ({ style: {}, setAttribute: vi.fn(), remove }),
  });
  vi.stubGlobal('getComputedStyle', () => ({ objectFit: 'cover', objectPosition: 'center' }));
  let finish!: (value: { url: string }) => void;
  const pending = new Promise<{ url: string }>((resolve) => {
    finish = resolve;
  });
  let decoded!: () => void;
  node.decode.mockImplementation(
    () =>
      new Promise<void>((resolve) => {
        decoded = resolve;
      }),
  );
  const loading = vi.fn();
  const session = {
    attach: vi.fn(),
    detach: vi.fn(),
    preview: () => 'data:image/webp;base64,preview',
    read: vi.fn().mockReturnValue(pending),
  } as unknown as PublicGallerySession;
  const action = publicGalleryPhoto(node as unknown as HTMLImageElement, {
    src: '/photo?w=1600',
    session,
    onLoading: loading,
  });
  expect(append).toHaveBeenCalledOnce();
  expect(remove).not.toHaveBeenCalled();
  expect(loading).toHaveBeenLastCalledWith(false);
  finish({ url: 'blob:1600' });
  await pending;
  await Promise.resolve();
  expect(node.src).toBe('blob:1600');
  expect(remove).not.toHaveBeenCalled();
  decoded();
  await Promise.resolve();
  await Promise.resolve();
  expect(remove).toHaveBeenCalledOnce();
  action.destroy();
});

it('does not flash loading while decoding a photograph already retained in this visit', async () => {
  const node = new Image();
  const loading = vi.fn();
  const session = {
    attach: vi.fn(),
    detach: vi.fn(),
    discard: vi.fn(),
    hasCopy: vi.fn().mockReturnValue(true),
    read: vi.fn().mockResolvedValue({ url: 'blob:copy' }),
  } as unknown as PublicGallerySession;
  const action = publicGalleryPhoto(node as unknown as HTMLImageElement, {
    src: '/photo/1',
    session,
    onLoading: loading,
  });
  await Promise.resolve();
  await Promise.resolve();
  action.update({ src: '/photo/2', session, onLoading: loading });
  await Promise.resolve();
  await Promise.resolve();
  expect(loading).toHaveBeenCalled();
  expect(loading.mock.calls.every(([value]) => value === false)).toBe(true);
  action.destroy();
});

it('keeps loading through acquisition/decode and blanks a later local miss without assigning a network URL', async () => {
  const node = new Image();
  let finish!: (value: { url: string }) => void;
  const pending = new Promise<{ url: string }>((resolve) => {
    finish = resolve;
  });
  const session = {
    attach: vi.fn(),
    detach: vi.fn(),
    discard: vi.fn(),
    read: vi.fn().mockReturnValueOnce(pending).mockResolvedValue(undefined),
  } as unknown as PublicGallerySession;
  const loading = vi.fn();
  const action = publicGalleryPhoto(node as unknown as HTMLImageElement, {
    src: '/photo/1',
    session,
    onLoading: loading,
  });
  expect(loading).toHaveBeenLastCalledWith(true);
  expect(node.src).toBe('');
  finish({ url: 'blob:copy' });
  await pending;
  await Promise.resolve();
  expect(node.src).toBe('blob:copy');
  node.dispatchEvent(new Event('load'));
  await Promise.resolve();
  await Promise.resolve();
  expect(loading).toHaveBeenLastCalledWith(false);
  action.update({ src: '/photo/2', session, onLoading: loading });
  await Promise.resolve();
  await Promise.resolve();
  expect(node.style.visibility).toBe('hidden');
  expect(node.getAttribute('src')).toBeNull();
  expect(loading).toHaveBeenLastCalledWith(false);
  action.destroy();
  expect(session.detach).toHaveBeenCalledOnce();
});

it('can enter a gallery session after a photo-free placeholder without keeping native network navigation', async () => {
  const node = new Image();
  node.src = '/placeholder.svg';
  const action = publicGalleryPhoto(node as unknown as HTMLImageElement, { src: node.src });
  const session = {
    attach: vi.fn(),
    detach: vi.fn(),
    discard: vi.fn(),
    read: vi.fn().mockResolvedValue({ url: 'blob:new-gallery' }),
  } as unknown as PublicGallerySession;
  action.update({ src: '/public/1', session });
  await Promise.resolve();
  await Promise.resolve();
  expect(node.src).toBe('blob:new-gallery');
  expect(session.read).toHaveBeenCalledOnce();
  action.destroy();
});
