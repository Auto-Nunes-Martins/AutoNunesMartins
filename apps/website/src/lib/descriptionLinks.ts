export type DescriptionPart = { text: string; href?: string };

/** Plain text remains escaped by Svelte; only explicit web URLs become links. */
export function descriptionLinks(text: string): DescriptionPart[] {
  const parts: DescriptionPart[] = [];
  let cursor = 0;
  for (const match of text.matchAll(/https?:\/\/[^\s<>]+/g)) {
    const href = match[0].replace(/[.,;!?:]+$/, '');
    if (match.index > cursor) parts.push({ text: text.slice(cursor, match.index) });
    parts.push({ text: href, href });
    cursor = match.index + href.length;
  }
  if (cursor < text.length) parts.push({ text: text.slice(cursor) });
  return parts;
}
