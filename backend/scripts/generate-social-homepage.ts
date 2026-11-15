import { writeFile } from 'node:fs/promises';
import { renderBrandSocialImage } from '../src/lib/server/socialImages.js';

// Explicit offline generation: never runs on page load or edits the logo master.
await writeFile(
  new URL('../../apps/website/static/images/social/homepage-v2.jpg', import.meta.url),
  await renderBrandSocialImage(),
);
