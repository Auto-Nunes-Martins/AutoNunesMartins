// Additional derivatives only. Approved source files and framing are preserved.
import sharp from 'sharp';
import { mkdir, readFile, writeFile, readdir, unlink } from 'node:fs/promises';
import { resolve } from 'node:path';
import { format, resolveConfig } from 'prettier';

const sources = 'apps/website/src/lib/assets/images/hero-directions/';
const destination = 'apps/website/src/lib/assets/optimized/home-v5/';
const audit = 'artifacts/vehicle-photo-compression/';
const crops = JSON.parse(await readFile('apps/website/src/lib/sceneCrops.json', 'utf8'));
await mkdir(destination, { recursive: true });
await mkdir(audit, { recursive: true });
const jobs = [
  // Include the approved entry zoom at common desktop DPRs without large jumps.
  ['forest-wide', 'forest-ribbon-5472.webp', [1280, 1920, 2304, 2560, 2688, 2880, 3072, 3840, 4096, 5472]],
  // Intermediate mobile densities should not jump straight from 1280 to 1920.
  // Keep the original framing/encoding quality and let sizes + DPR select the source.
  ['forest-portrait', 'forest-ribbon-portrait-1920.webp', [640, 1080, 1280, 1440, 1600, 1792, 1920]],
  ['catalog-portrait', 'family-forest-ribbon-portrait-native.webp', [480, 810, 960, 1440, 2052]],
  ['curves-wide', 'family-curves-wide-5472.webp', [1280, 1920, 2560, 3840, 5472]],
  ['curves-portrait', 'family-family-curves-portrait-native.webp', [640, 1080, 1280, 1920, 2736]],
  ['visit-wide', 'scene-v5-visit-1672.webp', [640, 1080, 1672]],
  ['visit-portrait', 'scene-v5-visit-portrait-705.webp', [640, 705]],
  ['service-wide', '@service', [640, 1080, 1280, 1920, 2560]],
];
const only = process.argv.find((arg) => arg.startsWith('--only='))?.slice(7);
// Reviewed against the existing derivatives using native-size detail crops.
// Keep the visit sources at their previous quality: those are already enlarged
// by the contact section, particularly its tall mobile composition.
const encoding = {
  'forest-wide': { webp: 88, avif: 55 },
  'forest-portrait': { webp: 88, avif: 55 },
  // This portrait is presented behind the existing 1.6px blur; compare at its rendered size.
  'catalog-portrait': { webp: 85, avif: 45 },
  'curves-wide': { webp: 88, avif: 65 },
  'curves-portrait': { webp: 88, avif: 65 },
  'service-wide': { webp: 85, avif: 60 },
};
const reviewedOnly = process.argv.includes('--reviewed');
if (process.argv.includes('--download')) {
  const response = await fetch(
    'https://images.unsplash.com/photo-1652453822981-653a9a522a5b?auto=format&fit=crop&w=2560&q=95',
  );
  if (!response.ok) throw Error('Approved service photograph unavailable');
  await writeFile(resolve(audit, 'service.master'), Buffer.from(await response.arrayBuffer()));
  const current = await fetch(
    'https://images.unsplash.com/photo-1652453822981-653a9a522a5b?auto=format&fit=crop&w=1920&q=80',
  );
  if (!current.ok) throw Error('Current service comparison unavailable');
  await writeFile(resolve(audit, 'service-current-1920'), Buffer.from(await current.arrayBuffer()));
}
const rows =
  process.argv.includes('--module-only') || only || reviewedOnly
    ? JSON.parse(await readFile(resolve(audit, 'background-measurements.json'), 'utf8'))
    : [];
for (const [name, source, widths] of process.argv.includes('--module-only') ? [] : jobs) {
  if (only && name !== only) continue;
  if (reviewedOnly && !encoding[name]) continue;
  const quality = encoding[name] ?? { webp: 90, avif: 70 };
  for (let i = rows.length - 1; i >= 0; i--) if (rows[i].name === name) rows.splice(i, 1);
  const input = await readFile(
    source === '@service' ? resolve(audit, 'service.master') : sources + source,
  );
  for (const width of widths) {
    let base = sharp(input);
    if (name === 'catalog-portrait') {
      const { left, top, width: cropWidth, height } = crops.catalog;
      base = base.extract({ left, top, width: cropWidth, height });
    }
    base = base.resize({ width, withoutEnlargement: true });
    for (const format of ['webp', 'avif']) {
      const bytes = await (
        format === 'webp'
          ? base.clone().webp({ quality: quality.webp, effort: 6, smartSubsample: true })
          : base.clone().avif({ quality: quality.avif, effort: 5, chromaSubsampling: ['forest-wide', 'forest-portrait', 'catalog-portrait'].includes(name) ? '4:2:0' : '4:4:4' })
      ).toBuffer();
      const file = `${destination}${name}-${width}.${format}`;
      await writeFile(file, bytes);
      const meta = await sharp(bytes).metadata();
      rows.push({
        name,
        source,
        width: meta.width,
        height: meta.height,
        format,
        bytes: bytes.length,
        file,
      });
    }
  }
  console.log(JSON.stringify({ name, complete: true }));
}
rows.sort((a, b) =>
  jobs.findIndex(([name]) => name === a.name) - jobs.findIndex(([name]) => name === b.name) ||
  a.width - b.width || (a.format === b.format ? 0 : a.format === 'webp' ? -1 : 1),
);
await writeFile(resolve(audit, 'background-measurements.json'), JSON.stringify(rows, null, 2));
// Retire only obsolete generated catalogue derivatives. The full source stays.
const expectedCatalog = new Set(rows.filter((row) => row.name === 'catalog-portrait').map((row) => resolve(row.file)));
for (const file of await readdir(destination)) {
  if (/^catalog-portrait-\d+\.(avif|webp)$/.test(file) && !expectedCatalog.has(resolve(destination, file)))
    await unlink(resolve(destination, file));
}
let module =
  '// Generated by scripts/optimize-home-v5-images.mjs; approved framing is unchanged.\n';
for (const [index, row] of rows.entries())
  module += `import image${index} from './assets/optimized/home-v5/${row.file.split('/').pop()}?url&no-inline';\n`;
module += 'export const homeV5Images = {\n';
for (const [name] of jobs) {
  const matches = rows.map((row, index) => ({ ...row, index })).filter((row) => row.name === name);
  const webp = matches.filter((row) => row.format === 'webp');
  const largest = webp.at(-1);
  const fallback = webp.find((row) => row.width >= 1280) ?? largest;
  const set = (format) =>
    matches
      .filter((row) => row.format === format)
      .map((row) => '${image' + row.index + '} ' + row.width + 'w')
      .join(', ');
  module += `  '${name}': { src: image${fallback.index}, srcset: \`${set('webp')}\`, avif: \`${set('avif')}\`, width: ${largest.width}, height: ${largest.height} },\n`;
}
module += '} as const;\n';
const modulePath = 'apps/website/src/lib/homeV5Images.ts';
await writeFile(
  modulePath,
  await format(module, { ...(await resolveConfig(modulePath)), parser: 'typescript' }),
);
