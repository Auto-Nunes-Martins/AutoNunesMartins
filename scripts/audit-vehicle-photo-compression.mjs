// Read-only public samples; all generated comparisons stay outside the product.
import sharp from 'sharp';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const output = resolve('artifacts/vehicle-photo-compression');
await mkdir(output, { recursive: true });
const slugs = [
  'audi-a3-sportback-30-tfsi-2022-527ff7026c07',
  'audi-a6-avant-2023-eb5212472e45',
  'audi-q3-35-tdi-quattro-2021-525fd2168c63',
  'audi-q5-50-tfsi-e-quattro-2022-37767adcfa24',
  'bmw-m340i-xdrive-touring-2022-aa6458fdb5d3',
  'dacia-jogger-extreme-2023-cf06e4d3ad62',
];
const rows = [];
const label = (text, width) =>
  Buffer.from(
    `<svg width="${width}" height="36"><rect width="100%" height="100%" fill="#181818"/><text x="10" y="24" fill="white" font-family="Arial" font-size="15">${text}</text></svg>`,
  );
for (const slug of slugs) {
  const file = resolve(output, `${slug}.master`);
  let input;
  try {
    input = await readFile(file);
  } catch {
    if (!process.argv.includes('--download'))
      throw Error('Run with --download once to obtain the public samples.');
    const response = await fetch(`https://www.autonunesmartins.com/viaturas/${slug}/photos/0`);
    if (!response.ok) throw Error(`Public sample unavailable: ${slug}`);
    input = Buffer.from(await response.arrayBuffer());
    await writeFile(file, input);
  }
  const boards = [];
  for (const width of [320, 384, 800, 1280, 1600]) {
    const reference = await sharp(input)
      .rotate()
      .resize({ width, withoutEnlargement: true })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const raw = reference.info;
    const baseline = await sharp(reference.data, { raw })
      .webp({ quality: 94, effort: 3, smartSubsample: true })
      .toBuffer();
    const baselineRaw = await sharp(baseline).removeAlpha().raw().toBuffer();
    for (const quality of [94, 92, 90, 88, 86]) {
      const buffer = await sharp(reference.data, { raw })
        .webp({ quality, effort: 6, smartSubsample: true })
        .toBuffer();
      const decoded = await sharp(buffer).removeAlpha().raw().toBuffer();
      let squared = 0,
        absolute = 0;
      for (let i = 0; i < decoded.length; i++) {
        const difference = decoded[i] - baselineRaw[i];
        squared += difference * difference;
        absolute += Math.abs(difference);
      }
      rows.push({
        slug,
        width: raw.width,
        height: raw.height,
        quality,
        baselineBytes: baseline.length,
        bytes: buffer.length,
        psnrAgainstCurrent: squared ? 10 * Math.log10(255 ** 2 / (squared / decoded.length)) : null,
        meanAbsoluteDifference: absolute / decoded.length,
      });
      if (width === 1600) {
        // Original-pixel crops expose paint, grille, lettering and texture changes.
        const tileWidth = 380,
          tileHeight = 220;
        const resized = await sharp(buffer).resize({ width: tileWidth }).png().toBuffer();
        const crop = await sharp(buffer)
          .extract({
            left: Math.floor(raw.width * 0.35),
            top: Math.floor(raw.height * 0.48),
            width: Math.min(tileWidth, raw.width),
            height: Math.min(tileHeight, Math.floor(raw.height * 0.48)),
          })
          .png()
          .toBuffer();
        boards.push({ quality, buffer, resized, crop });
      }
    }
  }
  const overlays = [];
  for (const [i, sample] of boards.entries()) {
    overlays.push({
      input: label(`WebP Q${sample.quality} - ${Math.round(sample.buffer.length / 1000)} kB`, 380),
      left: i * 380,
      top: 0,
    });
    overlays.push({ input: sample.resized, left: i * 380, top: 36 });
    overlays.push({ input: sample.crop, left: i * 380, top: 360 });
  }
  await sharp({ create: { width: 1900, height: 600, channels: 3, background: '#252525' } })
    .composite(overlays)
    .png()
    .toFile(resolve(output, `${slug}.comparison.png`));
}
await writeFile(resolve(output, 'measurements.json'), JSON.stringify(rows, null, 2));
for (const quality of [94, 92, 90, 88, 86]) {
  const matches = rows.filter((row) => row.quality === quality);
  console.log(
    JSON.stringify({
      quality,
      samples: matches.length,
      savingsPercent: +(
        100 *
        (1 -
          matches.reduce((n, r) => n + r.bytes, 0) /
            matches.reduce((n, r) => n + r.baselineBytes, 0))
      ).toFixed(1),
      minimumPsnr: +Math.min(...matches.map((r) => r.psnrAgainstCurrent ?? Infinity)).toFixed(2),
      maximumMeanDifference: +Math.max(...matches.map((r) => r.meanAbsoluteDifference)).toFixed(2),
    }),
  );
}
