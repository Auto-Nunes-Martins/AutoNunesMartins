import PreparationWorker from './photoPreparation.worker?worker';
import { photoDiagnosticsEnabled, recordPreparation } from './photoDiagnostics';

export const PHOTO_ACCEPT = 'image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif';
export function validatePhoto(file: File) {
  if (file.size > 50 * 1024 * 1024) throw Error('Máximo de 50 MB por fotografia.');
  if (
    !['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'].includes(file.type) &&
    !/\.hei[cf]$/i.test(file.name)
  )
    throw Error('Escolha JPEG, PNG, WebP ou HEIC/HEIF (não RAW).');
}

// One worker at a time across all photo editors. A fresh worker releases decoder
// heaps after each image, including nested HEIC workers, failures and cancellation.
let tail: Promise<unknown> = Promise.resolve();
export function preparePhoto(file: File, signal?: AbortSignal): Promise<File> {
  const queuedAt=photoDiagnosticsEnabled()?performance.now():undefined;
  const run = tail
    .catch(() => {})
    .then(
      () =>
        new Promise<File>((resolve, reject) => {
          const startedAt=performance.now();
          if (signal?.aborted) {
            reject(new DOMException('Cancelado', 'AbortError'));
            return;
          }
          let worker: Worker;
          let timer: ReturnType<typeof setTimeout>;
          let finished=false;
          const finish = (error?: Error, output?: File, dimensions?:Record<string,number>) => {
            if(finished)return;finished=true;
            clearTimeout(timer);
            signal?.removeEventListener('abort', cancel);
            worker?.terminate();
            if(queuedAt!==undefined)recordPreparation(file,output,queuedAt,startedAt,dimensions);
            if (error) reject(error);
            else resolve(output!);
          };
          const cancel = () => finish(new DOMException('Cancelado', 'AbortError'));
          try {
            validatePhoto(file);
            worker = new PreparationWorker();
            signal?.addEventListener('abort', cancel, { once: true });
            worker.onmessage = ({ data }) =>
              data.error ? finish(Error(data.error)) : finish(undefined, data.file, data.metrics);
            worker.onerror = () =>
              finish(
                Error(
                  'Não foi possível preparar a fotografia neste navegador. Tente novamente num navegador atualizado.',
                ),
              );
            timer = setTimeout(
              () => finish(Error('A preparação demorou demasiado. Tente novamente.')),
              120_000,
            );
            worker.postMessage(file);
          } catch (error) {
            finish(error instanceof Error ? error : Error(String(error)));
          }
        }),
    );
  // Keep sequencing without retaining the last output File after it is removed.
  tail = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

export async function readyPhoto(photo: {
  file?: File;
  preparation?: Promise<File>;
  preparedFile?: File;
  preparationError?: string;
}) {
  if (photo.preparedFile) return photo.preparedFile;
  if (photo.preparationError) throw Error(photo.preparationError);
  photo.preparation ??= preparePhoto(photo.file!);
  try {
    const file = await photo.preparation;
    photo.preparedFile = file;
    return file;
  } catch (error) {
    if (error instanceof Error && error.name !== 'AbortError')
      photo.preparationError = `${photo.file!.name}: ${error.message}`;
    throw error;
  }
}
