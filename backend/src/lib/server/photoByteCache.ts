/** Pixel bytes only, never permissions. Separate LRU budgets protect thumbnails
 * from gallery churn without increasing the existing 12 MiB process budget. */
export type CachedPhoto = {
  until: number;
  buffer: Buffer;
  contentType: string;
  etag: string;
};

class PixelPool {
  private entries = new Map<string, CachedPhoto>();
  private bytes = 0;
  constructor(private readonly budget: number) {}

  get(key: string, touch = true) {
    const value = this.entries.get(key);
    if (!value) return undefined;
    if (value.until <= Date.now()) {
      this.delete(key);
      return undefined;
    }
    if (touch) {
      this.entries.delete(key);
      this.entries.set(key, value);
    }
    return value;
  }

  private delete(key: string) {
    const value = this.entries.get(key);
    if (value) this.bytes -= value.buffer.length;
    this.entries.delete(key);
  }

  forget(path: string) {
    for (const key of this.entries.keys()) if (key.startsWith(path + '|')) this.delete(key);
  }

  set(key: string, value: CachedPhoto) {
    if (value.buffer.length > this.budget) return;
    this.delete(key);
    for (const [id, entry] of this.entries) if (entry.until <= Date.now()) this.delete(id);
    while (
      this.entries.size &&
      (this.bytes + value.buffer.length > this.budget || this.entries.size >= 512)
    ) {
      this.delete(this.entries.keys().next().value!);
    }
    this.entries.set(key, value);
    this.bytes += value.buffer.length;
  }
}

export class PhotoByteCache {
  private thumbnails = new PixelPool(4 * 1024 * 1024);
  private gallery = new PixelPool(8 * 1024 * 1024);

  get(key: string, touch = true) {
    return this.thumbnails.get(key, touch) ?? this.gallery.get(key, touch);
  }

  forget(path: string) {
    this.thumbnails.forget(path);
    this.gallery.forget(path);
  }

  set(key: string, photo: CachedPhoto, width: number, isDerivative: boolean) {
    if (photo.buffer.length > 2_000_000) return;
    // A legacy full-size fallback must not consume the thumbnail reservation.
    const small = isDerivative && width <= 800 && photo.buffer.length <= 512 * 1024;
    const value = { ...photo, until: Date.now() + (small ? 10 * 60_000 : 60_000) };
    (small ? this.thumbnails : this.gallery).set(key, value);
  }
}
