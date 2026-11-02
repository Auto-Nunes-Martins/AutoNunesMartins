import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { coverPhotoSizes } from './coverPhotoSizes';
import { scrollFrame } from './components/stand-concepts/scrollFrame';
import { cardPhotoSet } from './vehiclePhotoSources';

const photo = (version = 'a') => `/viaturas/car-012345abcdef/photos/0?v=${version.repeat(64)}`;
const candidates = (source: string) => cardPhotoSet(source)!;
class Image extends EventTarget {
  src = photo() + '&w=800';
  srcset = candidates(photo());
  currentSrc = photo() + '&w=1280';
  complete = true;
  naturalWidth = 654;
  naturalHeight = 218;
  bounds = { width: 639.035095, height: 372.535339 };
  value = '100vw';
  writes = 0;
  get sizes() {
    return this.value;
  }
  set sizes(value: string) {
    this.writes++;
    this.value = value;
  }
  getAttribute(name: string) {
    return name === 'src' ? this.src : null;
  }
  getBoundingClientRect() {
    return this.bounds;
  }
}
let frames: Map<number, FrameRequestCallback>;
let frameId: number;
let actions: ReturnType<typeof coverPhotoSizes>[];
let resize: () => void;
let disconnect: ReturnType<typeof vi.fn>;
function flush() {
  const pending = [...frames.values()];
  frames.clear();
  for (const callback of pending) callback(0);
}
function start(node: Image, hint?: Parameters<typeof coverPhotoSizes>[1]) {
  const action = coverPhotoSizes(node as unknown as HTMLImageElement, hint);
  actions.push(action);
  return action;
}
beforeEach(() => {
  frames = new Map();
  frameId = 0;
  actions = [];
  disconnect = vi.fn();
  vi.stubGlobal('window', new EventTarget());
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    frames.set(++frameId, callback);
    return frameId;
  });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id));
  vi.stubGlobal('getComputedStyle', () => ({ objectFit: 'cover' }));
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(callback: () => void) {
        resize = callback;
      }
      observe() {}
      disconnect = disconnect;
    },
  );
});
afterEach(() => {
  for (const action of actions) action.destroy();
  vi.unstubAllGlobals();
});

describe('cover photo resource sizing', () => {
  it('does not feed density-rounded natural sizes back into repeated loads', () => {
    const node = new Image();
    start(node);
    flush();
    const first = node.sizes;
    expect(Number.parseFloat(first)).toBeGreaterThanOrEqual(node.bounds.height * 3);
    for (let n = 0; n < 20; n++) {
      node.naturalWidth = n % 2 ? 1118 : 1119;
      node.naturalHeight = n % 2 ? 372 : 373;
      node.dispatchEvent(new Event('load'));
      flush();
      expect(node.sizes).toBe(first);
    }
    expect(node.writes).toBe(1);
  });

  it('uses matching canonical dimensions before decode and keeps measuring real resizes', () => {
    const node = new Image();
    node.complete = false;
    node.naturalWidth = node.naturalHeight = 0;
    start(node, {
      source: photo(),
      dimensions: { version: 'a'.repeat(64), width: 3072, height: 1024 },
    });
    flush();
    expect(node.sizes).toBe('1118px');
    node.complete = true;
    node.naturalWidth = 1118;
    node.naturalHeight = 372;
    node.dispatchEvent(new Event('load'));
    flush();
    expect(node.writes).toBe(1);
    node.bounds = { width: 1000, height: 580 };
    resize();
    flush();
    expect(node.sizes).toBe('1740px');
  });

  it.each(['version', 'source', 'dimensions', 'srcset'] as const)(
    'ignores a mismatched %s hint',
    (kind) => {
      const node = new Image();
      if (kind === 'srcset') node.srcset = candidates(photo('b'));
      const hint = {
        source: kind === 'source' ? photo('b') : photo(),
        dimensions: {
          version: (kind === 'version' ? 'b' : 'a').repeat(64),
          width: 9999,
          height: kind === 'dimensions' ? 0 : 1,
        },
      };
      start(node, hint);
      flush();
      expect(Number.parseFloat(node.sizes)).toBeLessThan(1200);
    },
  );

  it.each(['source', 'srcset'] as const)('forgets the previous ratio when %s changes', (change) => {
    const node = new Image();
    const action = start(node);
    flush();
    if (change === 'source') node.src = photo('b') + '&w=800';
    node.srcset = candidates(photo('b'));
    node.complete = false;
    node.value = '100vw';
    action.update();
    flush();
    expect(node.sizes).toBe('100vw');
    node.complete = true;
    node.naturalWidth = 640;
    node.naturalHeight = 1280;
    node.dispatchEvent(new Event('load'));
    flush();
    expect(node.sizes).toBe('640px');
  });

  it('does not use a placeholder or failed image as the next real photo ratio', () => {
    const node = new Image();
    start(node);
    flush();
    node.dispatchEvent(new Event('error'));
    node.src = '/placeholder.svg';
    node.srcset = '';
    node.naturalWidth = node.naturalHeight = 10;
    node.value = '100vw';
    node.dispatchEvent(new Event('load'));
    flush();
    expect(node.sizes).toBe('100vw');
    node.src = photo('b') + '&w=800';
    node.srcset = candidates(photo('b'));
    node.naturalWidth = 600;
    node.naturalHeight = 1200;
    node.dispatchEvent(new Event('load'));
    flush();
    expect(node.sizes).toBe('640px');
  });

  it('waits for the real picture source instead of sampling a temporary data placeholder', () => {
    const node = new Image();
    node.currentSrc = 'data:image/svg+xml,placeholder';
    node.naturalWidth = node.naturalHeight = 10;
    start(node);
    flush();
    node.dispatchEvent(new Event('load'));
    flush();
    expect(node.writes).toBe(0);
    node.currentSrc = photo() + '&w=1280';
    node.naturalWidth = 654;
    node.naturalHeight = 218;
    node.dispatchEvent(new Event('load'));
    flush();
    expect(Number.parseFloat(node.sizes)).toBeGreaterThanOrEqual(node.bounds.height * 3);
  });

  it('discards a queued size write if another read changes the resource', () => {
    const node = new Image();
    start(node);
    const replace = scrollFrame(() => {
      node.src = photo('b') + '&w=800';
    });
    replace.schedule();
    flush();
    expect(node.writes).toBe(0);
    replace.cancel();
  });

  it('cleans up pending reads and listeners', () => {
    const node = new Image();
    const action = start(node);
    action.destroy();
    actions = [];
    node.dispatchEvent(new Event('load'));
    window.dispatchEvent(new Event('resize'));
    flush();
    expect(disconnect).toHaveBeenCalledOnce();
    expect(node.writes).toBe(0);
  });
});
