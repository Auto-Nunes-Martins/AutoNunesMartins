import { copyFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

/** Keep the compiled backend self-contained, including the existing public brand PNG. */
export async function copyContactEmailLogo(
  destination = new URL('../dist/lib/server/contactEmailLogo.png', import.meta.url),
) {
  await mkdir(new URL('.', destination), { recursive: true });
  await copyFile(new URL('../src/lib/server/contactEmailLogo.png', import.meta.url), destination);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await copyContactEmailLogo();
}
