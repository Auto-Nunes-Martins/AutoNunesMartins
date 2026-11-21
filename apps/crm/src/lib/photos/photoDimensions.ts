/** Read coded dimensions before decoding, so oversized files never allocate RGBA. */
export function photoDimensions(bytes: ArrayBuffer): { width: number; height: number } | undefined {
  const v = new DataView(bytes),
    n = v.byteLength;
  if (n >= 24 && v.getUint32(0) === 0x89504e47)
    return { width: v.getUint32(16), height: v.getUint32(20) };
  if (n >= 4 && v.getUint16(0) === 0xffd8) {
    let i = 2;
    while (i + 4 <= n) {
      if (v.getUint8(i++) !== 0xff) break;
      while (i < n && v.getUint8(i) === 0xff) i++;
      if (i >= n) break;
      const marker = v.getUint8(i++);
      if (marker === 0xda || marker === 0xd9) break;
      if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
      if (i + 2 > n) break;
      const size = v.getUint16(i);
      if (size < 2 || i + size > n) break;
      if (
        [0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(
          marker,
        ) &&
        size >= 7
      )
        return { height: v.getUint16(i + 3), width: v.getUint16(i + 5) };
      i += size;
    }
  }
  if (n >= 30 && v.getUint32(0) === 0x52494646 && v.getUint32(8) === 0x57454250) {
    const type = v.getUint32(12);
    if (type === 0x56503858)
      return {
        width: 1 + v.getUint8(24) + (v.getUint8(25) << 8) + (v.getUint8(26) << 16),
        height: 1 + v.getUint8(27) + (v.getUint8(28) << 8) + (v.getUint8(29) << 16),
      };
    if (type === 0x56503820)
      return { width: v.getUint16(26, true) & 0x3fff, height: v.getUint16(28, true) & 0x3fff };
    if (type === 0x5650384c && v.getUint8(20) === 0x2f) {
      const bits = v.getUint32(21, true);
      return { width: 1 + (bits & 0x3fff), height: 1 + ((bits >>> 14) & 0x3fff) };
    }
  }
}
