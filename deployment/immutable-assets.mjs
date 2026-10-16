import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Only files emitted by the current build qualify. No routes or user uploads.
export function immutableAssets(base) {
  const urls = new Set();
  for (const [app, prefix] of [['website', ''], ['crm', base]]) {
    const root = fileURLToPath(new URL(`../apps/${app}/build/client${prefix}/_app/immutable/`, import.meta.url));
    if (!fs.existsSync(root)) continue;
    for (const file of fs.readdirSync(root, { recursive: true })) {
      if (/\.(?:br|gz)$/.test(file) || !fs.statSync(path.join(root, file)).isFile()) continue;
      urls.add(`${prefix}/_app/immutable/${file.replaceAll('\\', '/')}`);
    }
  }
  return urls;
}
