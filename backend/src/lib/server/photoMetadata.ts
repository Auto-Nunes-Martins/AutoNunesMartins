import sharp from 'sharp';

/** Remove descriptive/private container metadata without decoding/re-encoding pixels.
 * Retain ICC/colour signalling and, for legacy originals, only the EXIF orientation.
 * Never return an unsanitized fallback if a container cannot be parsed safely.
 */
export async function sanitizePhotoMetadata(input: Buffer): Promise<Buffer> {
  const meta = await sharp(input, { limitInputPixels: 24_000_000, failOn: 'warning' }).metadata();
  if ((meta.pages ?? 1) !== 1) throw Error('Unsupported animated photograph');
  const orientation = meta.orientation && meta.orientation >= 2 && meta.orientation <= 8 ? meta.orientation : undefined;
  if (meta.format === 'jpeg') return jpeg(input, orientation);
  if (meta.format === 'png') return png(input, orientation);
  if (meta.format === 'webp') return webp(input, orientation);
  throw Error('Unsupported photo container');
}

function orientationTiff(orientation: number) {
  const data = Buffer.alloc(26);
  data.write('II'); data.writeUInt16LE(42, 2); data.writeUInt32LE(8, 4);
  data.writeUInt16LE(1, 8); data.writeUInt16LE(0x112, 10); data.writeUInt16LE(3, 12);
  data.writeUInt32LE(1, 14); data.writeUInt16LE(orientation, 18);
  return data;
}
function jpegSegment(marker: number, data: Buffer) {
  const head = Buffer.from([0xff, marker, 0, 0]); head.writeUInt16BE(data.length + 2, 2);
  return Buffer.concat([head, data]);
}
function jpeg(input: Buffer, orientation?: number) {
  if (input.readUInt16BE(0) !== 0xffd8) throw Error('Invalid JPEG');
  const parts = [input.subarray(0, 2)];
  if (orientation) parts.push(jpegSegment(0xe1, Buffer.concat([Buffer.from('Exif\0\0'), orientationTiff(orientation)])));
  let pos = 2;
  while (pos < input.length) {
    const start = pos;
    if (input[pos++] !== 0xff) throw Error('Invalid JPEG marker');
    while (input[pos] === 0xff) pos++;
    const marker = input[pos++];
    if (marker === 0xd9) { parts.push(Buffer.from([0xff, 0xd9])); return Buffer.concat(parts); }
    if (marker === undefined || marker === 0 || marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7)) throw Error('Invalid JPEG segment');
    if (marker === 1) { parts.push(input.subarray(start, pos)); continue; }
    if (pos + 2 > input.length) throw Error('Truncated JPEG');
    const size = input.readUInt16BE(pos), end = pos + size;
    if (size < 2 || end > input.length) throw Error('Truncated JPEG segment');
    const data = input.subarray(pos + 2, end);
    if (marker >= 0xe0 && marker <= 0xef) {
      if (marker === 0xe0 && data.subarray(0, 5).equals(Buffer.from('JFIF\0')) && data.length >= 14) {
        // Retain the colour/density header, discard embedded thumbnails.
        const jfif = Buffer.from(data.subarray(0, 14)); jfif[12] = 0; jfif[13] = 0;
        parts.push(jpegSegment(marker, jfif));
      } else if (marker === 0xe2 && data.subarray(0, 12).equals(Buffer.from('ICC_PROFILE\0'))) {
        parts.push(input.subarray(start, end));
      } else if (marker === 0xee && data.subarray(0, 5).equals(Buffer.from('Adobe')) && data.length === 12) {
        parts.push(input.subarray(start, end));
      }
    } else if (marker !== 0xfe) parts.push(input.subarray(start, end));
    pos = end;
    if (marker === 0xda) {
      // Copy entropy-coded pixels verbatim, including stuffed FF and restart markers.
      const scan = pos;
      while (pos < input.length) {
        if (input[pos] !== 0xff) { pos++; continue; }
        let next = pos + 1;
        while (input[next] === 0xff) next++;
        const code = input[next];
        if (code === 0 || (code !== undefined && code >= 0xd0 && code <= 0xd7)) { pos = next + 1; continue; }
        break;
      }
      parts.push(input.subarray(scan, pos));
    }
  }
  throw Error('Missing JPEG end');
}

function crc32(data: Buffer) {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function pngChunk(type: string, data: Buffer) {
  const chunk = Buffer.alloc(data.length + 12);
  chunk.writeUInt32BE(data.length); chunk.write(type, 4); data.copy(chunk, 8);
  chunk.writeUInt32BE(crc32(chunk.subarray(4, -4)), chunk.length - 4);
  return chunk;
}
function png(input: Buffer, orientation?: number) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (!input.subarray(0, 8).equals(signature)) throw Error('Invalid PNG');
  const parts: Buffer[] = [signature]; let pos = 8;
  const keep = new Set(['IHDR', 'PLTE', 'IDAT', 'IEND', 'tRNS', 'cHRM', 'gAMA', 'iCCP', 'sBIT', 'sRGB', 'cICP', 'bKGD', 'pHYs']);
  while (pos + 12 <= input.length) {
    const size = input.readUInt32BE(pos), end = pos + size + 12;
    if (end > input.length) throw Error('Truncated PNG chunk');
    const type = input.toString('ascii', pos + 4, pos + 8);
    if (type === 'acTL') throw Error('Unsupported animated photograph');
    if (keep.has(type)) parts.push(input.subarray(pos, end));
    else if (type[0] === type[0]?.toUpperCase() && type !== 'eXIf') throw Error('Unknown critical PNG chunk');
    if (type === 'IHDR' && orientation) parts.push(pngChunk('eXIf', orientationTiff(orientation)));
    if (type === 'IEND') return Buffer.concat(parts);
    pos = end;
  }
  throw Error('Missing PNG end');
}

function riffChunk(type: string, data: Buffer) {
  const chunk = Buffer.alloc(8 + data.length + (data.length % 2));
  chunk.write(type); chunk.writeUInt32LE(data.length, 4); data.copy(chunk, 8);
  return chunk;
}
function webp(input: Buffer, orientation?: number) {
  if (input.toString('ascii', 0, 4) !== 'RIFF' || input.toString('ascii', 8, 12) !== 'WEBP') throw Error('Invalid WebP');
  const end = input.readUInt32LE(4) + 8;
  if (end > input.length) throw Error('Truncated WebP');
  const parts: Buffer[] = []; let pos = 12, extended = false;
  const keep = new Set(['ICCP', 'ALPH', 'VP8 ', 'VP8L']);
  while (pos + 8 <= end) {
    const size = input.readUInt32LE(pos + 4), next = pos + 8 + size + (size % 2);
    if (next > end) throw Error('Truncated WebP chunk');
    const type = input.toString('ascii', pos, pos + 4);
    if (type === 'ANIM' || type === 'ANMF') throw Error('Unsupported animated photograph');
    if (type === 'VP8X') {
      if (size !== 10) throw Error('Invalid WebP extended header');
      const chunk = Buffer.from(input.subarray(pos, next));
      chunk[8] = (chunk[8]! & ~0x0c) | (orientation ? 0x08 : 0);
      parts.push(chunk); extended = true;
    } else if (keep.has(type)) parts.push(input.subarray(pos, next));
    pos = next;
  }
  if (pos !== end || (orientation && !extended)) throw Error('Invalid WebP metadata container');
  if (orientation) parts.push(riffChunk('EXIF', orientationTiff(orientation)));
  const body = Buffer.concat(parts), header = Buffer.from('RIFF\0\0\0\0WEBP');
  header.writeUInt32LE(body.length + 4, 4);
  return Buffer.concat([header, body]);
}
