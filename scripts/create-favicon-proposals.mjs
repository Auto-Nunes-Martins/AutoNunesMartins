// Inactive vector concepts based on the existing red/white/charcoal brand and car profile.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const sharp = createRequire(new URL('../backend/package.json', import.meta.url))('sharp');
const root = 'docs/favicon-proposals';
const save = (file, data) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, data); };
const concepts = [
  { id: '01-perfil', name: '01 · Perfil automóvel', note: 'O contorno do carro, sem texto miúdo.', svg: '<rect x="1" y="1" width="62" height="62" rx="14" fill="#101114"/><path d="M9 34C17 32 20 20 33 20C43 20 47 29 53 31L57 36C44 30 40 25 33 25C24 25 23 33 9 34Z" fill="#ef0918"/><path d="M8 41C20 35 30 37 39 38L56 38L56 44L14 44Z" fill="#fff"/>' },
  { id: '02-monograma-nm', name: '02 · Monograma NM', note: 'Nunes Martins, com inclinação desportiva.', svg: '<rect x="1" y="1" width="62" height="62" rx="12" fill="#ed0716"/><g transform="skewX(-8) translate(5 0)" fill="none" stroke="#fff" stroke-width="6" stroke-linejoin="miter"><path d="M10 47V19L27 47V19M35 47V19L44 32L53 19V47"/></g>' },
  { id: '03-a-perfil', name: '03 · A com tejadilho', note: 'Auto, com a silhueta integrada no A.', svg: '<rect x="1" y="1" width="62" height="62" rx="14" fill="#f6f5f0"/><path d="M10 50L27 17H38L53 50H43L39 41H24L20 50ZM28 33H36L32 23Z" fill="#e60716"/><path d="M13 14Q32 2 52 14" fill="none" stroke="#24252a" stroke-width="4" stroke-linecap="round"/>' },
  { id: '04-n-faixa', name: '04 · N com faixa', note: 'Um N forte, com a faixa vermelha da marca.', svg: '<rect x="1" y="1" width="62" height="62" rx="14" fill="#121317"/><path d="M13 49V16H22L42 39V16H51V49H42L22 26V49Z" fill="#fff"/><path d="M10 53L54 8H60L17 53Z" fill="#ed0716"/>' },
];
const wrap = inner => `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">${inner}</svg>`;
function ico(images) {
  const header = Buffer.alloc(6 + images.length * 16);
  header.writeUInt16LE(1, 2); header.writeUInt16LE(images.length, 4);
  let offset = header.length;
  images.forEach(({ size, bytes }, i) => {
    const start = 6 + i * 16;
    header[start] = size === 256 ? 0 : size; header[start + 1] = size === 256 ? 0 : size;
    header.writeUInt16LE(1, start + 4); header.writeUInt16LE(32, start + 6);
    header.writeUInt32LE(bytes.length, start + 8); header.writeUInt32LE(offset, start + 12);
    offset += bytes.length;
  });
  return Buffer.concat([header, ...images.map(image => image.bytes)]);
}
const overlays = [];
let base = '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1080"><rect width="1200" height="1080" fill="#eeeef0"/><g font-family="Arial,sans-serif"><text x="44" y="50" font-size="26" font-weight="700" fill="#17181c">Auto Nunes Martins · propostas de favicon</text><text x="44" y="80" font-size="15" fill="#55575f">Propostas para escolher · nenhum conceito está ativo · 16 e 32 px em tamanho real</text>';
for (const [i, concept] of concepts.entries()) {
  const svg = wrap(concept.svg), folder = `${root}/${concept.id}`;
  save(`${folder}/favicon.svg`, svg);
  const images = [];
  for (const size of [16, 32, 48, 64, 180, 256]) {
    const bytes = await sharp(Buffer.from(svg), { density: 384 }).resize(size, size).png({ compressionLevel: 9 }).toBuffer();
    save(`${folder}/favicon-${size}.png`, bytes);
    if (size <= 64) images.push({ size, bytes });
  }
  save(`${folder}/favicon.ico`, ico(images));
  const y = 110 + i * 236;
  base += `<rect x="32" y="${y}" width="1136" height="216" rx="14" fill="#fff"/><text x="56" y="${y + 34}" font-size="21" font-weight="700" fill="#15161a">${concept.name}</text><text x="56" y="${y + 61}" font-size="14" fill="#60636b">${concept.note}</text><rect x="260" y="${y + 86}" width="420" height="100" rx="9" fill="#f4f4f6"/><rect x="704" y="${y + 86}" width="420" height="100" rx="9" fill="#202126"/><text x="280" y="${y + 111}" fill="#5f626a" font-size="12">SEPARADOR CLARO</text><text x="724" y="${y + 111}" fill="#c0c3cd" font-size="12">SEPARADOR ESCURO</text><text x="325" y="${y + 148}" fill="#31343d" font-size="14">Auto Nunes Martins</text><text x="769" y="${y + 148}" fill="#e4e6eb" font-size="14">Auto Nunes Martins</text><text x="564" y="${y + 148}" fill="#686c76" font-size="12">32 px</text><text x="1008" y="${y + 148}" fill="#b7bbc5" font-size="12">32 px</text>`;
  overlays.push({ input: fs.readFileSync(`${folder}/favicon-64.png`), left: 76, top: y + 100 });
  overlays.push({ input: fs.readFileSync(`${folder}/favicon-16.png`), left: 292, top: y + 135 });
  overlays.push({ input: fs.readFileSync(`${folder}/favicon-32.png`), left: 520, top: y + 126 });
  overlays.push({ input: fs.readFileSync(`${folder}/favicon-16.png`), left: 736, top: y + 135 });
  overlays.push({ input: fs.readFileSync(`${folder}/favicon-32.png`), left: 964, top: y + 126 });
}
base += '</g></svg>';
save(`${root}/comparacao-favicons.png`, await sharp(Buffer.from(base)).composite(overlays).png().toBuffer());
save(`${root}/index.html`, `<!doctype html><html lang="pt"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Propostas de favicon · Auto Nunes Martins</title><style>body{font:16px system-ui;margin:32px;background:#eeeef0;color:#18191d}main{max-width:1120px;margin:auto}h1{font-size:28px}article{padding:24px;background:white;border-radius:16px;margin:20px 0}.samples{display:flex;gap:20px;flex-wrap:wrap}.tab{display:flex;align-items:center;gap:12px;padding:16px 20px;background:#f0f0f4;border-radius:10px}.dark{background:#202126;color:white}img{object-fit:contain}a{color:#ba0010}.icon{width:64px;height:64px}</style><main><h1>Auto Nunes Martins · propostas de favicon</h1><p>Nenhuma proposta está ativa. Comparar a 100% de zoom: os ícones de 16 e 32 px são mostrados em tamanho real.</p>${concepts.map(c => `<article><h2>${c.name}</h2><p>${c.note}</p><div class="samples"><img class="icon" src="${c.id}/favicon.svg" alt="${c.name}">${['', 'dark'].map(tone => `<span class="tab ${tone}"><img src="${c.id}/favicon-16.png" width="16" height="16" alt="16 px">Auto Nunes Martins <img src="${c.id}/favicon-32.png" width="32" height="32" alt="32 px"></span>`).join('')}</div><p><a href="${c.id}/favicon.svg">SVG</a> · <a href="${c.id}/favicon.ico">ICO (16/32/48/64)</a> · <a href="${c.id}/favicon-180.png">PNG 180</a> · <a href="${c.id}/favicon-256.png">PNG 256</a></p></article>`).join('')}</main></html>`);
save(`${root}/README.md`, '# Propostas de favicon (não ativas)\n\nAbrir index.html ou comparacao-favicons.png. SVG originais de cada conceito e PNG 16/32/48/64/180/256, mais ICO com quatro resoluções. Formas vetoriais simples inspiradas nas cores, iniciais e perfil automóvel da marca existente; são propostas para aprovação, não uma nova identidade oficial. Nenhuma aplicação importa esta pasta.\n');
console.log(`Created ${concepts.length} inactive concepts, PNG/ICO/SVG files and comparison gallery in ${root}`);
