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
