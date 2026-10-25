import { afterEach, expect, it, vi } from 'vitest';
import { publicGalleryPhoto } from './publicGalleryPhoto';
import type { PublicGallerySession } from './publicGallerySession';

class Image extends EventTarget {
  src = ''; srcset = ''; currentSrc = ''; complete = false; naturalWidth = 0;
  style = { visibility: '', opacity: '' };
  attributes = new Map<string, string>();
  decode = vi.fn().mockResolvedValue(undefined);
  getAttribute(key: string) { return this.attributes.get(key) ?? null; }
  setAttribute(key: string, value: string) { this.attributes.set(key, value); }
  removeAttribute(key: string) { this.attributes.delete(key); }
}
afterEach(() => vi.restoreAllMocks());

it('does not flash loading while decoding a photograph already retained in this visit', async () => {
  const node = new Image();
  const loading = vi.fn();
  const session = { attach: vi.fn(), detach: vi.fn(), discard: vi.fn(), hasCopy: vi.fn().mockReturnValue(true), read: vi.fn().mockResolvedValue({ url: 'blob:copy' }) } as unknown as PublicGallerySession;
  const action = publicGalleryPhoto(node as unknown as HTMLImageElement, { src: '/photo/1', session, onLoading: loading });
  await Promise.resolve(); await Promise.resolve();
  action.update({ src: '/photo/2', session, onLoading: loading });
  await Promise.resolve(); await Promise.resolve();
  expect(loading).toHaveBeenCalled();
  expect(loading.mock.calls.every(([value]) => value === false)).toBe(true);
  action.destroy();
});

it('keeps loading through acquisition/decode and blanks a later local miss without assigning a network URL', async () => {
  const node = new Image();
  let finish!: (value: { url: string }) => void;
  const pending = new Promise<{ url: string }>(resolve => { finish = resolve; });
  const session = { attach: vi.fn(), detach: vi.fn(), discard: vi.fn(), read: vi.fn().mockReturnValueOnce(pending).mockResolvedValue(undefined) } as unknown as PublicGallerySession;
  const loading = vi.fn();
  const action = publicGalleryPhoto(node as unknown as HTMLImageElement, { src: '/photo/1', session, onLoading: loading });
  expect(loading).toHaveBeenLastCalledWith(true);
  expect(node.src).toBe('');
  finish({ url: 'blob:copy' });
  await pending; await Promise.resolve();
  expect(node.src).toBe('blob:copy');
  node.dispatchEvent(new Event('load'));
  await Promise.resolve(); await Promise.resolve();
  expect(loading).toHaveBeenLastCalledWith(false);
  action.update({ src: '/photo/2', session, onLoading: loading });
  await Promise.resolve(); await Promise.resolve();
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
  const session = { attach: vi.fn(), detach: vi.fn(), discard: vi.fn(), read: vi.fn().mockResolvedValue({ url: 'blob:new-gallery' }) } as unknown as PublicGallerySession;
  action.update({ src: '/public/1', session });
  await Promise.resolve(); await Promise.resolve();
  expect(node.src).toBe('blob:new-gallery');
  expect(session.read).toHaveBeenCalledOnce();
  action.destroy();
});
