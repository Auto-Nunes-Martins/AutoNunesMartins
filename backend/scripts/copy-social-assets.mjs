import { copyFile, mkdir } from 'node:fs/promises';

const destination = new URL('../dist/lib/server/social/', import.meta.url);
await mkdir(destination, { recursive: true });
for (const name of ['logo-preview.png']) {
  await copyFile(
    new URL(`../src/lib/server/social/${name}`, import.meta.url),
    new URL(name, destination),
  );
}
