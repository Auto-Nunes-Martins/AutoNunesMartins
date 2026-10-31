import type { SignedVariantPhoto } from '$lib/vehicleImage';
import { descriptionHtml } from '@anm/types/richDescription';
import { galleryFramingSchema } from '@anm/types';
export type EditPhoto = SignedVariantPhoto & {
  file?: File;
  preparedFile?: File;
  preparation?: Promise<File>;
  preparationError?: string;
  uploadId?: string;
  uploadedPath?: string;
  preparationMetrics?: Record<string, number>;
};

export function publicDraftFromForm(form: FormData) {
  const get = (key: string) => String(form.get(key) ?? '');
  return {
    published: get('published') === 'true',
    galleryFraming: galleryFramingSchema.parse(JSON.parse(get('galleryFraming') || '{}')),
    price: get('publicPrice') || null,
    description: get('publicDescription'),
    photoPaths: form.getAll('vehiclePhotoPaths').map(String),
    transmission: get('publicTransmission') || null,
    specifications: specificationsFromForm(form),
  };
}

export function specificationsFromForm(form: FormData) {
  const get = (key: string) => String(form.get(key) ?? '');
  return {
    version: get('version').trim(),
    ...Object.fromEntries(
      ['powerHp', 'engineCc', 'doors', 'seats'].map((key) => [
        key,
        get(key) ? Number(get(key)) : null,
      ]),
    ),
    category: get('category'),
    color: get('color'),
    equipment: get('equipment')
      .split(/\r?\n/)
      .map((value) => value.trim())
      .filter(Boolean),
  };
}

export function publicEditKey(value: ReturnType<typeof publicDraftFromForm>) {
  return JSON.stringify({
    ...value,
    description: descriptionHtml(value.description),
    price: value.price === null ? null : Number(value.price),
    photoPaths: [...value.photoPaths].sort(),
  });
}
