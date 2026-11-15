# Revisão de performance — 15/11/2026

Objetivo: reduzir trabalho desnecessário no site público e CRM, preservando o desenho final, fotografias, animações e operações. Referência inicial: `8e92a3e`. As alterações locais de filtros/listas/vendas que já existiam no checkout ficaram fora deste trabalho.

## Alterações

- **JavaScript público e CRM:** declarar o pacote partilhado de tipos/validações como livre de efeitos laterais permite eliminar módulos não utilizados de cada bundle. Os validadores usados pelos formulários continuam presentes e testados.
- **Fitas de promoção:** a textura SVG passa de uma árvore de filtros repetida em cada cartão para um recurso imutável partilhado. Mantém os mesmos caminhos, filtros, dimensões e sombras. Na homepage de teste, menos 44 elementos no DOM para duas fitas.
- **Scroll:** a faixa de marcas reutiliza a largura medida pelo ResizeObserver; os títulos deixam de medir todos os fragmentos quando o efeito já chegou ao extremo invisível; o destaque do CTA partilha o agendamento de leituras/escritas de scroll. Mantêm-se as durações e os valores visuais.
- **Menus:** os seletores públicos e os menus de ações das linhas do CRM só instalam os listeners globais necessários enquanto estão abertos. Uma tabela deixa de executar um handler de scroll por cada menu fechado.
- **Formulários de viatura:** edição e retoma de rascunho consultam viatura e fotografias em paralelo, em vez de esperar por uma antes de iniciar a outra. Preservados os erros de autorização e o fallback de fotografias indisponíveis.
- **Estabilidade:** o alinhamento vertical do destaque da homepage é calculado antes da primeira apresentação e conservado na hidratação. Favoritos e Comparar reservam a geometria do estado vazio enquanto leem a seleção local, evitando deslocar a nota inferior. O conteúdo final mantém o mesmo desenho.
- **Verificação repetível:** acrescentados medidores de recursos/scroll, análise estática de bundles e comparação de píxeis da fita. Atualizadas as fixtures isoladas do CRM para os contratos atuais de carregamento, sem ligação a dados reais.

## Resultados medidos

Bytes de JavaScript descomprimidos observados no browser, cache nova, dados sintéticos, largura 390 px. Os valores de desktop foram iguais. Estes números não são bytes comprimidos transferidos nem notas PageSpeed.

| Página           |   Antes |  Depois | Redução |
| ---------------- | ------: | ------: | ------: |
| Homepage         | 566 250 | 555 709 |  10 541 |
| Catálogo         | 590 252 | 579 711 |  10 541 |
| Ficha de viatura | 677 819 | 667 279 |  10 540 |
| Quem somos       | 577 969 | 567 428 |  10 541 |
| Favoritos        | 581 105 | 570 812 |  10 293 |
| Comparar         | 584 810 | 574 472 |  10 338 |
| Informação legal | 571 902 | 561 361 |  10 541 |
| Privacidade      | 581 348 | 570 807 |  10 541 |
| Termos           | 572 306 | 561 765 |  10 541 |

No CRM, o modelo estático de módulo de página + shell autenticada encontrou reduções de 24 396 bytes na dashboard, 26 510 em campanhas, 24 405 em destaques, 25 005 em reviews e 10 175 na lista de viaturas. Este modelo exclui imports dinâmicos e layouts aninhados: não representa o total transferido numa sessão autenticada.

A textura da fita teve diferença média de píxeis **zero** nas seis comparações: 220×44, 192×40 e 240×54, com DPR 1 e 2. A utilização de um recurso partilhado reduz nós/hidratação; não foi medida isoladamente uma percentagem de redução de GPU.

Durante a revisão foram observadas somas de deslocamentos de 0,00728 no destaque, 0,00961 em Favoritos e 0,00659 em Comparar. Após as correções, os retestes dessas páginas registaram **zero** em desktop e mobile. As restantes seis páginas também registaram zero na ronda completa. São janelas locais de observação, não CLS de campo ao percentil 75.

## Verificação

- Builds de produção do site e CRM concluídos. Tipos: site sem erros/avisos; CRM sem erros, com seis avisos preexistentes.
- 920 testes do site, 416 do CRM, 62 do pacote partilhado e 21 de deployment aprovados.
- Nove páginas públicas em 390 e 1440 px: carregamento e scroll sem erros de JavaScript ou overflow da página. CPU limitada a 4× no perfil mobile; rede local sem limitação.
- 24 páginas do CRM, em 1440 px/tema escuro e 390 px/tema claro, com fixtures: sem erros de JavaScript. Mais 12 perfis de campanhas, destaques e lista de viaturas cruzam ambos os temas e larguras, incluindo cartões preenchidos. Menus verificados com Escape e fecho por scroll. As regiões largas de tabelas, gráficos, galeria e navegação continuam com o seu recorte/scroll próprio.
- Homepage: 16 cenários de carregamento/reload, fontes imediatas ou atrasadas 650 ms, desktop/mobile e movimento reduzido; mais cinco cenários de HTML/CSS progressivos. Geometria estável.
- Campanhas de produção local: contadores e descontos presentes, secção vazia oculta. Carrossel e movimentos públicos passaram em Chromium, incluindo larguras móveis e movimento reduzido.

## Limites e decisões

Foram revistos carregamento de recursos/fontes, árvore de componentes, listeners, scroll, temporizadores, pedidos de dados e políticas de cache. Mantiveram-se as proteções já existentes: fontes locais/preloads, dimensões reservadas, pausas fora de vista, imports por procura, autorização e ausência de cache partilhada para respostas privadas. Não se alteraram compressão/recorte das fotografias, camadas decorativas ou regras financeiras.

Não se mediram novas notas Lighthouse/PageSpeed nem dispositivos físicos, Safari ou uma sessão CRM real com dados/latência de produção. As durações de CPU/scroll oscilaram entre rondas; não sustentam uma percentagem global de aceleração. A floresta do hero continua a ser um recurso importante para LCP em rede lenta; reduzir a sua qualidade contrariaria a preservação visual pedida. Os resultados não garantem uma nota específica de produção.

## Repetição

Depois dos builds, a partir de `apps/website`:

```powershell
node test/heroLayout.browser.mjs --performance
node test/heroLayout.browser.mjs
node test/heroLayout.browser.mjs --stream
node test/heroLayout.browser.mjs --production-campaigns
node test/heroLayout.browser.mjs --interactions
```

A partir da raiz:

```powershell
node scripts/check-ribbon-texture.mjs
node scripts/measure-route-bundles.mjs crm
node scripts/check-crm-review.mjs --screenshots
node --test deployment/*.test.mjs
```

`PERFORMANCE_ROUTES` e `PERFORMANCE_OUTPUT` limitam rotas/destino das medições públicas. `CRM_ROUTES` e `CRM_ALL_THEMES=1` permitem focar a matriz do CRM. Os relatórios detalhados locais estão em `.cache/performance-*`; capturas da homepage em `apps/website/.svelte-kit/hero-*` e do CRM em `.cache/crm-review`. Nenhum destes testes grava dados de negócio.

## Seguimento dos relatórios Lighthouse enviados pelo proprietário

Referência deste seguimento: `f2c9c42`. Os dois JSONs Lighthouse 13.5.0, recolhidos em 15/11/2026 cerca das 16:23 UTC, identificam os modos em `configSettings.formFactor`:

| Métrica     | Mobile | Desktop |
| ----------- | -----: | ------: |
| Performance |     70 |      91 |
| FCP         | 2,51 s |  0,68 s |
| LCP         | 6,67 s |  1,97 s |
| TBT         | 202 ms |   23 ms |
| CLS         |      0 |       0 |

O LCP é a floresta do header em ambos. As durações acima são simuladas pelo Lighthouse; não devem ser somadas aos tempos observados do detalhe de rede. Os ficheiros enviados não contêm dados de INP de utilizadores reais.

### Ajustes aplicados

- Corrigida a estimativa de tamanho das imagens mobile para o header compacto atual. Mantêm-se o recorte aprovado, a posição, o zoom inicial de 1,055, a seleção nativa por DPR e os mesmos derivados existentes. O preload e o `picture` usam a mesma constante. Não se alteram masters, receitas de compressão nem fotografias das viaturas.
- Acrescentado um derivado desktop de 1600 px, entre 1280 e 1920, em AVIF e WebP, com a receita já existente (AVIF 55/effort 5/4:2:0; WebP 88). Evita o salto para 1920 em ecrãs que precisam de aproximadamente 1500–1600 píxeis úteis. Os derivados maiores continuam disponíveis.
- Nas ofertas mobile, repostos os quatro brilhos do sublinhado do desktop, removido o atraso adicional de 90 ms e conservado o percurso da luz sobre as letras. Continua sem aparecer uma linha residual nos extremos nem brilho no topo da página. A palavra “Oferta(s)” continua sem iluminação; deixou também de receber cálculos de luz que já não eram usados pelo seu CSS.
- Nos títulos animados, reutilizada a geometria interna durante o scroll. Mudanças de tamanho, quebra de linha, fontes ou conteúdo invalidam essa medição. A sequência partilhada continua a ler antes de escrever. No CTA “Ver todas as viaturas”, uma frame pendente é cancelada ao sair de vista e o efeito é reconciliado ao voltar a um separador visível.

### Transferência da imagem do header

Comparação local com cache nova e o mesmo stock sintético, não comparação de notas Lighthouse. Bytes do corpo AVIF selecionado pelo browser. Nos perfis alterados, a densidade cobre o DPR e o zoom inicial; o perfil 430 px/DPR 3 mantém exatamente o mesmo maior derivado, já limitado pela resolução original.

| Ecrã / DPR    |     Antes |  Depois | Redução |
| ------------- | --------: | ------: | ------: |
| 320×568 / 2   |   709 706 | 471 552 |   33,6% |
| 375×667 / 2   |   761 369 | 471 552 |   38,1% |
| 390×844 / 2   |   629 597 | 485 992 |   22,8% |
| 412×823 / 1,5 |   389 937 | 282 360 |   27,6% |
| 540×720 / 2   | 1 032 606 | 709 706 |   31,3% |
| 1440×900 / 1  |   580 646 | 410 547 |   29,3% |

Também verificados 430×932, 700×950, 701×950, 1050×900, 1564×917 e 1920×1080. Quando o tamanho necessário não muda de candidato, não há redução de bytes. As imagens renderizadas foram comparadas no enquadramento real e em recortes de detalhe. Derivados de resoluções diferentes não têm píxeis idênticos; não se mudou composição, luminosidade, filtros ou parâmetros de qualidade.

### Verificação e limites deste seguimento

- Build público concluído; Svelte/TypeScript sem erros nem avisos; 921 testes aprovados.
- Sublinhados das ofertas, “Ver todas as viaturas”, “fazer sentido” e da mensagem de confiança em Quem Somos: brilho, geometria, scroll, hover, swipe e movimento reduzido verificados na compilação de produção em 390, 700, 701 e 1440 px. Capturas locais guardadas em `.cache/underline-review-*`.
- As verificações acima também concluíram em WebKit 26.4 para Windows. O processo de teste ficou preso ao encerrar depois de imprimir os quatro resultados; foram terminados apenas esse processo e o seu servidor isolado. Não é uma verificação num iPhone físico.
- 16 perfis de fontes/reload/movimento reduzido e cinco de HTML/CSS progressivos continuam estáveis.
- Homepage e Quem Somos: CLS observado de zero em 390 e 1440 px; sem erros de execução, com CPU 4× no mobile. Rede local, sem simular a rede de produção.
- O script Cookiebot mantém a ordem necessária ao bloqueio automático. A documentação do fornecedor exige que este modo seja carregado antes dos outros scripts e sem `async`/`defer`: [funcionamento do bloqueio automático](https://support.cookiebot.com/hc/en-us/articles/11438730619804-How-does-auto-blocking-work). Não se trocou consentimento por uma melhoria artificial da pontuação.

A comparação não atribui uma nova nota de produção nem garante um ganho global de LCP/INP. Depois do deploy, é necessário repetir os dois relatórios nas mesmas condições. Este seguimento não altera o CRM nem as otimizações anteriormente publicadas.

Repetir os testes adicionais a partir de `apps/website`:

```powershell
node test/heroLayout.browser.mjs --hero-delivery
node test/heroLayout.browser.mjs --production-effects
node test/heroLayout.browser.mjs --production-effects --webkit
```

O último comando requer o browser WebKit do Playwright instalado. `HERO_DELIVERY_OUTPUT` escolhe um diretório novo para medições e capturas; `HERO_DELIVERY_BASELINE` aceita um `results.json` anterior para comparar o enquadramento na mesma página.
