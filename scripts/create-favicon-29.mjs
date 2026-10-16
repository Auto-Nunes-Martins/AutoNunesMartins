// Exact option 25 composition. Only the backdrop changes to the site's document background.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
const sharp = createRequire(new URL('../backend/package.json', import.meta.url))('sharp');
const root = 'docs/favicon-proposals/variante-29';
const sourceRoot = 'docs/favicon-proposals/serie-21-28/25-alinhado-carvao';
const oldColor = '#101012', newColor = '#0a0a0b';
const save = (file, bytes) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, bytes); };
const digest = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const css = fs.readFileSync('apps/website/src/app.css', 'utf8');
const app = fs.readFileSync('apps/website/src/app.html', 'utf8');
assert(css.includes('background: #0a0a0b;'));
assert(app.includes('html { background: #0a0a0b;'));
assert(app.includes('content="#0A0A0B"'));
const provenance = JSON.parse(fs.readFileSync('docs/favicon-proposals/serie-21-28/proveniencia.json', 'utf8'));
const option = provenance.options.find(item => item.number === 25);
assert.equal(option.bg, oldColor);
const original = fs.readFileSync(`${sourceRoot}/favicon.svg`, 'utf8');
const svg = original.replace(`fill="${oldColor}"`, `fill="${newColor}"`);
assert.equal(svg.replace(`fill="${newColor}"`, `fill="${oldColor}"`), original);
assert.equal(svg.match(/<image[\s\S]*/)[0], original.match(/<image[\s\S]*/)[0]);
save(`${root}/favicon.svg`, svg);
const words = {};
for (const audit of provenance.audit.filter(item => item.tone === 'dark')) {
  assert.equal(digest(fs.readFileSync(audit.source)), audit.sourceSha256);
  const cropped = await sharp(audit.source).extract(audit.region).png().toBuffer();
  const bytes = await sharp(cropped).extract(audit.alphaBounds).png().toBuffer();
  assert.equal(digest(bytes), audit.wordSha256);
  words[audit.word] = { bytes, width: audit.alphaBounds.width, height: audit.alphaBounds.height };
}
function geometry(size) {
  if (size === 16) return option.native16;
  if (size === 32) return option.native32;
  const scale = size / 64;
  let height = Math.max(1, Math.round(option.maxWidth / (words.nunes.width / words.nunes.height) * scale));
  const max = Math.round(option.maxWidth * scale);
  while (Math.round(words.nunes.width / words.nunes.height * height) > max) height--;
  const gap = Math.max(1, Math.round(option.gap * scale));
  const top = Math.floor((size - height * 2 - gap) / 2);
  return ['auto', 'nunes'].map((name, i) => ({ name, width: Math.round(words[name].width / words[name].height * height), height, x: Math.round((64 - option.maxWidth) / 2 * scale), y: top + i * (height + gap) }));
}
const files = [], icoImages = [];
for (const size of [16, 32, 48, 64, 128, 180, 256]) {
  const layers = [];
  for (const position of geometry(size)) {
    const bytes = await sharp(words[position.name].bytes).resize({ height: position.height, kernel: 'lanczos3' }).png().toBuffer();
    layers.push({ input: bytes, left: position.x, top: position.y });
  }
  const render = color => sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="${Math.round(size * 7 / 64)}" fill="${color}"/></svg>`)).composite(layers).png({ compressionLevel: 9 }).toBuffer();
  const reference = await render(oldColor);
  const source = fs.readFileSync(`${sourceRoot}/favicon-${size}.png`);
  // Prove composition/lettering/antialiasing match option 25 before changing its background.
  assert.deepEqual(await sharp(reference).raw().toBuffer(), await sharp(source).raw().toBuffer(), `Exact option25 reconstruction at ${size}px`);
  const bytes = await render(newColor);
  save(`${root}/favicon-${size}.png`, bytes);
  files.push({ size, sourceSha256: digest(source), outputSha256: digest(bytes), originalPixelMatch: true, geometry: geometry(size) });
  if (size <= 64) icoImages.push({ size, bytes });
}
const header = Buffer.alloc(6 + icoImages.length * 16);
header.writeUInt16LE(1, 2); header.writeUInt16LE(icoImages.length, 4);
let offset = header.length;
icoImages.forEach(({ size, bytes }, i) => { const p = 6 + i * 16; header[p] = size; header[p + 1] = size; header.writeUInt16LE(1, p + 4); header.writeUInt16LE(32, p + 6); header.writeUInt32LE(bytes.length, p + 8); header.writeUInt32LE(offset, p + 12); offset += bytes.length; });
save(`${root}/favicon.ico`, Buffer.concat([header, ...icoImages.map(image => image.bytes)]));
let sheet = '<svg xmlns="http://www.w3.org/2000/svg" width="1160" height="590"><rect width="1160" height="590" fill="#eeeef0"/><g font-family="Arial,sans-serif" fill="#17181c"><text x="32" y="42" font-size="25" font-weight="700">Opção 25 → variante 29 · apenas o fundo muda</text><text x="32" y="73" font-size="15">Mesmas letras, composição, margens e píxeis de texto · fundo global real do website #0A0A0B</text>';
const layers = [];
for (const [i, item] of [{ folder: sourceRoot, name: '25 · original', color: oldColor }, { folder: root, name: '29 · fundo do website', color: newColor }].entries()) {
  const x = 24 + i * 580;
  sheet += `<rect x="${x}" y="100" width="556" height="440" rx="14" fill="#fff"/><text x="${x + 20}" y="135" font-size="22" font-weight="700">${item.name}</text><text x="${x + 20}" y="164" font-size="16" fill="#61636a">${item.color.toUpperCase()}</text><rect x="${x + 200}" y="202" width="334" height="95" rx="8" fill="#f0f0f3"/><rect x="${x + 200}" y="321" width="334" height="95" rx="8" fill="#24252a"/><text x="${x + 216}" y="226" font-size="11" fill="#61636a">SEPARADOR CLARO</text><text x="${x + 216}" y="345" font-size="11" fill="#b8bbc5">SEPARADOR ESCURO</text><text x="${x + 248}" y="264" font-size="13">AutoNunes</text><text x="${x + 248}" y="383" font-size="13" fill="#eeeef0">AutoNunes</text><text x="${x + 451}" y="264" font-size="12" fill="#61636a">32 px</text><text x="${x + 451}" y="383" font-size="12" fill="#b8bbc5">32 px</text><text x="${x + 20}" y="490" font-size="13" fill="#61636a">128 px ampliado · 16/32 px em tamanho nativo</text>`;
  layers.push({ input: fs.readFileSync(`${item.folder}/favicon-128.png`), left: x + 32, top: 248 });
  for (const y of [251, 370]) {
    layers.push({ input: fs.readFileSync(`${item.folder}/favicon-16.png`), left: x + 220, top: y });
    layers.push({ input: fs.readFileSync(`${item.folder}/favicon-32.png`), left: x + 410, top: y - 9 });
  }
}
sheet += '</g></svg>';
save(`${root}/comparacao-25-29.png`, await sharp(Buffer.from(sheet)).composite(layers).png().toBuffer());
save(`${root}/verificacao.json`, JSON.stringify({ source: sourceRoot, changedOnly: 'background', oldColor, newColor, evidence: [{ file: 'apps/website/src/app.css', value: 'html, body { background: #0a0a0b; }' }, { file: 'apps/website/src/app.html', value: 'html background and theme-color #0A0A0B' }], distinction: 'Orbit content --bg is #0c0c0e; the document html/body background #0a0a0b is the darker actual page backdrop. Neither is pure #000000.', svgOnlyBackgroundChanged: true, files }, null, 2) + '\n');
save(`${root}/README.md`, '# Variante 29 — opção 25 com fundo do website\n\nÚnica alteração: #101012 → #0A0A0B. Composição, dimensões, espaçamento, alinhamento, vermelho, letras e geometria da opção 25 preservados. Cada PNG da opção 25 foi reconstruído e comparado píxel a píxel antes da alteração do fundo. O SVG só muda o atributo fill do retângulo de fundo.\n\n#0A0A0B é o fundo global de html/body em apps/website/src/app.css, e o fundo inicial/theme-color de apps/website/src/app.html. É o mais escuro dos fundos principais: o conteúdo Orbit usa --bg #0C0C0E. A cor anterior de 25 era #101012, do rodapé, não preto puro.\n\nSVG com raster original incorporado; PNG 16/32/48/64/128/180/256; ICO 16/32/48/64. A opção 25 original mantém-se intacta. Nenhum favicon foi ativado; sem troca dinâmica de tema, commit, push ou deploy.\n');
save(`${root}/index.html`, '<!doctype html><html lang="pt"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Variante 29 · fundo do website</title><style>body{font:17px system-ui;max-width:1160px;margin:30px auto;padding:20px;background:#eeeef0;color:#17181c}img{max-width:100%;height:auto}a{color:#a00013}</style><h1>Variante 29 · opção 25 com fundo do website</h1><p>Só muda o fundo: #101012 → #0A0A0B. O documento usa #0A0A0B em html/body e theme-color; o conteúdo Orbit usa #0C0C0E, ligeiramente mais claro. A opção 25 fica preservada.</p><p><a href="favicon.ico">ICO 16/32/48/64</a> · <a href="favicon.svg">SVG</a> · <a href="favicon-180.png">PNG 180</a> · <a href="favicon-256.png">PNG 256</a> · <a href="verificacao.json">Verificação de igualdade da composição</a></p><img src="comparacao-25-29.png" alt="Comparação nativa e ampliada de 25 com 29"><p>Nenhuma opção foi ativada.</p></html>');
console.log(`${root}/comparacao-25-29.png — seven exact source reconstructions passed; background ${oldColor} → ${newColor}.`);
