import fs from 'node:fs';
import { createRequire } from 'node:module';
const sharp = createRequire(new URL('../backend/package.json', import.meta.url))('sharp');
const root = 'docs/image-optimization';
const overlays = [];
let svg = '<svg xmlns="http://www.w3.org/2000/svg" width="1120" height="1260"><rect width="1120" height="1260" fill="#eeeef0"/><g font-family="Arial,sans-serif"><text x="32" y="40" font-size="26" font-weight="700">Imagens Auto Nunes Martins · verificação</text><text x="32" y="70" font-size="15" fill="#555">Originais preservados · sem alterações de enquadramento · logótipos com alpha</text><text x="40" y="112" font-size="17">Original redimensionado (referência)</text><text x="590" y="112" font-size="17">Novo derivado (mesmo tamanho)</text>';
for (const [i, tone] of ['light', 'dark'].entries()) {
  const y = 130 + i * 208;
  const source = `apps/website/static/${tone === 'light' ? 'logo-transparent.png' : 'logo-transparent-white-v3.png'}`;
  const bg = tone === 'light' ? '#f8f8f4' : '#101114';
  svg += `<rect x="32" y="${y}" width="510" height="188" rx="12" fill="${bg}"/><rect x="578" y="${y}" width="510" height="188" rx="12" fill="${bg}"/>`;
  overlays.push({ input: await sharp(source).resize(360).png().toBuffer(), left: 108, top: y + 14 });
  overlays.push({ input: await sharp(`apps/website/src/lib/assets/optimized/logo-${tone}-360.webp`).png().toBuffer(), left: 654, top: y + 14 });
}
for (const [i, stem] of ['auto-nunes-martins-fachada', 'auto-nunes-martins-fachada-v2'].entries()) {
  const y = 590 + i * 310;
  svg += `<text x="32" y="${y - 12}" font-size="17">Fachada ${i + 1} · detalhe a 100% (JPEG original / AVIF 75)</text><rect x="32" y="${y}" width="510" height="280" fill="#fff"/><rect x="578" y="${y}" width="510" height="280" fill="#fff"/>`;
  const extract = { left: 270, top: 290, width: 510, height: 280 };
  overlays.push({ input: await sharp(`apps/website/static/images/about/${stem}-1024.jpg`).extract(extract).png().toBuffer(), left: 32, top: y });
  overlays.push({ input: await sharp(`apps/website/src/lib/assets/optimized/facade-${i + 1}-1024.avif`).extract(extract).png().toBuffer(), left: 578, top: y });
}
svg += '</g></svg>';
fs.writeFileSync(`${root}/comparacao-qualidade.png`, await sharp(Buffer.from(svg)).composite(overlays).png().toBuffer());
const manifest = JSON.parse(fs.readFileSync(`${root}/manifest.json`, 'utf8'));
fs.writeFileSync(`${root}/index.html`, `<!doctype html><html lang="pt"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Derivados de imagem · Auto Nunes Martins</title><style>body{font:15px system-ui;margin:28px;background:#f2f2f4;color:#222}main{max-width:1150px;margin:auto}table{width:100%;border-collapse:collapse;background:white}td,th{text-align:left;padding:10px;border-bottom:1px solid #ddd}img{max-width:100%;height:auto}code{font-size:12px}</style><main><h1>Derivados de imagem · Auto Nunes Martins</h1><p>Originais intactos. Imagens do hero mantêm a resolução máxima; a redução de dimensões aplica-se aos logótipos e às variantes responsivas da página Quem somos.</p><img src="comparacao-qualidade.png" alt="Comparação de logótipos e detalhes das fachadas"><table><thead><tr><th>Ficheiro</th><th>Dimensões</th><th>Bytes</th><th>Alpha</th><th>Erro médio RGB visível / 255</th></tr></thead><tbody>${manifest.assets.map(a => `<tr><td><code>${a.output}</code></td><td>${a.width} × ${a.height}</td><td>${a.bytes.toLocaleString('pt-PT')}</td><td>${a.alpha ? 'Sim' : 'Não'}</td><td>${a.visibleMeanError}</td></tr>`).join('')}</tbody></table></main></html>`);
console.log('Created comparison of alpha logos and full-resolution photo details.');
