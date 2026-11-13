/** Legacy drafts cannot retain individual exclusions. */
export function reconcilePhotoSelection(
  _draft: string[],
  _previousSaved: string[],
  _nextSaved: string[],
  available: string[],
) {
  return [...available];
}

type Draft = {
  galleryFraming?: Record<string, import('@anm/types').GalleryPhotoFraming>;
  description: string;
  transmission: string;
  selected: string[];
  specs: Record<string, string>;
};

/** Normalize equivalent numeric specifications when detecting unsaved changes. */
export function publicationDraftKey(draft: Draft) {
  return JSON.stringify({
    ...draft,
    specs: Object.fromEntries(
      Object.entries(draft.specs).map(([key, value]) => [
        key,
        ['powerHp', 'engineCc', 'doors', 'seats'].includes(key)
          ? value === '' || value == null
            ? ''
            : String(Number(value))
          : value,
      ]),
    ),
  });
}
