import { afterEach, describe, expect, it, vi } from 'vitest';
import { catalogPlaceholder } from './localAssets';
import { vehiclePhoto } from './vehiclePhoto';

// Exercise real event dispatch without requiring a browser for the action's state.
class ImageNode extends EventTarget {
  src = '/viaturas/car-abcdef123456/photos/0';
  complete = false;
  naturalWidth = 0;
  attributes = new Map<string, string>();
  setAttribute(name: string, value: string) {
    this.attributes.set(name, value);
  }
  removeAttribute(name: string) {
    this.attributes.delete(name);
  }
  asImage() {
    return this as unknown as HTMLImageElement;
  }
}

describe('vehicle photo fallback', () => {
  afterEach(() => vi.unstubAllGlobals());

  function fadingImage() {
    vi.stubGlobal('matchMedia', () => ({ matches: false }));
    vi.stubGlobal('getComputedStyle', () => ({ objectFit: 'cover', objectPosition: '50% 50%' }));
    const background = new Map<string, string>();
    const parentElement = {
      style: {
        getPropertyValue: (key: string) => background.get(key) ?? '',
        getPropertyPriority: () => '',
        setProperty: (key: string, value: string) => background.set(key, value),
        removeProperty: (key: string) => background.delete(key),
      },
    };
    const cancel = vi.fn();
    let finish!: () => void;
    const finished = new Promise<void>((resolve) => {
      finish = resolve;
    });
    const animate = vi.fn(() => ({ cancel, finished }));
    const node = Object.assign(new ImageNode(), {
      animate,
      parentElement,
      style: { opacity: '' },
      complete: true,
      naturalWidth: 800,
    });
    return { node, background, cancel, animate, finish, finished };
  }

  it('dissolves over the previous decoded photo without exposing the page background', async () => {
    const { node, background, animate, finish, finished } = fadingImage();
    const action = vehiclePhoto(node.asImage(), { src: node.src, fade: true });
    const previous = node.src;
    node.complete = false;
    action.update({ src: '/next.webp', fade: true });
    expect(background.get('background-image')).toContain(previous);
    expect(node.style.opacity).toBe('0');
    node.dispatchEvent(new Event('load'));
    expect(animate).toHaveBeenCalledWith([{ opacity: 0 }, { opacity: 1 }], expect.any(Object));
    expect(node.style.opacity).toBe('1');
    finish();
    await finished;
    expect(background.size).toBe(0);
    expect(node.style.opacity).toBe('');
    action.destroy();
  });

  it('never starts a stale fade after rapid selection and teardown', async () => {
    const { node, animate, background } = fadingImage();
    let finish!: () => void;
    const decoding = new Promise<void>((resolve) => {
      finish = resolve;
    });
    Object.assign(node, { decode: () => decoding });
    const action = vehiclePhoto(node.asImage(), { src: node.src, fade: true });
    node.complete = false;
    node.dispatchEvent(new Event('load'));
    action.update({ src: '/next.webp', fade: true });
    node.dispatchEvent(new Event('load'));
    action.destroy();
    finish();
    await decoding;
    expect(animate).not.toHaveBeenCalled();
    expect(background.size).toBe(0);
    expect(node.style.opacity).toBe('');
  });
  it('reports pending downloads and clears loading on completion or failure', () => {
    const node = new ImageNode();
    const states: boolean[] = [];
    const onLoading = (loading: boolean) => states.push(loading);
    const action = vehiclePhoto(node.asImage(), { src: node.src, onLoading });
    expect(states).toEqual([true]);
    node.dispatchEvent(new Event('load'));
    expect(states.at(-1)).toBe(false);
    action.update({ src: '/next.webp', onLoading });
    expect(states.at(-1)).toBe(true);
    node.dispatchEvent(new Event('error'));
    expect(states.at(-1)).toBe(false);
    action.destroy();
  });

  it('does not let an older decode hide the next photo loading state', async () => {
    let finishDecode!: () => void;
    const decoding = new Promise<void>((resolve) => {
      finishDecode = resolve;
    });
    const node = Object.assign(new ImageNode(), { decode: () => decoding });
    const states: boolean[] = [];
    const onLoading = (loading: boolean) => states.push(loading);
    const action = vehiclePhoto(node.asImage(), { src: node.src, onLoading });
    node.dispatchEvent(new Event('load'));
    action.update({ src: '/next.webp', onLoading });
    finishDecode();
    await decoding;
    expect(states).toEqual([true, true]);
    node.dispatchEvent(new Event('load'));
    await decoding;
    expect(states.at(-1)).toBe(false);
    action.destroy();
  });

  it('keeps the normal placeholder for a vehicle without photos', () => {
    const node = new ImageNode();
    node.src = catalogPlaceholder;
    const action = vehiclePhoto(node.asImage(), { src: node.src });
    node.dispatchEvent(new Event('error'));
    expect(node.src).toBe(catalogPlaceholder);
    action.destroy();
  });

  it('replaces a failed photo, clears competing srcset and avoids retry loops', () => {
    const node = new ImageNode();
    node.setAttribute('srcset', '/unavailable.webp 640w');
    vehiclePhoto(node.asImage(), { src: node.src, srcset: '/unavailable.webp 640w' });
    node.dispatchEvent(new Event('error'));
    expect(node.src).toBe(catalogPlaceholder);
    expect(node.attributes.has('srcset')).toBe(false);
    node.dispatchEvent(new Event('error'));
    expect(node.src).toBe(catalogPlaceholder);
  });

  it('handles a failure that happened before hydration', () => {
    const node = new ImageNode();
    node.complete = true;
    vehiclePhoto(node.asImage(), { src: node.src });
    expect(node.src).toBe(catalogPlaceholder);
  });

  it('keeps successfully loaded photos', () => {
    const node = new ImageNode();
    node.complete = true;
    node.naturalWidth = 1200;
    const src = node.src;
    vehiclePhoto(node.asImage(), { src });
    expect(node.src).toBe(src);
  });

  it('recovers on a new vehicle/gallery source and restores responsive candidates', () => {
    const node = new ImageNode();
    const initial = { src: node.src };
    const action = vehiclePhoto(node.asImage(), initial);
    node.dispatchEvent(new Event('error'));
    action.update({ ...initial });
    expect(node.src).toBe(catalogPlaceholder);
    action.update({ src: '/next.webp', srcset: '/next-large.webp 1280w' });
    expect(node.src).toBe('/next.webp');
    expect(node.attributes.get('srcset')).toBe('/next-large.webp 1280w');
    node.dispatchEvent(new Event('error'));
    expect(node.src).toBe(catalogPlaceholder);
    action.update({ src: '/third.jpg' });
    expect(node.src).toBe('/third.jpg');
    action.destroy();
    node.dispatchEvent(new Event('error'));
    expect(node.src).toBe('/third.jpg');
  });
});
