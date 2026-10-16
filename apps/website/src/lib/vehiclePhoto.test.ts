import { describe, expect, it } from 'vitest';
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
