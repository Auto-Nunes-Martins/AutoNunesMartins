export type PhotoOrderItem = { id: string; path: string; isDndShadowItem?: boolean };

/** A drag may change order only: it must never authorize or remove a photograph. */
export function committedPhotoOrder(items: PhotoOrderItem[], current: string[]): string[] | null {
  if (items.some((item) => item.isDndShadowItem) || items.length !== current.length) return null;
  const paths = items.map((item) => item.path);
  if (new Set(paths).size !== current.length || paths.some((path) => !current.includes(path)))
    return null;
  return paths;
}
