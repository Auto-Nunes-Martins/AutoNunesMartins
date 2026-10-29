import { readFileSync } from 'node:fs';

export const contactEmailLogoId = 'auto-nunes-martins-logo';
let content: string | undefined;

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
