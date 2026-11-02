import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { reusablePhoto } from './reusablePhoto';

const photo = () => ({
  url: 'master',
  width: 2400,
  height: 1600,
  variants: [
    { url: 'small', width: 800, height: 533 },
    { url: 'large', width: 1600, height: 1067 },
  ],
});
let requested: string[];
let decode: (url: string) => Promise<void>;
let actions: ReturnType<typeof reusablePhoto>[];
class Picture extends EventTarget {
  naturalWidth = 2400;
  naturalHeight = 1600;
  complete = true;
  src = '';
  width = 400;
  inDialog = false;
  closest(selector: string) {
    return selector === 'dialog' && this.inDialog ? {} : null;
  }
  getBoundingClientRect() {
    return { width: this.width, height: this.width / 1.5 };
  }
  getAttribute(name: string) {
    return name === 'src' ? this.src : null;
  }
  removeAttribute() {}
  decode = vi.fn(async () => {});
}
const flush = async () => {
  for (let i = 0; i < 24; i++) await Promise.resolve();
};
function start(node: Picture, value = photo()) {
  const action = reusablePhoto(node as unknown as HTMLImageElement, { photo: value });
  actions.push(action);
  return action;
}
beforeEach(() => {
  requested = [];
  actions = [];
  decode = async () => {};
  vi.stubGlobal('window', Object.assign(new EventTarget(), { devicePixelRatio: 1 }));
  vi.stubGlobal('getComputedStyle', () => ({ objectFit: 'cover' }));
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
    },
  );
  vi.stubGlobal(
    'Image',
    class {
      naturalWidth = 2400;
      naturalHeight = 1600;
      url = '';
      set src(url: string) {
        this.url = url;
        this.naturalWidth = url.includes('small') ? 800 : url.includes('large') ? 1600 : 2400;
        this.naturalHeight = this.naturalWidth / 1.5;
        requested.push(url);
      }
      decode() {
        return decode(this.url);
      }
    },
  );
});
afterEach(() => {
  for (const action of actions) action.destroy();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it('does not begin a master fallback after the final consumer is destroyed', async () => {
  let fail!: () => void;
  decode = () =>
    new Promise((_, reject) => {
      fail = () => reject(Error('missing'));
    });
  const node = new Picture(),
    action = start(node);
  await flush();
  action.destroy();
  actions = [];
  fail();
  await flush();
  expect(requested).toEqual(['small']);
  expect(node.src).toBe('');
});

it('does not start queued initial work after immediate teardown', async () => {
  const action = start(new Picture());
  action.destroy();
  actions = [];
  await flush();
  expect(requested).toEqual([]);
});

it('shares the decoded master across failed candidates when resized', async () => {
  decode = async (url) => {
    if (url !== 'master') throw Error('missing derivative');
  };
  const node = new Picture();
  start(node);
  await flush();
  node.width = 1100;
  window.dispatchEvent(new Event('resize'));
  await flush();
  expect(requested).toEqual(['small', 'master', 'large']);
  expect(node.src).toBe('master');
  expect(node.decode).toHaveBeenCalledTimes(1);
});

it('keeps shared work alive when another consumer remains', async () => {
  let fail!: () => void;
  decode = (url) =>
    url === 'small'
      ? new Promise((_, reject) => {
          fail = () => reject(Error('missing'));
        })
      : Promise.resolve();
  const value = photo(),
    first = new Picture(),
    second = new Picture();
  const one = start(first, value);
  start(second, value);
  await flush();
  one.destroy();
  actions = actions.filter((a) => a !== one);
  fail();
  await flush();
  expect(requested).toEqual(['small', 'master']);
  expect(first.src).toBe('');
  expect(second.src).toBe('master');
});

it('allows a new mounted group to recover from a previous failed group', async () => {
  const value = photo();
  decode = async () => {
    throw Error('temporary failure');
  };
  const first = start(new Picture(), value);
  await flush();
  first.destroy();
  actions = [];
  decode = async () => {};
  const second = new Picture();
  start(second, value);
  await flush();
  expect(requested).toEqual(['small', 'master', 'small']);
  expect(second.src).toBe('small');
});

it('does not reuse a previous identity or let its late failure start a fallback', async () => {
  let fail!: () => void;
  decode = (url) =>
    url === 'small'
      ? new Promise((_, reject) => {
          fail = () => reject(Error('expired'));
        })
      : Promise.resolve();
  const value = photo(),
    node = new Picture(),
    action = start(node, value);
  await flush();
  value.url = 'new-master';
  value.variants = [{ url: 'new-small', width: 800, height: 533 }];
  action.update({ photo: value });
  await flush();
  fail();
  await flush();
  expect(requested).toEqual(['small', 'new-small']);
  expect(node.src).toBe('new-small');
});

it('retains one shared local blob retry and cancels it on teardown', async () => {
  vi.useFakeTimers();
  decode = async () => {
    throw Error('transient local decode');
  };
  const value = { url: 'blob:local', width: 2400, height: 1600, variants: [] };
  const first = start(new Picture(), value);
  start(new Picture(), value);
  await flush();
  await vi.advanceTimersByTimeAsync(50);
  await flush();
  expect(requested).toEqual(['blob:local', 'blob:local']);
  for (const action of actions) action.destroy();
  actions = [];
  const next = start(new Picture(), value);
  await flush();
  next.destroy();
  actions = [];
  await vi.advanceTimersByTimeAsync(50);
  await flush();
  expect(requested).toEqual(['blob:local', 'blob:local', 'blob:local']);
});

it('allows the bounded blob retry to recover', async () => {
  vi.useFakeTimers();
  let attempts = 0;
  decode = async () => {
    if (++attempts === 1) throw Error('transient');
  };
  const node = new Picture();
  start(node, { url: 'blob:ready', width: 2400, height: 1600, variants: [] });
  await flush();
  await vi.advanceTimersByTimeAsync(50);
  await flush();
  expect(requested).toEqual(['blob:ready', 'blob:ready']);
  expect(node.src).toBe('blob:ready');
});

it('keeps a useful fullscreen upgrade and reuses it on the next resize', async () => {
  const node = new Picture(),
    value = photo();
  node.inDialog = true;
  node.width = 1200;
  const action = reusablePhoto(node as unknown as HTMLImageElement, {
    photo: value,
    fullscreen: true,
  });
  actions.push(action);
  await flush();
  expect(requested).toEqual(['small', 'large']);
  expect(node.src).toBe('large');
  window.dispatchEvent(new Event('resize'));
  await flush();
  expect(requested).toEqual(['small', 'large']);
  expect(node.src).toBe('large');
});
