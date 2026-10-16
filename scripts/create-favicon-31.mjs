// Exact option 25 composition. Only the backdrop changes to the RGB midpoint between options25 and23.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
const sharp = createRequire(new URL('../backend/package.json', import.meta.url))('sharp');
const root = 'docs/favicon-proposals/variante-31';
const sourceRoot = 'docs/favicon-proposals/serie-21-28/25-alinhado-carvao';
const oldColor = '#101012';
const referenceColor = '#252528';
const midpoint = [0, 1, 2].map(i => Math.round((parseInt(oldColor.slice(1 + i * 2, 3 + i * 2), 16) + parseInt(referenceColor.slice(1 + i * 2, 3 + i * 2), 16)) / 2));
const newColor = '#' + midpoint.map(channel => channel.toString(16).padStart(2, '0')).join('');
assert.equal(newColor, '#1b1b1d');
const save = (file, bytes) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, bytes); };
const digest = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const provenance = JSON.parse(fs.readFileSync('docs/favicon-proposals/serie-21-28/proveniencia.json', 'utf8'));
const option = provenance.options.find(item => item.number === 25);
assert.equal(option.bg, oldColor);
assert.equal(provenance.options.find(item => item.number === 23).bg, referenceColor);
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
for (const size of [16, 32, 48, 64, 128, 180, 192, 256, 512]) {
  const layers = [];
  for (const position of geometry(size)) {
    const bytes = await sharp(words[position.name].bytes).resize({ height: position.height, kernel: 'lanczos3' }).png().toBuffer();
    layers.push({ input: bytes, left: position.x, top: position.y });
  }
  const render = color => sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="${Math.round(size * 7 / 64)}" fill="${color}"/></svg>`)).composite(layers).png({ compressionLevel: 9 }).toBuffer();
  const reference = await render(oldColor);
  const sourceFile = `${sourceRoot}/favicon-${size}.png`;
  const source = fs.existsSync(sourceFile) ? fs.readFileSync(sourceFile) : reference;
  // Prove composition/lettering/antialiasing match option 25 before changing its background.
  assert.deepEqual(await sharp(reference).raw().toBuffer(), await sharp(source).raw().toBuffer(), `Exact option25 reconstruction at ${size}px`);
  const bytes = await render(newColor);
  save(`${root}/favicon-${size}.png`, bytes);
  files.push({ size, sourceSha256: digest(source), outputSha256: digest(bytes), originalSizeFileExists: fs.existsSync(sourceFile), originalPixelMatch: true, geometry: geometry(size) });
  if (size <= 64) icoImages.push({ size, bytes });
}
const header = Buffer.alloc(6 + icoImages.length * 16);
header.writeUInt16LE(1, 2); header.writeUInt16LE(icoImages.length, 4);
let offset = header.length;
icoImages.forEach(({ size, bytes }, i) => { const p = 6 + i * 16; header[p] = size; header[p + 1] = size; header.writeUInt16LE(1, p + 4); header.writeUInt16LE(32, p + 6); header.writeUInt32LE(bytes.length, p + 8); header.writeUInt32LE(offset, p + 12); offset += bytes.length; });
save(`${root}/favicon.ico`, Buffer.concat([header, ...icoImages.map(image => image.bytes)]));
let sheet = '<svg xmlns="http://www.w3.org/2000/svg" width="1740" height="590"><rect width="1740" height="590" fill="#eeeef0"/><g font-family="Arial,sans-serif" fill="#17181c"><text x="32" y="42" font-size="25" font-weight="700">25 / 31 / 23 · fundo intermédio, composição da 25</text><text x="32" y="73" font-size="15">Variante 31: #1B1B1D · média por canal RGB de #101012 (25) e #252528 (23), arredondada</text>';
const layers = [];
for (const [i, item] of [{ folder: sourceRoot, name: '25 · original', color: oldColor }, { folder: root, name: '31 · intermédio', color: newColor }, { folder: 'docs/favicon-proposals/serie-21-28/23-compacto-grafite', name: '23 · referência de fundo', color: referenceColor }].entries()) {
  const x = 24 + i * 580;
  sheet += `<rect x="${x}" y="100" width="556" height="440" rx="14" fill="#fff"/><text x="${x + 20}" y="135" font-size="22" font-weight="700">${item.name}</text><text x="${x + 20}" y="164" font-size="16" fill="#61636a">${item.color.toUpperCase()}</text><rect x="${x + 200}" y="202" width="334" height="95" rx="8" fill="#f0f0f3"/><rect x="${x + 200}" y="321" width="334" height="95" rx="8" fill="#24252a"/><text x="${x + 216}" y="226" font-size="11" fill="#61636a">SEPARADOR CLARO</text><text x="${x + 216}" y="345" font-size="11" fill="#b8bbc5">SEPARADOR ESCURO</text><text x="${x + 248}" y="264" font-size="13">AutoNunes</text><text x="${x + 248}" y="383" font-size="13" fill="#eeeef0">AutoNunes</text><text x="${x + 451}" y="264" font-size="12" fill="#61636a">32 px</text><text x="${x + 451}" y="383" font-size="12" fill="#b8bbc5">32 px</text><text x="${x + 20}" y="490" font-size="13" fill="#61636a">128 px ampliado · 16/32 px em tamanho nativo</text>`;
  layers.push({ input: fs.readFileSync(`${item.folder}/favicon-128.png`), left: x + 32, top: 248 });
  for (const y of [251, 370]) {
    layers.push({ input: fs.readFileSync(`${item.folder}/favicon-16.png`), left: x + 220, top: y });
    layers.push({ input: fs.readFileSync(`${item.folder}/favicon-32.png`), left: x + 410, top: y - 9 });
  }
}
sheet += '</g></svg>';
save(`${root}/comparacao-25-31-23.png`, await sharp(Buffer.from(sheet)).composite(layers).png().toBuffer());
save(`${root}/verificacao.json`, JSON.stringify({ source: sourceRoot, changedOnly: 'background', oldColor, newColor, referenceColor, midpointMethod: 'Arithmetic mean of each encoded sRGB 8-bit channel, rounded to nearest integer (26.5,26.5,29) -> (27,27,29) = #1B1B1D. This is an explicit RGB midpoint, not a claimed perceptual midpoint.', evidence: [{ option: 25, background: '#101012' }, { option: 23, background: '#252528' }], svgOnlyBackgroundChanged: true, files }, null, 2) + '\n');
save(`${root}/README.md`, '# Variante 31 — fundo intermédio\n\nSó muda o fundo da composição 25: #101012 → #1B1B1D. A opção 23 fornece o outro extremo #252528. Método: média aritmética por canal sRGB de 8 bits e arredondamento ao inteiro mais próximo: (16+37)/2 = 26,5 → 27; azul (18+40)/2 = 29. Resultado RGB(27,27,29), #1B1B1D. Não se apresenta como interpolação perceptual.\n\nLetras, vermelho, dimensões, margens, alinhamento e geometria da opção 25 preservados. A referência 23 na comparação mantém a sua composição própria e só serve de extremo de fundo; 31 usa a composição de 25. Sete reconstruções de 25 verificadas píxel a píxel antes de alterar a cor. SVG só altera fill do fundo. PNG 16/32/48/64/128/180/192/256/512 e ICO 16/32/48/64.\n\nEscolhida pelo proprietário e aplicada ao website público como ícone fixo. O CRM conserva o seu desenho. A aplicação de 25 foi substituída antes de alterar o website. Variantes anteriores preservadas. O estado remoto deve ser confirmado após publicação do repositório.\n');
save(`${root}/index.html`, '<!doctype html><html lang="pt"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Variante 31 · fundo intermédio</title><style>body{font:17px system-ui;max-width:1740px;margin:30px auto;padding:20px;background:#eeeef0;color:#17181c}img{max-width:100%;height:auto}a{color:#a00013}</style><h1>Variante 31 · fundo intermédio</h1><p>Composição exata de 25, alterando só o fundo para #1B1B1D. Média por canal RGB arredondada entre #101012 (25) e #252528 (23). A referência 23 mostra o outro extremo de fundo, com a sua composição própria.</p><p><a href="favicon.ico">ICO</a> · <a href="favicon.svg">SVG</a> · <a href="favicon-180.png">PNG 180</a> · <a href="favicon-192.png">PNG 192</a> · <a href="favicon-256.png">PNG 256</a> · <a href="favicon-512.png">PNG 512</a> · <a href="verificacao.json">Verificação</a></p><img src="comparacao-25-31-23.png" alt="Comparação 25,31,23"><p>Opção 31 escolhida e aplicada ao website público como ícone fixo. 25 e todas as variantes anteriores preservadas. Estado remoto por verificar.</p></html>');
console.log(`${root}/comparacao-25-31-23.png — exact option25 reconstructions/geometry verified; background ${oldColor} → ${newColor}; future 192/512 sizes included.`);
