import { readFileSync } from 'node:fs';

export const contactEmailLogoId = 'auto-nunes-martins-logo';
export const contactEmailArrowId = 'auto-nunes-martins-arrow';
let content: string | undefined;
let arrowContent: string | undefined;

/** The public brand asset is embedded; no remote URL, credentials or visitor input. */
export function contactEmailLogoAttachment() {
  if (!content) {
    const file = new URL('./contactEmailLogo.png', import.meta.url);
    content = readFileSync(file).toString('base64');
  }
  return {
    filename: 'auto-nunes-martins.png',
    content_type: 'image/png',
    content_id: contactEmailLogoId,
    content,
  };
}

/** A fixed bitmap avoids mobile clients substituting an emoji for the arrow glyph. */
export function contactEmailArrowAttachment() {
  arrowContent ??= readFileSync(new URL('./contactEmailArrow.png', import.meta.url)).toString(
    'base64',
  );
  return {
    filename: 'auto-nunes-martins-arrow.png',
    content_type: 'image/png',
    content_id: contactEmailArrowId,
    content: arrowContent,
  };
}
