import type {SignedVariantPhoto} from "$lib/vehicleImage";
export type EditPhoto = SignedVariantPhoto & { file?: File; uploadId?: string; uploadedPath?: string };

export function publicDraftFromForm(form: FormData) {
  const get = (key: string) => String(form.get(key) ?? '');
  return {
    published: get('published') === 'true', price: get('publicPrice') || null,
    description: get('publicDescription'), photoPaths: form.getAll('publicPhotoPaths').map(String),
    transmission: get('publicTransmission') || null,
    specifications: {
      ...Object.fromEntries(['powerHp', 'engineCc', 'doors', 'seats'].map(key => [key, get(key) ? Number(get(key)) : null])),
      category: get('category'), color: get('color'), equipment: get('equipment').split(/\r?\n/).map(value => value.trim()).filter(Boolean),
    },
  };
}

export function publicEditKey(value: ReturnType<typeof publicDraftFromForm>) {
  return JSON.stringify({ ...value, price: value.price === null ? null : Number(value.price), photoPaths: [...value.photoPaths].sort() });
}
