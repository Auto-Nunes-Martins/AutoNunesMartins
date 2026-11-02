import { afterEach, expect, it, vi } from 'vitest';
import { mobileCanvasFrame } from './mobileCanvasFrame';

afterEach(() => vi.unstubAllGlobals());
function setup(sources: { media: string }[] = []) {
  const values = new Map<string, string>([['left', '2px']]);
  const style = {
    getPropertyValue: (key: string) => values.get(key) ?? '',
    getPropertyPriority: () => '',
    setProperty: (key: string, value: string) => values.set(key, value),
    removeProperty: (key: string) => values.delete(key),
  };
  for (const key of ['left', 'top', 'width', 'height'])
    Object.defineProperty(style, key, {
      get: () => values.get(key),
      set: (value) => values.set(key, value),
    });
  let bounds = { left: 0, top: -31, width: 390, height: 712 };
  const read = vi.fn(() => bounds);
  const frame = mobileCanvasFrame({
    style,
    getBoundingClientRect: read,
    querySelectorAll: () => sources,
  } as unknown as HTMLElement);
  return { frame, values, read, resize: (next: typeof bounds) => (bounds = next) };
}

it('holds the height-dependent crop until width changes and restores native media on exit', () => {
  let matches = true;
  vi.stubGlobal('matchMedia', () => ({ matches }));
  const media = '(max-width:430px) and (min-height:700px)';
  const source = { media, srcset: 'portrait-675.avif 675w, portrait-1200.avif 1200w' };
  const { frame } = setup([source]);
  frame.prepare(true, 390, 390, 0);
  frame.capture();
  expect(source.media).toBe('all');
  matches = false;
  expect(frame.prepare(true, 390, 390, 0)).toBe(false);
  expect(source.media).toBe('all');
  frame.prepare(true, 844, 844, 90);
  expect(source.media).toBe(media);
  frame.capture();
  expect(source.media).toBe('not all');
  expect(source.srcset).toBe('portrait-675.avif 675w, portrait-1200.avif 1200w');
  frame.destroy();
  expect(source.media).toBe(media);
});

it('keeps the captured mobile frame when only toolbar height and CSS geometry change', () => {
  const { frame, values, read, resize } = setup();
  expect(frame.prepare(true, 390, 390, 0)).toBe(true);
  frame.capture();
  resize({ left: 0, top: -42, width: 390, height: 723 });
  expect(frame.prepare(true, 390, 390, 0)).toBe(false);
  expect(read).toHaveBeenCalledOnce();
  expect(values.get('height')).toBe('712px');
  expect(values.get('top')).toBe('-31px');
});

it('releases old dimensions before recapturing a width or physical orientation change', () => {
  const { frame, values, resize } = setup();
  frame.prepare(true, 390, 390, 0);
  frame.capture();
  resize({ left: 0, top: 0, width: 844, height: 650 });
  expect(frame.prepare(true, 844, 844, 90)).toBe(true);
  expect(values.get('height')).toBeUndefined();
  frame.capture();
  expect(values.get('width')).toBe('844px');
  expect(frame.prepare(true, 844, 844, 270)).toBe(true);
});

it('restores the CSS frame for desktop, reduced motion and destruction', () => {
  const { frame, values } = setup();
  expect(frame.prepare(false, 1440, 1440, 0)).toBe(false);
  frame.prepare(true, 390, 390, 0);
  frame.capture();
  expect(frame.prepare(false, 1440, 1440, 0)).toBe(false);
  expect(values.get('left')).toBe('2px');
  expect(values.get('height')).toBeUndefined();
  frame.prepare(true, 390, 390, 0);
  frame.capture();
  frame.destroy();
  expect(values.get('left')).toBe('2px');
  expect(values.get('height')).toBeUndefined();
});
