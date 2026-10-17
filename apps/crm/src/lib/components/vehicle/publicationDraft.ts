/** Preserve local approval edits while immediate photo operations refresh server data. */
export function reconcilePhotoSelection(
  draft: string[], previousSaved: string[], nextSaved: string[], available: string[],
) {
  if (JSON.stringify(draft) === JSON.stringify(previousSaved))
    return nextSaved.filter(path => available.includes(path));
  const added = draft.filter(path => !previousSaved.includes(path));
  const removed = previousSaved.filter(path => !draft.includes(path));
  return available.filter(path =>
    (nextSaved.includes(path) || added.includes(path)) && !removed.includes(path),
  );
}

type Draft = {
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
