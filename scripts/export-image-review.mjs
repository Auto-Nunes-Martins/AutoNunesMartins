import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const destination = process.argv[2];
if (!destination) throw new Error('Usage: node scripts/export-image-review.mjs <review-folder>');
const root = path.resolve(destination);
const copied = [];
const digest = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const refreshOwned = process.argv.includes('--refresh-owned');
const inventoryPath = path.join(root, 'inventario.json');
const oldInventoryBytes = fs.existsSync(inventoryPath) ? fs.readFileSync(inventoryPath) : null;
const oldInventory = oldInventoryBytes ? new Map(JSON.parse(oldInventoryBytes.toString('utf8')).map(item => [item.file, item.sha256])) : new Map();
if (refreshOwned) {
  // Refuse to overwrite even our own exports if the user has edited them.
  for (const [relative, hash] of oldInventory) {
    const file = path.join(root, relative);
    if (fs.existsSync(file) && digest(fs.readFileSync(file)) !== hash) throw new Error(`Preserving user-edited export: ${file}`);
  }
}
function save(relative, bytes) {
  const target = path.resolve(root, relative);
  if (!target.startsWith(root + path.sep)) throw new Error('Invalid export path');
  fs.mkdirSync(path.dirname(target), { recursive: true });
  if (fs.existsSync(target) && digest(fs.readFileSync(target)) !== digest(bytes)) {
    const oldBytes = fs.readFileSync(target), hash = digest(oldBytes);
    const owned = oldInventory.get(relative.replaceAll('\\', '/')) === hash || (relative === 'inventario.json' && oldInventoryBytes && digest(oldInventoryBytes) === hash);
    if (!refreshOwned || !owned) throw new Error(`Preserving different existing file: ${target}`);
    const historyRelative = path.join('Historico', hash.slice(0, 12), relative);
    const history = path.join(root, historyRelative);
    fs.mkdirSync(path.dirname(history), { recursive: true });
    if (!fs.existsSync(history)) fs.writeFileSync(history, oldBytes, { flag: 'wx' });
    if (digest(fs.readFileSync(history)) !== hash) throw new Error('History copy mismatch');
    copied.push({ file: historyRelative.replaceAll('\\', '/'), bytes: oldBytes.length, sha256: hash });
    fs.writeFileSync(target, bytes);
  }
  if (!fs.existsSync(target)) fs.writeFileSync(target, bytes, { flag: 'wx' });
  if (digest(fs.readFileSync(target)) !== digest(bytes)) throw new Error(`Copy mismatch: ${target}`);
  copied.push({ file: relative.replaceAll('\\', '/'), bytes: bytes.length, sha256: digest(bytes) });
}
for (const [source, folder] of [
  ['apps/website/src/lib/assets/optimized', 'Website'],
  ['apps/website/src/lib/assets/favicon', 'Website/Favicon-ativo'],
  ['apps/crm/src/lib/assets/optimized', 'CRM'],
  ['docs/favicon-proposals', 'Favicons'],
  ['docs/image-optimization', 'Comparacoes'],
  ['.cache/image-candidates', 'Ensaios-nao-ativos'],
]) {
  if (!fs.existsSync(source)) continue;
  for (const file of fs.readdirSync(source, { recursive: true })) {
    const full = path.join(source, file);
    if (fs.statSync(full).isFile()) save(path.join(folder, file), fs.readFileSync(full));
  }
}
if (fs.existsSync('apps/website/static/favicon.ico')) save('Website/Favicon-ativo/favicon.ico', fs.readFileSync('apps/website/static/favicon.ico'));
save('index.html', Buffer.from('<!doctype html><html lang="pt"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Imagens Auto Nunes Martins</title><style>body{font:17px system-ui;max-width:1200px;margin:32px auto;padding:20px;background:#eeeef0;color:#17181c}img{max-width:100%;height:auto}a{color:#b40013}li{margin:12px 0}</style><h1>Imagens Auto Nunes Martins</h1><p>Derivados e propostas de 16 de outubro de 2026. Originais preservados no projeto. A variante 31 foi escolhida e aplicada ao website público; as séries anteriores ficam para histórico.</p><ul><li><a href="Favicons/index.html">Abrir a escolha final 31, o histórico e os ficheiros SVG, PNG e ICO</a></li><li><a href="Comparacoes/index.html">Comparação de qualidade e tabela dos 30 derivados</a></li><li><a href="Comparacoes/README.md">Notas de qualidade, dimensões, bytes e limitações</a></li></ul><h2>Favicon escolhido · variante 31</h2><p><a href="Favicons/variante-31/index.html">Abrir comparação e ficheiros</a>. Fundo #1B1B1D, aplicado ao website público. Todas as resoluções, incluindo 192 e 512 px, estão preparadas.</p><img src="Favicons/variante-31/comparacao-25-31-23.png" alt="Comparação 25,31,23"><h2>Variante 30 · fundo visível da página</h2><p><a href="Favicons/variante-30/index.html">Abrir ficheiros e comparação 25 / 30</a>. Única alteração à opção 25: fundo #0C0C0E, confirmado no conteúdo escuro do website.</p><img src="Favicons/variante-30/comparacao-25-30.png" alt="Comparação da opção 25 com a variante 30"><h2>Variante 29 · opção 25 com fundo do website</h2><p><a href="Favicons/variante-29/index.html">Abrir ficheiros e comparação 25 / 29</a>. Única alteração: #101012 → #0A0A0B.</p><img src="Favicons/variante-29/comparacao-25-29.png" alt="Comparação da opção 25 com a variante 29"><h2>Propostas atuais 21–28 · composição revista</h2><img src="Favicons/serie-21-28/comparacao-21-28.png" alt="Oito propostas com alturas de letras e grelha revistas"><p><a href="Favicons/serie-21-28/proveniencia-tipografia.png">Origem do lettering e antes/depois</a>. As séries 05–12 e 13–20 continuam guardadas como estudos anteriores.</p><h2>Série anterior 01–04 · não aceite (histórico)</h2><img src="Favicons/comparacao-favicons.png" alt="Quatro conceitos a 16 e 32 px"><h2>Logótipos e fotografias</h2><img src="Comparacoes/comparacao-qualidade.png" alt="Comparação aos originais"><p>Website e CRM contêm todos os derivados aplicados. Ensaios-nao-ativos conserva os candidatos exploratórios de fotografia, não usados nas apps. inventario.json permite conferir os ficheiros por SHA-256.</p></html>'));
save('inventario.json', Buffer.from(JSON.stringify(copied, null, 2) + '\n'));
console.log(`Copied and SHA-256 verified ${copied.length} files to ${root}`);
