// Comparable static imports: module + root/authenticated shell + runtime.
// This model excludes on-demand imports and nested layouts; it is not a page transfer total.
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import path from 'node:path';
const app = process.argv[2] || 'crm';
const root = path.resolve('apps', app);
const output = path.resolve(process.argv[3] || `.cache/${app}-route-bundles.json`);
const directory = path.join(root, '.svelte-kit/output/client');
const manifest = JSON.parse(await readFile(path.join(directory, '.vite/manifest.json'), 'utf8'));
const entries = Object.keys(manifest);
const common = entries.filter((k) => /entry\.js$|client-optimized\/app\.js$/.test(k));
const layouts = app === 'crm' ? [0, 2] : [0];
const node = (n) => entries.find((k) => k.endsWith(`/nodes/${n}.js`));
const results = [];
for (const key of entries.filter((k) => /\/nodes\/\d+\.js$/.test(k))) {
  const seen = new Set();
  function visit(key) {
    if (!key || seen.has(key)) return;
    seen.add(key);
    for (const child of manifest[key].imports || []) visit(child);
  }
  [...common, ...layouts.map(node), key].forEach(visit);
  let bytes = 0,
    gzipBytes = 0;
  for (const entry of seen) {
    const body = await readFile(path.join(directory, manifest[entry].file));
    bytes += body.length;
    gzipBytes += gzipSync(body).length;
  }
  const source = await readFile(path.join(root, key), 'utf8');
  results.push({
    entry: manifest[key].name,
    source: source.match(/routes\/([^"']+)/)?.[1] ?? 'shared',
    bytes,
    gzipBytes,
    requests: seen.size,
  });
}
await mkdir(path.dirname(output), { recursive: true });
await writeFile(
  output,
  JSON.stringify(
    {
      app,
      note: 'Static module + root/authenticated shell dependency closure. Excludes nested layouts and dynamic imports; not a measured page transfer or speed score.',
      results,
    },
    null,
    2,
  ),
);
console.log(`${app}: ${results.length} route/layout entries measured`);
