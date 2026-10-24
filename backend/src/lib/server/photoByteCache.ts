/** Pixel bytes only, never permissions. Shared LRU capacity with a soft thumbnail
 * reservation; the total retained pixel budget remains 12 MiB per process. */
export type CachedPhoto = {
  until: number;
  buffer: Buffer;
  contentType: string;
  etag: string;
};

export class PhotoByteCache {
  private entries = new Map<string, CachedPhoto & { small: boolean }>();
  private bytes = 0;
  private thumbnailBytes = 0;
  private readonly budget = 12 * 1024 * 1024;
  private readonly reservation = 4 * 1024 * 1024;

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
    if (value) {
      this.bytes -= value.buffer.length;
      if (value.small) this.thumbnailBytes -= value.buffer.length;
    }
    this.entries.delete(key);
  }

  forget(path: string) {
    for (const key of this.entries.keys()) if (key.startsWith(path + '|')) this.delete(key);
  }

  set(key: string, photo: CachedPhoto, width: number, isDerivative: boolean) {
    if (photo.buffer.length > 2_000_000) return;
    const small = isDerivative && width <= 800 && photo.buffer.length <= 512 * 1024;
    const value = { ...photo, small, until: Date.now() + (small ? 10 * 60_000 : 60_000) };
    this.delete(key);
    for (const [id, entry] of this.entries) if (entry.until <= Date.now()) this.delete(id);
    while (
      this.entries.size &&
      (this.bytes + value.buffer.length > this.budget || this.entries.size >= 1024)
    ) {
      // Do not evict a protected thumbnail for a gallery image. Capacity above
      // the reservation is shared in LRU order, and either class can borrow it.
      const victim = [...this.entries].find(
        ([, entry]) =>
          !entry.small || small || this.thumbnailBytes - entry.buffer.length >= this.reservation,
      );
      if (!victim) return;
      this.delete(victim[0]);
    }
    this.entries.set(key, value);
    this.bytes += value.buffer.length;
    if (small) this.thumbnailBytes += value.buffer.length;
  }
}
