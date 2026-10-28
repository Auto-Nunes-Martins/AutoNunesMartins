/// <reference lib="webworker" />
import { photoDimensions } from './photoDimensions';

// The HEIC decoder is loaded only for an image the browser cannot decode.
// All conversion stays on the user's device; the server still validates input.
self.onmessage = async ({ data: file }: MessageEvent<File>) => {
  let bitmap: ImageBitmap | undefined;
  try {
    if (typeof createImageBitmap !== 'function' || typeof OffscreenCanvas === 'undefined')
      throw Error('Atualize o navegador para preparar fotografias neste dispositivo.');
    const heic = /\.hei[cf]$/i.test(file.name) || /image\/hei[cf]/.test(file.type);
    {
      const bytes = await file.arrayBuffer();
      const dimensions = photoDimensions(bytes);
      if (dimensions && dimensions.width * dimensions.height > 50_000_000)
        throw Error('Máximo de 50 megapíxeis por fotografia.');
      if (heic) {
        // HEIF ispe properties describe coded dimensions, including grid images.
        // Refuse oversized declarations before allocating decoded RGBA buffers.
        const view = new DataView(bytes);
        for (let i = 4; i + 16 <= view.byteLength; i++) {
          if (view.getUint32(i) === 0x69737065 && view.getUint32(i - 4) >= 20) {
            if (view.getUint32(i + 8) * view.getUint32(i + 12) > 50_000_000)
              throw Error('Máximo de 50 megapíxeis por fotografia.');
          }
        }
      }
    }
    try {
      bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch {
      if (!heic) throw Error('Fotografia inválida ou formato não suportado.');
      const { heicTo } = await import('heic-to/next');
      try {
        bitmap = await heicTo({ blob: file, type: 'bitmap' });
      } catch {
        throw Error(
          'Não foi possível abrir esta fotografia HEIC/HEIF. Tente novamente ou escolha outra fotografia.',
        );
      }
    }
    const pixels = bitmap.width * bitmap.height;
    if (!pixels || pixels > 50_000_000) throw Error('Máximo de 50 megapíxeis por fotografia.');
    // Leave already suitable originals untouched. The backend removes metadata
    // and applies the established master/variant recipe after upload.
    if (!heic && pixels <= 24_000_000 && file.size <= 20 * 1024 * 1024) {
      self.postMessage({ file });
      return;
    }
    const scale = Math.min(1, Math.sqrt(23_500_000 / pixels));
    const canvas = new OffscreenCanvas(
      Math.max(1, Math.floor(bitmap.width * scale)),
      Math.max(1, Math.floor(bitmap.height * scale)),
    );
    const context = canvas.getContext('2d');
    if (!context) throw Error('Este navegador não permite preparar fotografias.');
    context.fillStyle = '#fff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    let output = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.95 });
    for (const quality of [0.9, 0.85, 0.8]) {
      if (output.size <= 20 * 1024 * 1024) break;
      output = await canvas.convertToBlob({ type: 'image/jpeg', quality });
    }
    if (output.size > 20 * 1024 * 1024)
      throw Error('Não foi possível reduzir esta fotografia. Escolha outra fotografia.');
    self.postMessage({
      file: new File([output], file.name.replace(/\.[^.]+$/, '') + '.jpg', {
        type: 'image/jpeg',
        lastModified: file.lastModified,
      }),
    });
    canvas.width = canvas.height = 1;
  } catch (error) {
    self.postMessage({
      error:
        error instanceof Error
          ? error.message
          : 'Não foi possível abrir o HEIC/HEIF. Tente novamente ou escolha outra fotografia.',
    });
  } finally {
    bitmap?.close();
  }
};
