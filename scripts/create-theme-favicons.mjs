// Change only the background of the exact stacked artwork from proposals 09/10.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const sharp = createRequire(new URL('../backend/package.json', import.meta.url))('sharp');
const root = 'docs/favicon-proposals/serie-13-20';
const previous = 'docs/favicon-proposals/serie-05-12';
const save = (file, bytes) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, bytes); };
const palettes = [
  { number: 13, id: '13-carvao-pagina', label: 'Carvão · página', color: '#0c0c0e', tone: 'dark', file: 'DesignEdition.svelte', literal: '--bg: #0c0c0e' },
  { number: 14, id: '14-carvao-rodape', label: 'Carvão · rodapé', color: '#101012', tone: 'dark', file: 'OrbitCompactFooter.svelte', literal: 'background: #101012' },
  { number: 15, id: '15-carvao-superficie', label: 'Carvão · superfície', color: '#17171a', tone: 'dark', file: 'DesignEdition.svelte', literal: '--surface: #17171a' },
  { number: 16, id: '16-grafite', label: 'Grafite · controlo', color: '#252528', tone: 'dark', file: 'DesignEdition.svelte', literal: 'background: #252528' },
  { number: 17, id: '17-branco', label: 'Branco · superfície', color: '#ffffff', tone: 'light', file: 'DesignEdition.svelte', literal: '--surface: #fff;' },
  { number: 18, id: '18-branco-orbit', label: 'Branco suave · Orbit', color: '#f5f5f1', tone: 'light', file: 'DesignEdition.svelte', literal: '--bg: #f5f5f1' },
  { number: 19, id: '19-branco-base', label: 'Branco suave · base', color: '#f3f3ef', tone: 'light', file: 'DesignEdition.svelte', literal: '--bg: #f3f3ef' },
  { number: 20, id: '20-papel-convite', label: 'Papel · convite', color: '#f6f4ef', tone: 'light', file: 'VisitInvitation.svelte', literal: 'background: #f6f4ef' },
];
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
for (const item of palettes) {
  const file = `apps/website/src/lib/components/stand-concepts/${item.file}`;
  assert(fs.readFileSync(file, 'utf8').includes(item.literal), `Actual theme color: ${item.literal}`);
  const source = `${previous}/${item.tone === 'dark' ? '10-stacked-escuro' : '09-stacked-claro'}/favicon.svg`;
  const original = fs.readFileSync(source, 'utf8');
  const svg = original.replace(/(<rect[^>]*fill=")[^"]+("\/?>)/, `$1${item.color}$2`);
  // Every image element, its geometry and embedded original lettering remain byte-identical.
  assert.equal(svg.match(/<image[\s\S]*/)[0], original.match(/<image[\s\S]*/)[0]);
  save(`${root}/${item.id}/favicon.svg`, svg);
  const images = [];
  for (const size of [16, 32, 48, 64, 128, 180, 256]) {
    const bytes = await sharp(Buffer.from(svg), { density: 384 }).resize(size, size).png({ compressionLevel: 9 }).toBuffer();
    save(`${root}/${item.id}/favicon-${size}.png`, bytes);
    if (size <= 64) images.push({ size, bytes });
  }
  save(`${root}/${item.id}/favicon.ico`, ico(images));
  item.artworkSource = source;
  item.paletteSource = file;
}
const layers = [];
let sheet = '<svg xmlns="http://www.w3.org/2000/svg" width="1240" height="1480"><rect width="1240" height="1480" fill="#eeeef0"/><g font-family="Arial,sans-serif" fill="#17181c"><text x="32" y="40" font-size="25" font-weight="700">AutoNunes · 8 fundos da paleta do website</text><text x="32" y="69" font-size="15">Série 13–20 · composição e lettering exatos de 09/10 · só muda o fundo</text><text x="32" y="93" font-size="14" fill="#62646c">Ampliação a 128 px + ícones nativos de 16/32 px · nenhuma proposta está ativa</text>';
for (const [i, item] of palettes.entries()) {
  const x = 24 + i % 2 * 620, y = 115 + Math.floor(i / 2) * 335;
  sheet += `<rect x="${x}" y="${y}" width="592" height="313" rx="13" fill="#fff"/><text x="${x + 18}" y="${y + 31}" font-size="19" font-weight="700">${item.number} · ${item.label}</text><text x="${x + 18}" y="${y + 56}" font-size="14" fill="#62646c">${item.color.toUpperCase()}</text><rect x="${x + 185}" y="${y + 76}" width="385" height="82" rx="8" fill="#f0f0f3"/><rect x="${x + 185}" y="${y + 174}" width="385" height="82" rx="8" fill="#24252a"/><text x="${x + 202}" y="${y + 98}" font-size="11" fill="#666970">SEPARADOR CLARO</text><text x="${x + 202}" y="${y + 196}" font-size="11" fill="#b8bbc5">SEPARADOR ESCURO</text><text x="${x + 238}" y="${y + 129}" font-size="13">AutoNunes</text><text x="${x + 238}" y="${y + 227}" font-size="13" fill="#ededf1">AutoNunes</text><text x="${x + 480}" y="${y + 129}" font-size="12" fill="#686b75">32 px</text><text x="${x + 480}" y="${y + 227}" font-size="12" fill="#b8bbc5">32 px</text><text x="${x + 18}" y="${y + 294}" font-size="12" fill="#63666f">Fundo real do site · letras e vermelho originais intactos</text>`;
  layers.push({ input: fs.readFileSync(`${root}/${item.id}/favicon-128.png`), left: x + 27, top: y + 95 });
  for (const offset of [0, 98]) {
    layers.push({ input: fs.readFileSync(`${root}/${item.id}/favicon-16.png`), left: x + 209, top: y + 116 + offset });
    layers.push({ input: fs.readFileSync(`${root}/${item.id}/favicon-32.png`), left: x + 434, top: y + 107 + offset });
  }
}
sheet += '</g></svg>';
save(`${root}/comparacao-13-20.png`, await sharp(Buffer.from(sheet)).composite(layers).png().toBuffer());
save(`${root}/index.html`, `<!doctype html><html lang="pt"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>13–20 · fundos do website</title><style>body{font:16px system-ui;max-width:1240px;margin:30px auto;padding:20px;background:#eeeef0;color:#202126}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(450px,1fr));gap:18px}article{background:white;padding:22px;border-radius:14px}h1{font-size:28px}h2{font-size:20px}.large{width:128px;height:128px}.tab{display:flex;align-items:center;gap:12px;padding:16px;margin:12px 0;background:#eeeef3;border-radius:8px}.dark{background:#24252a;color:white}a{color:#a90012}img{object-fit:contain}.comparison{max-width:100%;height:auto}</style><h1>AutoNunes · série 13–20</h1><p>Oito fundos retirados das cores reais do website. A composição AUTO / NUNES, o lettering e o vermelho são os mesmos das opções 09/10. Só muda a cor de fundo.</p><p>Nenhuma proposta está ativa e não foi implementada troca automática com o tema. Ver os exemplos nativos a 100% de zoom: a leitura a 16 px continua limitada pelo tamanho, sem substituir o nome por iniciais.</p><div class="grid">${palettes.map(item => `<article><h2>${item.number} · ${item.label}</h2><p><code>${item.color.toUpperCase()}</code> · ${item.literal}</p><img class="large" src="${item.id}/favicon-128.png" alt="${item.number} ampliado a 128 px">${['', 'dark'].map(t => `<div class="tab ${t}"><img src="${item.id}/favicon-16.png" width="16" height="16" alt="16 px">AutoNunes <img src="${item.id}/favicon-32.png" width="32" height="32" alt="32 px">32 px</div>`).join('')}<p><a href="${item.id}/favicon.svg">SVG</a> · <a href="${item.id}/favicon.ico">ICO</a> · <a href="${item.id}/favicon-180.png">PNG 180</a> · <a href="${item.id}/favicon-256.png">PNG 256</a></p></article>`).join('')}</div><h2>Comparação geral</h2><img class="comparison" src="comparacao-13-20.png" alt="Oito fundos em tamanho ampliado e nativo"></html>`);
save(`${root}/palette-sources.json`, JSON.stringify(palettes, null, 2) + '\n');
save(`${root}/README.md`, '# Série 13–20 — fundos reais do website\n\nSó varia o fundo da composição AUTO/NUNES das opções 09/10. Os elementos image dos SVG, incluindo dados dos recortes originais e geometria, são verificados como idênticos aos da opção de origem. Cores e proveniência CSS em palette-sources.json.\n\n13 #0C0C0E página escura; 14 #101012 rodapé; 15 #17171A superfície escura; 16 #252528 controlo grafite; 17 #FFFFFF superfície clara; 18 #F5F5F1 Orbit claro; 19 #F3F3EF base clara; 20 #F6F4EF papel do convite. O branco/escuro das letras vem do logótipo original apropriado, sem recoloração.\n\nPNG 16/32/48/64/128/180/256, ICO com 16/32/48/64, SVG auto-contido com a arte original incorporada. Comparar index.html a 100% de zoom ou comparacao-13-20.png. Todas as séries anteriores foram preservadas. Nenhuma proposta aplicada às apps; não há troca automática por tema, commit, push ou deploy.\n');
console.log(`${root}/comparacao-13-20.png`);
