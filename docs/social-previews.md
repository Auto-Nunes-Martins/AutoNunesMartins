# Previews de links públicos

## Atualização — 15 de novembro de 2026

**Marca nas fotografias de partilha:** o logótipo transparente existente passa a
aparecer numa faixa cinzenta escura encostada à direita, com 358 × 136 px e
70 px de fotografia visíveis por baixo, na imagem de 1260 × 900. O logótipo tem
248 px de largura e está centrado, com 55 px de folga lateral. Os cantos esquerdos
arredondados, o rebordo e a sombra em duas camadas seguem a referência do story
aprovada pelo proprietário. O enquadramento guardado continua igual; as fotografias do
site e os originais não recebem esta marca. O overlay é preparado uma vez por
processo e reutilizado. A receita muda para `social-main-v3-logo-panel`, para novas
partilhas receberem um endereço diferente. A homepage e o catálogo mantêm a imagem
anterior só com o logótipo.

Validação deste ajuste: seis testes do renderizador e três testes HTTP passaram;
o backend compilado inclui os dois logótipos e gera a fotografia com a marca.
As 15 comparações de enquadramento com CSS continuam a passar fora do canto
intencionalmente ocupado pela marca.

**Ajuste posterior pedido pelo proprietário:** início e catálogo voltaram a usar
apenas o logótipo anterior (`auto-nunes-martins-v1.png`, 1200 × 630), sem texto ou
separadores desenhados na imagem. A composição de marca descrita abaixo foi
experimentada e retirada dos metadados. Mantêm-se os textos mais diretos e o
enquadramento da fotografia nas partilhas das fichas de viaturas.
Os endereços antigos da composição de marca também passam a servir apenas o
logótipo. O renderizador deixa de desenhar texto ou carregar fontes; foi observado
texto em quadrados na imagem gerada em produção, apesar dos testes locais passarem.

Implementação local, sem alteração das fotografias originais, do CRM ou do desenho
das páginas. A geração é pedida pelo crawler ao ler a imagem, não durante o
carregamento normal do site. Não há migração, escrita em base de dados ou upload
de novas fotografias para Storage.

- Início: composição de marca própria, JPEG 1200 × 630, com o logótipo existente
  e «O seu próximo carro. Há mais caminho pela frente.». Texto de apresentação
  mais direto. A imagem estática pesa aproximadamente 55 kB.
- Catálogo: composição 1200 × 630 com a marca registada da pesquisa (por exemplo,
  «BMW usados»); pesquisa por modelo mantém a marca na imagem e o modelo no título.
  Estados vazios e regras de canonical/noindex continuam a ser respeitados.
- Viatura: preço público no título, ano/quilómetros/combustível na descrição e
  reserva explícita quando aplicável; preço e quilometragem desconhecidos não são
  inventados. JSON-LD continua a referir a fotografia original pública.
- Imagem de viatura: JPEG 1260 × 900 (proporção 1,4 da moldura principal desktop),
  aplicando posição, zoom e fit guardados para a primeira fotografia pública.
  Usa a geometria partilhada com o editor e a galeria, incluindo o fundo desfocado
  quando a fotografia é mostrada inteira. Não usa o enquadramento independente
  dos cartões nem o mobile: uma imagem de partilha é fixa e não muda ao rodar o ecrã.
  Não se força 1200 × 630 na viatura, porque isso cortaria uma região diferente.
- O endereço muda se a foto principal, posição, zoom ou fit desktop mudar.
  Imagens vindas de versões antigas da API mantêm o fallback anterior, sem
  anunciar dimensões desconhecidas. Fichas sem foto mantêm a imagem de marca.
- O endpoint revalida publicação, elegibilidade e pertença antes de servir bytes
  ou responder 304. Versões antigas de uma foto/enquadramento deixam de ser
  servidas; respostas de falha usam `no-store`. As plataformas externas podem
  conservar imagens já descarregadas; não prometemos atualização ou remoção
  imediata de mensagens antigas.
- A cache guarda apenas bytes em memória: até 8 MiB, 64 entradas, uma hora, com
  duas gerações simultâneas e reutilização de pedidos iguais. Pode voltar a gerar
  após expiração, expulsão ou reinício. A geração tem custo de CPU no servidor;
  não é trabalho manual, nem processamento no telemóvel do visitante.
- Inter completa, licença OFL e logótipo acompanham o backend compilado; nenhuma
  dependência nativa ou fonte de geração entra no JavaScript do navegador.

Validação: 11 páginas SSR e quatro user agents de crawlers, limites e versões das
imagens, autorização/revogação, desconhecidos/reservas, cache concorrente e
comparação com CSS no Chrome em 15 combinações de proporções/posição/zoom. Na
comparação à escala de preview, sobreposição dos elementos de referência ≥ 98%
e erro médio RGB máximo 3,165/255 (JPEG e interpolação diferentes). Foi também
inspecionada uma cópia local do BMW do exemplo usando o seu enquadramento público.
Build do site e backend e verificação Svelte passaram. As verificações locais não
substituem uma partilha real após publicação; o formato final do cartão pertence
à aplicação que recebe o link.

Comandos de regressão:

```sh
node scripts/check-social-previews.mjs
node --import tsx backend/test/socialFraming.browser.mjs
npm run test --workspace @anm/backend -- src/lib/server/socialImages.test.ts src/routes/publicVehicles.test.ts
npm run test --workspace @anm/website -- src/lib/socialImages.test.ts src/lib/server/socialImages.test.ts src/lib/vehicleSeo.test.ts
```

### Registo original

Implementação e verificação local: 14 de outubro de 2026. Não constitui aprovação de publicação.

## Cobertura

`SocialMetadata.svelte` fornece um único conjunto de Open Graph e Twitter Cards no HTML SSR, com título, descrição, URL canonical, imagem absoluta, texto alternativo, idioma `pt_PT`, nome do site e tipo `website`. Não são inventados identificadores sociais, contactos ou domínio. A origem vem do pedido, como nas canonicals e no JSON-LD existentes; validar domínio final, aliases, HTTPS e redirecionamentos no alojamento escolhido.

- Início, Quem Somos, catálogo, filtros e paginação: imagem de marca.
- Fichas públicas: primeira fotografia da projeção pública aprovada, através de `/viaturas/{slug}/photos/0`. O endereço é estável, no mesmo website e sem token assinado. O endpoint existente continua a consultar a API pública, a validar MIME e a impedir acesso a fotografias não publicadas. Não foi alterada a allowlist de dados.
- Fichas sem fotografia: imagem de marca. O JSON-LD continua sem fotografia de produto nestes casos: um logótipo não representa a viatura.
- Favoritos, comparação, informação legal e privacidade: metadados e imagem de marca, mantendo `noindex`. A seleção local de favoritos/comparação não é partilhada pelo URL.
- Demos do DesignEdition: imagem de marca e `noindex` existentes; nenhum veículo ilustrativo passa a ser stock aprovado. O laboratório Porsche mantém a sua política de demonstração.

## Imagem

`apps/website/static/images/social/auto-nunes-martins-v1.png`: PNG opaco, 1200 × 630 px, 131425 bytes. Reutiliza o logótipo branco/vermelho existente, centrado num fundo escuro; não contém fotografia fictícia, domínio ou contacto. Dimensões e MIME só são declarados para este asset conhecido. Nas fotografias de viaturas, a projeção atual não fornece dimensões nem MIME; não são inventados valores.

Uma fotografia pública pode ter proporção/tamanho diferentes e ser recortada pela plataforma. O proxy existente admite JPEG, PNG e WebP até 10 MiB; essa validação técnica não garante que qualquer fotografia cumpra todos os limites particulares de cada plataforma. Verificar os uploads reais e a imagem final no domínio público.

## Verificação reproduzível

`npm run test:social --workspace @anm/website` inicia um Vite local e uma API pública fictícia em portas livres, consulta HTML SSR como crawlers e termina ambos os processos. Não usa CRM, storage, segredos reais ou envio de mensagens.

Foram verificadas 12 rotas: início, Quem Somos, catálogo, marca, filtro combinado, favoritos, comparação, legal, privacidade, duas fichas (com/sem foto) e uma demo. Verifica títulos/descrições, ausência de tags duplicadas, URLs absolutas e coerência canonical/JSON-LD, alt, ficheiro PNG servido com 200/MIME/dimensões/bytes, preservação do `noindex` e remoção de um campo privado deliberadamente presente na fixture. User agents: Discordbot, Twitterbot, facebookexternalhit e WhatsApp. A fotografia da fixture é um PNG local; esta prova não confirma fotografias reais ou acesso externo.

Suite existente: 337 testes aprovados; Svelte check: 0 erros, 0 avisos. As alterações foram aplicadas ao projeto principal preservando os formulários e outras alterações existentes. Não houve push, deploy ou mensagens nas plataformas.

Build local: cliente e servidor compilaram; o adapter Vercel voltou a falhar com `EPERM` ao criar o symlink `index.func` no Windows. O build de publicação continua pendente; não foi alterada a configuração do adapter para esconder esta limitação.

## Plataformas e validação externa pendente

A implementação segue o [Open Graph](https://ogp.me/) e inclui `twitter:card=summary_large_image`. A documentação de Cards de X redirecionou para a documentação geral nesta consulta; a página de webmasters da Meta devolveu limite de pedidos. Não se presume validação externa a partir desses acessos.

[Discord descreve a leitura de metadados pelo seu crawler](https://support.discord.com/hc/en-us/articles/42500550752919-About-Discord-Link-Previews-and-the-Discordbot). [WhatsApp permite desativar previews](https://faq.whatsapp.com/445453537819972/?cms_platform=iphone). Facebook e X podem guardar resultados em cache. Os metadados são preparados para estes consumidores, mas apresentação, recorte, atualização e decisão de mostrar uma preview pertencem às plataformas. No Instagram, só haverá preview nos contextos em que a aplicação a suporte; não se promete preview em legendas, Stories, bio ou mensagens, nem renderização idêntica.

Depois de existir domínio público autorizado, confirmar respostas 200 do HTML e imagens por HTTPS sem autenticação, desafios anti-bot ou firewall a bloquear os crawlers; inspeção dos bytes das fotos reais, alt e recorte; canonical e redirecionamentos; comportamento de cache e eventual nova leitura através das ferramentas oficiais disponíveis. O `robots.txt` permite crawlers. Vercel preview e `SITE_NOINDEX=true` mantêm o cabeçalho de exclusão dos motores, sem bloquear pedidos de imagens; alojamentos com proteção de acesso podem impedir previews externas.

As pendências de identidade, contactos, privacidade, conteúdo, domínio e publicação permanecem em `publication-readiness.md` e `publicationReadiness.json`; nenhum item foi marcado `verified`.
