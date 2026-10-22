# Home: sete composições do hero

> **Histórico substituído em 22/10/2026.** As opções 3–7 agora usam a base visual
> da V1, com fotografias diferentes e movimentos próprios. A documentação atual
> está em [Alternativas de fotografia](homepage-hero-photo-variants.md).

O seletor de desenvolvimento tem **1 / 2 / 3 / 4 / 5 / 6 / 7**. A versão 1 é a
predefinida. A versão 2 mantém os componentes, estilos e motion anteriores, sem
alterações. As seis alternativas novas substituem a antiga versão 1 e ocupam
as posições 3–7. O seletor continua ausente no build de produção.

| Versão | Direção                  | Composição e movimento                                                                                                                               |
| ------ | ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1      | Pela estrada fora        | Estrada verde a toda a largura; texto e fotografia da viatura pousam na paisagem. A paisagem acompanha suavemente o scroll.                          |
| 2      | Original preservado      | `HomeHeroV2.svelte`, `homeHeroV2.css`, `HomeHeroV2Backdrop.svelte` e `homeHeroV2Motion.ts` permanecem intactos.                                      |
| 3      | Uma escolha com espaço   | Papel creme, tipografia editorial com itálico, fotografia em arco e filetes finos. Entrada por revelação e ligeiro deslocamento do texto.            |
| 4      | Em primeiro plano        | A fotografia real do destaque ocupa o hero; título sobreposto e uma faixa translúcida de informação. O enquadramento abre ligeiramente com o scroll. |
| 5      | A porta está aberta      | Fachada existente do stand e fotografia ligeiramente inclinada sobre um fundo quente. A fachada desliza suavemente.                                  |
| 6      | Os dias que aí vêm       | Título amplo, fundo azul claro e uma fotografia panorâmica de margem a margem. Deslocamento horizontal muito discreto.                               |
| 7      | Dois olhares, um caminho | Díptico entre estrada costeira e fotografia da viatura, sobre azul profundo. Paisagem e destaque seguem ritmos opostos.                              |

Em mobile, as composições com duas colunas passam a uma sequência vertical.
Todas respeitam `prefers-reduced-motion`, também quando a preferência muda durante
a sessão. Não há autoplay, interceção do scroll ou pinning. Os listeners, observers
e frames de cada montagem são removidos ao trocar de versão.

## Código e dados

- `HomeHeroDirections.svelte`: seis alternativas; fotografia, ficha e navegação
  dos destaques. Usa diretamente `homeHighlights.items`, incluindo `photoIndex`,
  slug, ano, quilometragem, combustível, preço e estado de reserva.
- `homeHeroDirections.css`: regras privadas `.hd-*`; nenhum seletor V2.
- `homeHeroDirections.ts`: nomes do seletor e ação de movimento.
- `DesignEdition.svelte`: apenas import, seleção e montagem das novas alternativas.
- `homeHeroPhoto.css`: seletor adaptado a sete botões, incluindo larguras de 320px.

Fotografias e detalhes apontam para a mesma ficha pública. Os destaques de teste
mantêm a identificação de fotografia ilustrativa e dados de demonstração. Se não
existirem destaques públicos, apresenta-se uma ligação ao catálogo, sem inventar
uma viatura. Se uma fotografia falhar, mantém-se a ficha e mostra-se um aviso.

Os antigos `HomeHeroV1.svelte`, `HomeHeroV1Photo.svelte`, `homeHeroV1.css` e os seus
recursos permanecem como histórico; deixaram de ser montados na página inicial.

## Experimentar

No servidor de desenvolvimento, abrir `/` e usar o seletor inferior. Também é
possível abrir diretamente `/?hero=1` até `/?hero=7`. A seleção inicial é feita
na renderização do servidor, evitando mostrar outra versão antes da hidratação.
Os parâmetros de composição são ignorados em produção.

Website habitual, após integração autorizada: **http://localhost:5173/**.
Preview desta worktree preservado: **http://127.0.0.1:5183/**.

O preview usa as dependências instaladas do checkout original através de uma
junction local ignorada pelo Git. Uma configuração de preview em `.cache/` permite
a leitura desses módulos no Vite. Não é uma dependência de produção nem uma
alteração à configuração partilhada. Numa instalação normal:

```powershell
yarn dev:website
```

## Verificação

```powershell
yarn workspace @anm/website typecheck
yarn workspace @anm/website test
yarn workspace @anm/website build
node scripts/check-home-hero-isolation.mjs http://127.0.0.1:5183
node scripts/check-home-hero-directions.mjs http://127.0.0.1:5183
```

O teste de isolamento existente verifica a V2 com CSS V1 agressivo injetado,
teclado, trocas de versão, temas e movimento reduzido. O novo script verifica as
sete opções em 1440, 1024, 768, 390 e 320px, nos dois temas: 70 combinações. Cobre
fotografias reais carregadas, ligações, navegação dos destaques, largura útil da
imagem mobile, ausência de overflow, separação entre conteúdo e indicação de
scroll, alterações de movimento reduzido, URL direta e falha de fotografia.
As capturas e o relatório JSON ficam em `.cache/hero-directions/`.

A verificação de layout é feita com os destaques públicos atuais. Uma fotografia
nova ou modelos com nomes muito longos podem justificar nova revisão visual.
Estas verificações técnicas não constituem uma avaliação ou aprovação de publicação.

## Recursos decorativos

- V1 usa agora duas imagens locais geradas à medida: estrada panorâmica que conduz
  ao destaque à direita e enquadramento próprio em retrato para mobile.
  Ficheiros ativos `assets/images/hero-directions/road-approved-{1280,1860}.webp` e
  `road-approved-mobile-{640,1086}.webp`. Proveniência, dimensões, pesos e os dois
  prompts finais estão em `road-to-feature.sources.json`, na mesma pasta. Foram
  geradas com a ferramenta integrada ImageGen, sem CLI/API fallback, e otimizadas
  para WebP. Não representam uma localização verificada ou a viatura à venda.
- V5 reutiliza `assets/optimized/facade-2-1024.webp`.
- V7 usa uma paisagem decorativa gerada com a ferramenta integrada ImageGen,
  sem automóveis e sem representar uma localização verificada do stand.
  Ficheiros finais: `assets/images/hero-directions/coast-640.webp` (640×853,
  107092 bytes) e `coast-1086.webp` (1086×1448, 258614 bytes). O original de geração
  permanece em `.cache/hero-directions/coast-master.png`, fora das dependências da
  aplicação. A ferramenta integrada foi usada; não houve CLI/API fallback.

Prompt final da geração:

> Use case: photorealistic-natural. Asset type: decorative background for a Portuguese everyday used-car dealership homepage, not a vehicle sales photograph. Create an editorial landscape photograph of a simple two-lane coastal road curving along the Atlantic coast of Portugal, seen from a modest elevated viewpoint, calm overcast late afternoon. Natural weathered asphalt, low sandy coastal grasses, a few windswept pines, distant blue-grey sea and a spacious pale sky. Understated, welcoming and ordinary, a place for real weekend drives, no luxury architecture or dramatic cinematic effects. Vertical-friendly composition 3:4 with the curve in the lower half and open sea in the upper half, usable as a left-hand portrait panel with light typography in its lower middle. Restrained slate blue, muted sand and sage palette, soft natural light, photographic detail. No cars, no people, no buildings, no text, no logos, no watermark.

## Afinação exclusiva da versão 1

A versão 1 foi reduzida sem alterar a navbar nem as versões 2–7. Na medição a
1440×900, a altura passou de 830px para cerca de 700px (−130px, aproximadamente
16%). A 1440×700 passou de 804px para 700px; a 1024×768, de 730px para 614px.
Em mobile, a redução é mais contida para preservar texto e fotografia: cerca de
776→715px a 390×844 e 815→758px a 320×568, aproximadamente 7–8%.

O destaque mantém a mesma fotografia real configurada, dados e ligações. Em
ambientes com hover e ponteiro fino, acima de 700px, o conjunto tem perspetiva de
1400px, inclinação inicial X de 1° e Y de −1°. O hover/foco aponta a face para o
interior com Y de −6° e elevação de 2px, sem handlers de ponteiro.
Mobile e movimento reduzido mantêm o conjunto estável.

O fundo foi criado para a nova composição: a estrada panorâmica entra pela zona
inferior esquerda e encaminha o olhar para a área do destaque à direita; a versão
em retrato mantém a aproximação pela direita em mobile. As duas fotografias de
fundo são apenas decorativas e não alteram a imagem nem os dados da viatura.

Verificação focada no website original em `http://localhost:5173/?hero=1`: cinco
combinações desktop/tablet/mobile, incluindo ecrãs baixos; imagem de fundo local
correta para cada formato, fotografia do destaque, ligações, hover, ausência de
overflow e movimento reduzido. Typecheck: zero erros e zero avisos. As duas
secções de conteúdo aceites mantiveram hashes idênticos durante esta alteração:
“Venha conhecer-nos” estática; “O próximo passo começa aqui” sem nova afinação.
Capturas e medidas: `.cache/hero-directions/v1-road-report.json`.

### Revisão de detalhe e movimento

A edição final conserva a primeira composição longa aprovada. O panorama fica
alinhado pela base, sem zoom adicional: a estrada entra no canto inferior
esquerdo e prolonga-se até à fotografia real. A edição usa a fotografia de
“O próximo passo começa aqui” como referência de cor e detalhe; a sobreposição
neutra e a saturação de 0,45 acompanham os tons visíveis dessa secção. A referência
e “Venha conhecer-nos” permanecem intactas.

Os masters devolvidos pela ferramenta medem 1860×846 e 1086×1448. Os WebP usam
qualidade 94, sem ampliação artificial ou sharpening. Não são imagens 4K; ecrãs
muito grandes ou com elevada densidade excedem o detalhe nativo disponível.
Os prompts pedidos e as dimensões realmente devolvidas ficam registados em
`road-to-feature.sources.json`.

A entrada revela o título por linhas, depois texto/ligação e destaque, através
de opacidade e deslocações curtas. O scroll move apenas o plano do cenário,
com uma timeline CSS linear e sem suavização que continue após parar. Num
scroll de 400px, a diferença de velocidade produz cerca de 49–52px de movimento
relativo; a margem adicional mantém o fundo coberto. O efeito desliga com
movimento reduzido e o conteúdo permanece visível sem JavaScript.

Verificação final no original: 1440×900, 2560×1440 com DPR 2 e 390×844 com DPR 3;
entrada inicial e refresh, hover para dentro, scroll lento/rápido/inverso e paragem,
movimento reduzido e conteúdo sem JavaScript. Sem erros de execução. A medição
separada da entrada/refresh a 1440 e 390px não registou layout shifts. O relatório
completo de interação também mede mudanças provocadas pela troca dinâmica de
preferência de movimento; não deve ser apresentado como CLS da entrada.
Capturas e medidas em `.cache/hero-directions/accepted-final-report.json` e
`.cache/hero-directions/entry-stability.json`.
