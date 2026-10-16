// Original raster lettering only. Equal cap heights, deliberate alignment and native-size PNG rendering.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
const sharp = createRequire(new URL('../backend/package.json', import.meta.url))('sharp');
const root = 'docs/favicon-proposals/serie-21-28';
const save = (file, bytes) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, bytes); };
const digest = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const words = {};
const audit = [];
for (const tone of ['dark', 'light']) {
  const source = `apps/website/static/${tone === 'dark' ? 'logo-transparent-white-v3.png' : 'logo-transparent.png'}`;
  words[tone] = {};
  for (const [name, region] of [['auto', { left: 165, top: 350, width: 670, height: 185 }], ['nunes', { left: 834, top: 350, width: 842, height: 185 }]]) {
    const cropped = await sharp(source).extract(region).png().toBuffer();
    const { data, info } = await sharp(cropped).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    let left = info.width, top = info.height, right = -1, bottom = -1;
    for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
      if (data[(y * info.width + x) * 4 + 3] > 8) {
        left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x); bottom = Math.max(bottom, y);
      }
    }
    // Keep a one-pixel source margin around the real alpha extent; do not cut italic edges.
    left = Math.max(0, left - 1); top = Math.max(0, top - 1);
    right = Math.min(info.width - 1, right + 1); bottom = Math.min(info.height - 1, bottom + 1);
    const bounds = { left, top, width: right - left + 1, height: bottom - top + 1 };
    const bytes = await sharp(cropped).extract(bounds).png().toBuffer();
    words[tone][name] = { bytes, width: bounds.width, height: bounds.height };
    audit.push({ source, sourceSha256: digest(fs.readFileSync(source)), tone, word: name, region, alphaBounds: bounds, wordSha256: digest(bytes) });
  }
}
const options = [
  { number: 21, id: '21-centro-carvao', label: 'Centro · carvão', tone: 'dark', bg: '#17171a', maxWidth: 60, gap: 8, align: 'center', source: '--surface: #17171a' },
  { number: 22, id: '22-centro-claro', label: 'Centro · branco suave', tone: 'light', bg: '#f5f5f1', maxWidth: 60, gap: 8, align: 'center', source: '--bg: #f5f5f1' },
  { number: 23, id: '23-compacto-grafite', label: 'Compacto · grafite', tone: 'dark', bg: '#252528', maxWidth: 60, gap: 4, align: 'center', source: 'background: #252528' },
  { number: 24, id: '24-compacto-branco', label: 'Compacto · branco', tone: 'light', bg: '#ffffff', maxWidth: 60, gap: 4, align: 'center', source: '--surface: #fff;' },
  { number: 25, id: '25-alinhado-carvao', label: 'Alinhado · carvão', tone: 'dark', bg: '#101012', maxWidth: 58, gap: 6, align: 'left', source: 'background: #101012' },
  { number: 26, id: '26-alinhado-papel', label: 'Alinhado · papel', tone: 'light', bg: '#f6f4ef', maxWidth: 58, gap: 6, align: 'left', source: 'background: #f6f4ef' },
  { number: 27, id: '27-respiro-carvao', label: 'Com margem · carvão', tone: 'dark', bg: '#0c0c0e', maxWidth: 56, gap: 8, align: 'center', source: '--bg: #0c0c0e' },
  { number: 28, id: '28-respiro-claro', label: 'Com margem · claro', tone: 'light', bg: '#f3f3ef', maxWidth: 56, gap: 8, align: 'center', source: '--bg: #f3f3ef' },
];
const css = ['DesignEdition.svelte', 'OrbitCompactFooter.svelte', 'VisitInvitation.svelte'].map(f => fs.readFileSync(`apps/website/src/lib/components/stand-concepts/${f}`, 'utf8')).join('\n');
function geometry(item, size, native = true) {
  const scale = size / 64, selected = words[item.tone];
  let cap = item.maxWidth / (selected.nunes.width / selected.nunes.height) * scale;
  if (native) cap = Math.max(1, Math.round(cap));
  // At favicon sizes a one-pixel width change must not collapse a 3px cap to 2px.
  const max = native && size <= 32 ? size - (size === 16 ? 1 : 2) : Math.round(item.maxWidth * scale);
  while (native && Math.round(selected.nunes.width / selected.nunes.height * cap) > max) cap--;
  const width = name => native ? Math.round(selected[name].width / selected[name].height * cap) : selected[name].width / selected[name].height * cap;
  const gap = native ? Math.max(1, Math.round(item.gap * scale)) : item.gap * scale;
  const top = native ? Math.floor((size - cap * 2 - gap) / 2) : (size - cap * 2 - gap) / 2;
  return ['auto', 'nunes'].map((name, i) => ({ name, width: width(name), height: cap, x: item.align === 'left' ? Math.round((64 - item.maxWidth) / 2 * scale) : native ? Math.floor((size - width(name)) / 2) : (size - width(name)) / 2, y: top + i * (cap + gap) }));
}
function ico(images) {
  const header = Buffer.alloc(6 + images.length * 16);
  header.writeUInt16LE(1, 2); header.writeUInt16LE(images.length, 4);
  let offset = header.length;
  images.forEach(({ size, bytes }, i) => {
    const p = 6 + i * 16; header[p] = size; header[p + 1] = size;
    header.writeUInt16LE(1, p + 4); header.writeUInt16LE(32, p + 6);
    header.writeUInt32LE(bytes.length, p + 8); header.writeUInt32LE(offset, p + 12); offset += bytes.length;
  });
  return Buffer.concat([header, ...images.map(image => image.bytes)]);
}
for (const item of options) {
  assert(css.includes(item.source));
  const selected = words[item.tone];
  const positions = geometry(item, 64, false);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><rect width="64" height="64" rx="7" fill="${item.bg}"/>${positions.map(p => `<image x="${p.x}" y="${p.y}" width="${p.width}" height="${p.height}" href="data:image/png;base64,${selected[p.name].bytes.toString('base64')}"/>`).join('')}</svg>`;
  save(`${root}/${item.id}/favicon.svg`, svg);
  const images = [];
  for (const size of [16, 32, 48, 64, 128, 180, 256]) {
    const positions = geometry(item, size);
    const layers = [];
    for (const p of positions) {
      const bytes = await sharp(selected[p.name].bytes).resize({ height: p.height, kernel: 'lanczos3' }).png().toBuffer();
      const { width, height } = await sharp(bytes).metadata();
      assert.equal(width, p.width); assert.equal(height, p.height);
      layers.push({ input: bytes, left: p.x, top: p.y });
    }
    const background = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="${Math.round(size * 7 / 64)}" fill="${item.bg}"/></svg>`);
    const bytes = await sharp(background).composite(layers).png({ compressionLevel: 9 }).toBuffer();
    save(`${root}/${item.id}/favicon-${size}.png`, bytes);
    if (size <= 64) images.push({ size, bytes });
  }
  save(`${root}/${item.id}/favicon.ico`, ico(images));
  item.native16 = geometry(item, 16); item.native32 = geometry(item, 32);
}
const layers = [];
let sheet = '<svg xmlns="http://www.w3.org/2000/svg" width="1240" height="1480"><rect width="1240" height="1480" fill="#eeeef0"/><g font-family="Arial,sans-serif" fill="#17181c"><text x="32" y="40" font-size="25" font-weight="700">AutoNunes · composição tipográfica revista</text><text x="32" y="69" font-size="15">Série 21–28 · altura das letras igualada · espaçamento e alinhamento revistos</text><text x="32" y="93" font-size="14" fill="#62646c">Recortes reais, sem fonte substituta · PNG/ICO ajustados à grelha de 16/32 px · propostas não ativas</text>';
for (const [i, item] of options.entries()) {
  const x = 24 + i % 2 * 620, y = 115 + Math.floor(i / 2) * 335;
  sheet += `<rect x="${x}" y="${y}" width="592" height="313" rx="13" fill="#fff"/><text x="${x + 18}" y="${y + 31}" font-size="19" font-weight="700">${item.number} · ${item.label}</text><text x="${x + 18}" y="${y + 56}" font-size="14" fill="#62646c">${item.bg.toUpperCase()} · mesma altura de AUTO e NUNES</text><rect x="${x + 185}" y="${y + 76}" width="385" height="82" rx="8" fill="#f0f0f3"/><rect x="${x + 185}" y="${y + 174}" width="385" height="82" rx="8" fill="#24252a"/><text x="${x + 202}" y="${y + 98}" font-size="11" fill="#666970">SEPARADOR CLARO</text><text x="${x + 202}" y="${y + 196}" font-size="11" fill="#b8bbc5">SEPARADOR ESCURO</text><text x="${x + 238}" y="${y + 129}" font-size="13">AutoNunes</text><text x="${x + 238}" y="${y + 227}" font-size="13" fill="#ededf1">AutoNunes</text><text x="${x + 480}" y="${y + 129}" font-size="12" fill="#686b75">32 px</text><text x="${x + 480}" y="${y + 227}" font-size="12" fill="#b8bbc5">32 px</text><text x="${x + 18}" y="${y + 294}" font-size="12" fill="#63666f">128 px à esquerda · 16/32 px nativos à direita</text>`;
  layers.push({ input: fs.readFileSync(`${root}/${item.id}/favicon-128.png`), left: x + 27, top: y + 95 });
  for (const offset of [0, 98]) {
    layers.push({ input: fs.readFileSync(`${root}/${item.id}/favicon-16.png`), left: x + 209, top: y + 116 + offset });
    layers.push({ input: fs.readFileSync(`${root}/${item.id}/favicon-32.png`), left: x + 434, top: y + 107 + offset });
  }
}
sheet += '</g></svg>';
save(`${root}/comparacao-21-28.png`, await sharp(Buffer.from(sheet)).composite(layers).png().toBuffer());
const proof = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="1120" height="650"><rect width="1120" height="650" fill="#eeeef0"/><g font-family="Arial,sans-serif" fill="#17181c"><text x="32" y="40" font-size="24" font-weight="700">Origem do lettering e correção de proporções</text><text x="32" y="75" font-size="16">Recorte real de logo-transparent-white-v3.png, sem substituir a fonte:</text><rect x="32" y="92" width="1056" height="150" rx="10" fill="#17171a"/><text x="110" y="286" font-size="18">Antes · opção 10</text><text x="650" y="286" font-size="18">Revisto · opção 21</text><text x="32" y="614" font-size="15">A revisão iguala a altura das duas palavras. Os contornos e as cores continuam a vir do PNG original.</text></g></svg>');
save(`${root}/proveniencia-tipografia.png`, await sharp(proof).composite([
  { input: await sharp('apps/website/static/logo-transparent-white-v3.png').extract({ left: 165, top: 350, width: 1510, height: 185 }).resize({ width: 1000 }).png().toBuffer(), left: 60, top: 105 },
  { input: fs.readFileSync('docs/favicon-proposals/serie-05-12/10-stacked-escuro/favicon-256.png'), left: 95, top: 310 },
  { input: fs.readFileSync(`${root}/21-centro-carvao/favicon-256.png`), left: 645, top: 310 },
]).png().toBuffer());
save(`${root}/proveniencia.json`, JSON.stringify({ vectorSource: 'No original brand vector or font file found in repository; SVG proposals embed original raster crops and are not claimed as original vectors.', audit, options, nativeNote: 'PNG/ICO rasterize the actual cropped words independently at matched integer cap heights. Glyph shapes/colors remain sampled from original PNGs; geometry/spacing is a new stacked composition. SVG uses continuous coordinates and may rasterize slightly differently at tiny sizes.' }, null, 2) + '\n');
save(`${root}/index.html`, `<!doctype html><html lang="pt"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>21–28 · AutoNunes revisto</title><style>body{font:16px system-ui;max-width:1240px;margin:30px auto;padding:20px;background:#eeeef0;color:#202126}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(450px,1fr));gap:18px}article{background:white;padding:22px;border-radius:14px}h1{font-size:28px}h2{font-size:20px}.large{width:128px;height:128px}.tab{display:flex;align-items:center;gap:12px;padding:16px;margin:12px 0;background:#eeeef3;border-radius:8px}.dark{background:#24252a;color:white}a{color:#a90012}img{object-fit:contain}.comparison{max-width:100%;height:auto}</style><h1>AutoNunes · composição revista 21–28</h1><p>As versões 09/10 escalavam cada palavra para uma largura semelhante, fazendo AUTO parecer maior e NUNES mais fino. Esta série usa a mesma altura nas duas palavras, preserva os recortes reais e revê margens, alinhamento e intervalo.</p><p>Não foi encontrado um original vetorial nem um ficheiro de fonte da marca. Não foram usadas fontes substitutas nem letras geradas. A composição é nova; os contornos e as cores são amostras dos PNG originais. SVG incorpora os recortes raster e não é apresentado como vetor original. PNG/ICO têm posicionamento de píxel ajustado por tamanho.</p><p>Comparar a 100% de zoom. A leitura de um nome de nove letras a 16 px continua limitada. Nenhuma proposta foi ativada.</p><div class="grid">${options.map(item => `<article><h2>${item.number} · ${item.label}</h2><p><code>${item.bg.toUpperCase()}</code> · ${item.align === 'left' ? 'Alinhamento à esquerda' : 'Alinhamento centrado'} · intervalo ${item.gap}/64</p><img class="large" src="${item.id}/favicon-128.png" alt="${item.number} ampliado">${['', 'dark'].map(t => `<div class="tab ${t}"><img src="${item.id}/favicon-16.png" width="16" height="16" alt="16 px">AutoNunes <img src="${item.id}/favicon-32.png" width="32" height="32" alt="32 px">32 px</div>`).join('')}<p><a href="${item.id}/favicon.ico">ICO 16/32/48/64</a> · <a href="${item.id}/favicon.svg">SVG com raster incorporado</a> · <a href="${item.id}/favicon-180.png">PNG 180</a> · <a href="${item.id}/favicon-256.png">PNG 256</a></p></article>`).join('')}</div><img class="comparison" src="comparacao-21-28.png" alt="Oito propostas revistas em tamanhos reais e ampliados"></html>`);
save(`${root}/README.md`, '# Série 21–28 — composição tipográfica revista\n\nEsta é a série atual; 13–20 fica como estudo de fundos, 05–12 como composição anterior e 01–04 como direção não aceite. Nenhum ficheiro anterior foi removido.\n\n09/10 usava larguras semelhantes para duas palavras de comprimentos diferentes, dando alturas e pesos aparentes diferentes. Aqui ambas têm uma altura comum; o desenho de cada palavra vem de recortes reais dos PNG originais. O corte de NUNES foi alargado à esquerda para preservar a margem do itálico e a extensão de alpha foi auditada. Não se inventou uma fonte nem se redesenharam letras; também não se afirma dispor do vetor original. SVG auto-contido incorpora raster. A composição e as medidas são novas.\n\nQuatro estudos de centro, intervalo, alinhamento e margem, em fundos reais claros/escuros. PNG/ICO são montados em cada resolução com alturas de letras iguais e coordenadas inteiras; não são apenas miniaturas do PNG 256. O SVG pode ser rasterizado de forma ligeiramente diferente a 16/32 px. O nome completo mantém um limite físico de leitura a 16 px, visível na comparação nativa.\n\nproveniencia.json regista origem, SHA-256, recortes, margens de alpha, geometria e paleta. PNG 16/32/48/64/128/180/256; ICO 16/32/48/64. Nenhuma proposta ativa, sem alteração de comportamento por tema, commit, push ou deploy.\n');
const index = 'docs/favicon-proposals/index.html';
const previousIndex = 'docs/favicon-proposals/indice-anterior-05-12.html';
if (fs.existsSync(index) && !fs.existsSync(previousIndex)) save(previousIndex, fs.readFileSync(index));
save(index, '<!doctype html><html lang="pt"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Favicons AutoNunes · composição revista</title><style>body{font:17px system-ui;max-width:1240px;margin:28px auto;padding:20px;background:#eeeef0;color:#17181c}img{max-width:100%;height:auto}a{color:#a00013}</style><h1>AutoNunes · propostas atuais 21–28</h1><p><a href="serie-21-28/index.html">Abrir a composição revista, as amostras nativas e os ficheiros PNG/ICO/SVG</a>. Altura de letras comum, recortes originais, grelha de píxeis e fundos reais do website. Nenhuma opção está ativa.</p><img src="serie-21-28/comparacao-21-28.png" alt="Oito composições revistas"><p><a href="serie-21-28/proveniencia-tipografia.png">Ver a origem do lettering e a comparação antes/depois</a>.</p><h2>Séries anteriores preservadas</h2><ul><li><a href="serie-05-12/index.html">05–12: composições anteriores; 09/10 serviram de base.</a></li><li><a href="serie-13-20/index.html">13–20: estudo de fundos, ultrapassado pela revisão de composição.</a></li><li><a href="anteriores-01-04.html">01–04: direção não aceite, conservada para histórico.</a></li></ul></html>');
console.log(`${root}/comparacao-21-28.png`);
