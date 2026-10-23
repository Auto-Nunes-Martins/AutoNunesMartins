import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { coverPhotoSizes } from './coverPhotoSizes';

describe('cover photo resolution', () => {
  let frame: FrameRequestCallback | undefined;
  let resize: ResizeObserverCallback;
  let disconnected: boolean;
  class Image extends EventTarget {
    srcset = '/small 384w, /large 800w';
    naturalWidth = 800;
    naturalHeight = 400;
    sizes = '100vw';
    width = 342;
    height = 304;
    getBoundingClientRect() { return { width: this.width, height: this.height }; }
  }
  const flush = () => { const next = frame; frame = undefined; next?.(0); };
  beforeEach(() => {
    disconnected = false;
    vi.stubGlobal('window', new EventTarget());
    vi.stubGlobal('getComputedStyle', () => ({ objectFit: 'cover' }));
    vi.stubGlobal('requestAnimationFrame', (next: FrameRequestCallback) => { frame = next; return 1; });
    vi.stubGlobal('cancelAnimationFrame', () => { frame = undefined; });
    vi.stubGlobal('ResizeObserver', class {
      constructor(callback: ResizeObserverCallback) { resize = callback; }
      observe() {}
      disconnect() { disconnected = true; }
    });
  });
  afterEach(() => vi.unstubAllGlobals());
  it('accounts for the cropped height instead of serving only the card width', () => {
    const image = new Image();
    const action = coverPhotoSizes(image as unknown as HTMLImageElement);
    flush();
    expect(image.sizes).toBe('608px');
    image.height = 200;
    resize([], {} as ResizeObserver);
    flush();
    expect(image.sizes).toBe('400px');
    action.destroy();
  });
  it('recalculates after changing to a photo with a different aspect ratio', () => {
    const image = new Image();
    const action = coverPhotoSizes(image as unknown as HTMLImageElement);
    flush();
    image.naturalHeight = 800;
    image.dispatchEvent(new Event('load'));
    flush();
    expect(image.sizes).toBe('342px');
    action.destroy();
  });
  it('leaves placeholders and not-yet-decoded images alone', () => {
    const image = new Image();
    image.naturalWidth = 0;
    const action = coverPhotoSizes(image as unknown as HTMLImageElement);
    flush();
    expect(image.sizes).toBe('100vw');
    image.naturalWidth = 800;
    image.srcset = '';
    image.dispatchEvent(new Event('load'));
    flush();
    expect(image.sizes).toBe('100vw');
    action.destroy();
  });
  it('cancels pending work and removes resize/load observers on teardown', () => {
    const image = new Image();
    const action = coverPhotoSizes(image as unknown as HTMLImageElement);
    action.destroy();
    flush();
    image.dispatchEvent(new Event('load'));
    window.dispatchEvent(new Event('resize'));
    expect(frame).toBeUndefined();
    expect(disconnected).toBe(true);
    expect(image.sizes).toBe('100vw');
  });
});
