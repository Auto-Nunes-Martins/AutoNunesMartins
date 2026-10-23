import sharp from 'sharp';
import { readFile } from 'node:fs/promises';
const root = 'apps/website/src/lib/assets/';
const pairs = [
  ['forest-portrait', 'images/hero-directions/forest-ribbon-portrait-1920.webp', 1920],
  ['catalog-portrait', 'images/hero-directions/family-forest-ribbon-portrait-native.webp', 2736],
  ['curves-portrait', 'images/hero-directions/family-family-curves-portrait-native.webp', 2736],
  ['visit-wide', 'images/hero-directions/scene-v5-visit-1672.webp', 1672],
  ['service-wide', '@service-current', 1920],
];
for (const [name, source, width] of pairs) {
  const samples = [
    await readFile(
      source === '@service-current'
        ? 'artifacts/vehicle-photo-compression/service-current-1920'
        : root + source,
    ),
    await readFile(`${root}optimized/home-v5/${name}-${width}.webp`),
    await readFile(`${root}optimized/home-v5/${name}-${width}.avif`),
  ];
  const overlays = [];
  for (const [index, input] of samples.entries()) {
    const meta = await sharp(input).metadata();
    const label = Buffer.from(
      `<svg width="380" height="36"><rect width="100%" height="100%" fill="#181818"/><text x="10" y="24" fill="white" font-family="Arial" font-size="15">${['Approved source', 'WebP Q90', 'AVIF Q70'][index]} - ${Math.round(input.length / 1000)} kB</text></svg>`,
    );
    overlays.push({ input: label, left: index * 380, top: 0 });
    overlays.push({
      input: await sharp(input).resize({ width: 380 }).png().toBuffer(),
      left: index * 380,
      top: 36,
    });
    overlays.push({
      input: await sharp(input)
        .extract({
          left: Math.floor(meta.width * 0.4),
          top: Math.floor(meta.height * 0.5),
          width: 380,
          height: 220,
        })
        .png()
        .toBuffer(),
      left: index * 380,
      top: 610,
    });
  }
  await sharp({ create: { width: 1140, height: 840, channels: 3, background: '#252525' } })
    .composite(overlays)
    .png()
    .toFile(`artifacts/vehicle-photo-compression/${name}.comparison.png`);
}
