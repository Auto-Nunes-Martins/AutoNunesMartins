/** Legacy drafts cannot retain individual exclusions. */
export function reconcilePhotoSelection(_draft: string[], _previousSaved: string[], _nextSaved: string[], available: string[]) {
  return [...available];
}

type Draft = {
  galleryFraming?: Record<string, import('@anm/types').PhotoFraming>;
  price: string | number | null | undefined;
  description: string;
  transmission: string;
  selected: string[];
  specs: Record<string, string>;
};

/** Prices such as 25000 and 25000.00 describe the same saved value. */
export function publicationDraftKey(draft: Draft) {
  return JSON.stringify({
    ...draft,
    price: draft.price === '' || draft.price == null ? '' : String(Number(draft.price)),
    specs: Object.fromEntries(Object.entries(draft.specs).map(([key, value]) => [key,
      ['powerHp', 'engineCc', 'doors', 'seats'].includes(key)
        ? value === '' || value == null ? '' : String(Number(value))
        : value,
    ])),
  });
}
