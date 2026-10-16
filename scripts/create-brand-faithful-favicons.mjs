// Series 05–12 uses only actual artwork crops: no substitute type, monograms or redrawn cars.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const sharp = createRequire(new URL('../backend/package.json', import.meta.url))('sharp');
const root = 'docs/favicon-proposals/serie-05-12';
const save = (file, bytes) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, bytes); };
const original = tone => `apps/website/static/${tone === 'light' ? 'logo-transparent.png' : 'logo-transparent-white-v3.png'}`;
const crops = { upper: { left: 165, top: 105, width: 1560, height: 430 }, name: { left: 170, top: 350, width: 1500, height: 185 }, auto: { left: 170, top: 350, width: 670, height: 185 }, nunes: { left: 840, top: 350, width: 830, height: 185 } };
async function image(tone, crop, box) {
  let pipeline = sharp(original(tone));
  if (crop) pipeline = pipeline.extract(crops[crop]);
  const cropped = await pipeline.png().toBuffer();
  const bytes = await sharp(cropped).trim().png().toBuffer();
  const { width, height } = await sharp(bytes).metadata();
  const scale = Math.min(box.width / width, box.height / height);
  const w = width * scale, h = height * scale;
  return `<image x="${box.x + (box.width - w) / 2}" y="${box.y + (box.height - h) / 2}" width="${w}" height="${h}" href="data:image/png;base64,${bytes.toString('base64')}"/>`;
}
function ico(images) {
  const header = Buffer.alloc(6 + images.length * 16);
  header.writeUInt16LE(1, 2); header.writeUInt16LE(images.length, 4);
  let offset = header.length;
  images.forEach(({ size, bytes }, i) => {
    const start = 6 + i * 16;
    header[start] = size; header[start + 1] = size;
    header.writeUInt16LE(1, start + 4); header.writeUInt16LE(32, start + 6);
    header.writeUInt32LE(bytes.length, start + 8); header.writeUInt32LE(offset, start + 12);
    offset += bytes.length;
  });
  return Buffer.concat([header, ...images.map(image => image.bytes)]);
}
const concepts = [];
for (const [layout, label] of [['full', 'Logótipo completo'], ['upper', 'Perfil + AutoNunes'], ['stacked', 'AUTO / NUNES'], ['name', 'AutoNunes numa linha']]) {
  for (const tone of ['light', 'dark']) {
    const number = 5 + concepts.length;
    const id = `${String(number).padStart(2, '0')}-${layout}-${tone === 'light' ? 'claro' : 'escuro'}`;
    const name = `${String(number).padStart(2, '0')} · ${label} · ${tone === 'light' ? 'claro' : 'escuro'}`;
    const background = tone === 'light' ? '#f5f5f1' : '#0a0a0b';
    let artwork;
    if (layout === 'stacked') {
      artwork = await image(tone, 'auto', { x: 5, y: 10, width: 54, height: 20 });
      artwork += await image(tone, 'nunes', { x: 4, y: 34, width: 56, height: 20 });
    } else {
      artwork = await image(tone, layout === 'full' ? undefined : layout, { x: 3, y: 5, width: 58, height: 54 });
    }
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><rect width="64" height="64" rx="7" fill="${background}"/>${artwork}</svg>`;
    const folder = `${root}/${id}`;
    save(`${folder}/favicon.svg`, svg);
    const images = [];
    for (const size of [16, 32, 48, 64, 128, 180, 256]) {
      const bytes = await sharp(Buffer.from(svg), { density: 384 }).resize(size, size).png({ compressionLevel: 9 }).toBuffer();
      save(`${folder}/favicon-${size}.png`, bytes);
      if (size <= 64) images.push({ size, bytes });
    }
    save(`${folder}/favicon.ico`, ico(images));
    concepts.push({ number, id, name, layout, tone });
  }
}
const layers = [];
let sheet = '<svg xmlns="http://www.w3.org/2000/svg" width="1240" height="1440"><rect width="1240" height="1440" fill="#eeeef0"/><g font-family="Arial,sans-serif" fill="#17181c"><text x="32" y="40" font-size="25" font-weight="700">Auto Nunes Martins · 8 opções com a marca original</text><text x="32" y="69" font-size="15">Série 05–12 · recortes reais do lettering e do perfil · nenhuma proposta está ativa</text><text x="32" y="93" font-size="14" fill="#62646c">O nome comprido perde legibilidade a 16 px. Comparar os ícones nativos, não apenas a ampliação.</text>';
for (const [i, concept] of concepts.entries()) {
  const x = 24 + i % 2 * 620, y = 115 + Math.floor(i / 2) * 325;
  sheet += `<rect x="${x}" y="${y}" width="592" height="303" rx="13" fill="#fff"/><text x="${x + 18}" y="${y + 31}" font-size="18" font-weight="700">${concept.name}</text><text x="${x + 18}" y="${y + 57}" font-size="12" fill="#61636c">AMPLIADO · 128 px</text><rect x="${x + 185}" y="${y + 76}" width="385" height="82" rx="8" fill="#f0f0f3"/><rect x="${x + 185}" y="${y + 174}" width="385" height="82" rx="8" fill="#24252a"/><text x="${x + 202}" y="${y + 98}" font-size="11" fill="#666970">SEPARADOR CLARO</text><text x="${x + 202}" y="${y + 196}" font-size="11" fill="#b8bbc5">SEPARADOR ESCURO</text><text x="${x + 238}" y="${y + 129}" font-size="13">AutoNunes</text><text x="${x + 238}" y="${y + 227}" font-size="13" fill="#ededf1">AutoNunes</text><text x="${x + 480}" y="${y + 129}" font-size="12" fill="#686b75">32 px</text><text x="${x + 480}" y="${y + 227}" font-size="12" fill="#b8bbc5">32 px</text><text x="${x + 18}" y="${y + 284}" font-size="12" fill="#63666f">Lettering original · sem desenho de uma nova marca</text>`;
  layers.push({ input: fs.readFileSync(`${root}/${concept.id}/favicon-128.png`), left: x + 27, top: y + 88 });
  for (const offset of [0, 98]) {
    layers.push({ input: fs.readFileSync(`${root}/${concept.id}/favicon-16.png`), left: x + 209, top: y + 116 + offset });
    layers.push({ input: fs.readFileSync(`${root}/${concept.id}/favicon-32.png`), left: x + 434, top: y + 107 + offset });
  }
}
sheet += '</g></svg>';
save(`${root}/comparacao-05-12.png`, await sharp(Buffer.from(sheet)).composite(layers).png().toBuffer());
save(`${root}/index.html`, `<!doctype html><html lang="pt"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>05–12 · favicon com a marca original</title><style>body{font:16px system-ui;max-width:1240px;margin:30px auto;padding:20px;background:#eeeef0;color:#202126}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(450px,1fr));gap:18px}article{background:white;padding:22px;border-radius:14px}h1{font-size:28px}h2{font-size:20px}.large{width:128px;height:128px}.tab{display:flex;align-items:center;gap:12px;padding:16px;margin:12px 0;background:#eeeef3;border-radius:8px}.dark{background:#24252a;color:white}a{color:#a90012}img{object-fit:contain}.comparison{max-width:100%;height:auto}</style><h1>Auto Nunes Martins · série 05–12</h1><p>Oito composições a partir dos ficheiros reais da marca. Sem monogramas inventados, letras substituídas ou silhuetas redesenhadas. Nenhuma está ativa.</p><p><strong>Limite real:</strong> AutoNunes é um nome comprido para 16 px. As opções numa linha preservam a composição, mas o texto fica muito pequeno. As opções em duas linhas dão mais altura às letras. Ver a 100% de zoom e escolher pelos exemplos de tamanho nativo, não só pelo ícone ampliado.</p><div class="grid">${concepts.map(c => `<article><h2>${c.name}</h2><img class="large" src="${c.id}/favicon-128.png" alt="${c.name} ampliado"><p>Mesma arte original, numa composição ${c.layout === 'stacked' ? 'de duas linhas' : c.layout === 'full' ? 'completa' : c.layout === 'upper' ? 'com perfil e nome' : 'só com o nome'}.</p>${['', 'dark'].map(t => `<div class="tab ${t}"><img src="${c.id}/favicon-16.png" width="16" height="16" alt="16 px">AutoNunes <img src="${c.id}/favicon-32.png" width="32" height="32" alt="32 px">32 px</div>`).join('')}<p><a href="${c.id}/favicon.svg">SVG com a arte original incorporada</a> · <a href="${c.id}/favicon.ico">ICO</a> · <a href="${c.id}/favicon-180.png">PNG 180</a> · <a href="${c.id}/favicon-256.png">PNG 256</a></p></article>`).join('')}</div><h2>Comparação geral</h2><img class="comparison" src="comparacao-05-12.png" alt="Oito opções em tamanho ampliado e nativo sobre fundos claro e escuro"></html>`);
save(`${root}/README.md`, '# Série 05–12 — marca original\n\nOito propostas não ativas, feitas exclusivamente com recortes reais de apps/website/static/logo-transparent.png e logo-transparent-white-v3.png. Mantêm lettering, cores e perfil automóvel originais. SVG auto-contidos incorporam os recortes raster; não são uma vetorização inventada. PNG 16/32/48/64/128/180/256 e ICO 16/32/48/64.\n\n05–06: logótipo completo; 07–08: perfil + AutoNunes; 09–10: AUTO/NUNES em duas linhas; 11–12: AutoNunes numa linha. Cada composição tem a versão original para fundo claro e escuro. Não há garantia de leitura de todas as letras a 16 px; a comparação mostra esse limite sem substituir o nome por outras iniciais.\n\nA série anterior 01–04 não foi aceite pelo proprietário por se afastar da marca. Foi conservada sem remoção. Esta série também fica por escolher; nenhuma proposta foi aplicada às apps.\n');
save(`${root}/sources.json`, JSON.stringify({ sources: [original('light'), original('dark')], crops, concepts }, null, 2) + '\n');
const oldIndex = 'docs/favicon-proposals/index.html';
const previousIndex = 'docs/favicon-proposals/anteriores-01-04.html';
if (fs.existsSync(oldIndex) && !fs.existsSync(previousIndex)) save(previousIndex, fs.readFileSync(oldIndex));
save(oldIndex, '<!doctype html><html lang="pt"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Favicons Auto Nunes Martins</title><style>body{font:17px system-ui;max-width:1240px;margin:28px auto;padding:20px;background:#eeeef0;color:#17181c}img{max-width:100%;height:auto}a{color:#a00013}</style><h1>Favicons · Auto Nunes Martins</h1><h2>Série atual: 05–12, com a marca original</h2><p><a href="serie-05-12/index.html">Abrir as oito novas opções e os ficheiros SVG, ICO e PNG</a>. São recortes reais do lettering e do perfil existentes. Nenhuma proposta está ativa.</p><img src="serie-05-12/comparacao-05-12.png" alt="Oito composições com elementos reais da marca"><h2>Série anterior 01–04: não aceite</h2><p>O proprietário rejeitou a direção por se afastar da identidade existente. Os ficheiros foram preservados para histórico e não são a proposta atual. <a href="anteriores-01-04.html">Consultar as quatro opções anteriores</a>.</p></html>');
console.log(`Created eight brand-faithful options and native-size comparison: ${root}/comparacao-05-12.png`);
