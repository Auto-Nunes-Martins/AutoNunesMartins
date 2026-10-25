# Terceira ronda: LCP observado e concorrência de rede

Candidato local de 25 de outubro de 2026, posterior à [segunda ronda](mobile-performance-round2.md). Sem commit, push ou publicação. O objetivo de LCP até 2,5 s **ainda não foi atingido** na ligação limitada utilizada nesta investigação.

A referência de 2,5 s vem da [definição oficial de LCP](https://web.dev/articles/lcp); a classificação real de um site usa o percentil 75 das visitas, não uma única execução local.

## Diagnóstico

O elemento LCP continua a ser a fotografia de floresta do hero. A animação de 4800 ms não bloqueia a sua apresentação: na segunda ronda, com rede/CPU realmente limitadas, o fundo terminou aos 8050 ms e foi apresentado aos 8116 ms. O custo dominante era a transferência concorrente, não um atraso deliberado de animação.

O site público responde com Brotli, confirmado por cabeçalhos em 25/10. No relatório fornecido pelo proprietário, o HTML tinha 201 368 bytes descodificados e 30 714 transferidos. O servidor Node local entregava mais de 216 KB sem compressão. Para comparar corretamente as propostas, esta ronda usa o mesmo proxy Brotli de teste para a base e o candidato. Isso corrige o ambiente de medição; não é uma nova otimização aplicada ao produto. O proxy usa HTTP/1.1 local; não reproduz toda a infraestrutura HTTP/2/CDN de produção.

O carregamento nativo `lazy` iniciava duas fotografias com cerca de 355 KB antes de o fundo terminar, apesar de estarem abaixo da área visível. Já tinham prioridade Low no trace: repetir apenas `fetchpriority="low"` não resolveria este caso mobile.

## Alterações sem mudança da composição

- Mais três patamares de largura, equivalentes a 1472, 1664 e 1728 px do portrait completo, nos dois recortes mobile. O navegador mantém o mesmo requisito `sizes` e deixa de arredondar para uma variante excessivamente grande. No perfil principal escolhe 920 px do recorte, com 505 568 bytes, em vez dos 587 452 bytes da segunda ronda. Mantêm-se AVIF 55/esforço 5/4:2:0 e WebP 88/esforço 6; os 28 assets anteriores ficaram byte a byte iguais. Os 12 novos assets não modificam os ficheiros desktop.
- Fotografias da seleção da homepage mobile afastadas mais de 400 px do viewport esperam pela conclusão do fundo. Mantêm os URLs reais no `img` SSR, dimensões/proporção e carregamento nativo. Uma source SVG transparente de proporção equivalente aplica-se apenas quando JavaScript está disponível. A fonte real é libertada ao aproximar-se do viewport, ao primeiro scroll/redimensionamento efetivo, quando o fundo termina ou falha. Sem JavaScript ou sem suporte à condição de media, o browser usa diretamente o `img` original. O arranque inline também funciona sem depender da hidratação; a ação Svelte cobre navegação interna e limpa listeners ao desmontar.
- Eventos iniciais de scroll/resize sem alteração de posição ou dimensões são ignorados. Um trace de diagnóstico comprovou que esse resize inicial estava a libertar prematuramente as imagens; a condição foi corrigida e tem teste de regressão.

- Removido apenas o preload de Barlow 600 itálico na homepage: a inspeção de todos os elementos com texto encontrou Barlow normal no rodapé e nenhum uso de itálico. A fonte continua disponível no CSS; os preloads das outras rotas permanecem. Inter, Barlow normal e respetivos pesos não foram substituídos.
- Os logótipos da secção de visita e do rodapé passam a usar `loading="lazy"`, mantendo todos os atributos de apresentação e os mesmos ficheiros.

A condição [`scripting`](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/%40media/scripting) é determinada pelo browser. Extensões que bloqueiam seletivamente todos os scripts sem desativar a capacidade de JavaScript podem não refletir essa decisão na condição de media; o fallback sem JavaScript foi verificado com JavaScript efetivamente desativado.

## Resultados comparáveis

Chrome, viewport 412 × 823 / DPR 1,75, CPU 4× e latência configurada de 150 ms. O harness converte o valor nominal de 1638,4 Kbit/s para `1638.4 * 1024 / 8`, ou seja, 209 715 bytes/s (204,8 KiB/s). Duas execuções com throttling real e navegador novo por configuração; mesmo snapshot de dados/imagens e mesma compressão. Não correram builds/encoders próprios ou benchmarks desktop concorrentes durante as medições.

| LCP observado | Segunda ronda com Brotli | Candidato final desta ronda |
| --- | ---: | ---: |
| Execução 1 | 7288 ms | 5036 ms |
| Execução 2 | 7304 ms | 4956 ms |
| Mediana | 7296 ms | 4996 ms |

Redução observada de **2300 ms / 31,5%**. As duas fotografias antes concorrentes passaram a iniciar aos 4964/4875 ms, imediatamente depois de o fundo terminar, em vez de durante a sua transferência. A fotografia de destaque permanece prioritária desde o HTML inicial. O atraso final entre download do fundo e apresentação foi 72–82 ms.

Uma execução Lighthouse simulada por configuração deu 72 → 73 pontos, LCP 10 221 → 9392 ms, FCP 1810 → 1810 ms, TBT 138 → 95 ms, CLS 0 → 0 e transferência 2 202 525 → 2 070 348 bytes. O modelo simulado não reproduziu a dimensão da melhoria observada quando os pedidos dependem do evento de conclusão da imagem. Não se confunde esta execução única com uma mediana nem com uma medição de produção. Acessibilidade/boas práticas/SEO mantiveram-se em 97/100/69.

## Verificação e evidência

- 44 testes focados passaram, incluindo 12 novos casos de prioridade/libertação/fallback/proporção e os testes de tema e paridade de scroll. Build concluído; Svelte check com zero erros e zero avisos.
- Browser: fundo retido artificialmente, scroll imediato, falha do fundo, JavaScript desativado, desktop e navegação interna sem recarregar o documento. Todos passaram, sem erros JavaScript; as caixas das fotografias conservaram as dimensões.
- 24 pares visuais: enquadramento e estilos iguais, um pedido do fundo e sem overflow. Nos 22 pares mobile/tablet, lista de animações/keyframes igual. Nos dois pares desktop, todas as animações anteriores conservaram configuração; apareceram também as três instâncias existentes de `hd-v5-hovering` após a conclusão assíncrona da entrada. Não houve mudança de CSS ou keyframes. Diferença média máxima de cor: 1,54/255; as novas codificações não são pixel idênticas.
- Cache: 182 assets versionados, bytes verificados, GET/HEAD/304 e referências SSR corretos através do gateway local.

Evidência não versionada em `.cache/mobile/`: `round3-compressed-before-network.json`, `round3-compressed-fixed-network.json`, relatórios Lighthouse correspondentes, `round3-behavior.json`, `round3-fonts.json`, `round3-visual-comparison.json`, screenshots e logs de testes/build/cache. O build da segunda ronda ficou preservado em `round2-built`; o snapshot de fontes para integração está em `round2-integration`.

## Custo restante e decisão de produto

O fundo de 505 568 bytes, sozinho, requer cerca de 2,41 segundos a 209 715 bytes/s, antes de latência, descoberta, CSS, fontes, scripts ou fotografia de destaque. Só acrescentar os 150 ms de latência já ultrapassa 2,5 s. Portanto, esta configuração não pode garantir LCP total de 2,5 s apenas com a mesma imagem e este orçamento de rede. Não se reduziu qualidade para apresentar uma pontuação melhor, nem se ocultou conteúdo, alterou a animação ou removeu `noindex`.

Foram preparados apenas em `.cache/mobile/quality-options` exemplos AVIF de qualidade 45 (388 079 bytes), 35 (295 096 bytes) e 25 (212 667 bytes), à mesma resolução/crop. Não fazem parte do produto: representam uma decisão explícita de compressão, exigem revisão visual e medições próprias antes de qualquer adoção. Os valores de bytes não devem ser apresentados como promessas de LCP.

Três alternativas foram depois medidas uma vez cada, com o mesmo proxy, limite de rede/CPU e navegador novo. São experiências isoladas que substituem apenas os bytes do fundo no proxy; não alteram os assets ou o código do produto. As fotografias das viaturas, texto, fontes, composição e animações permaneceram iguais.

| Fundo experimental | Bytes | LCP observado exploratório |
| --- | ---: | ---: |
| 920 px, qualidade 55 — candidato preservado | 505 568 | 4996 ms, mediana de duas execuções |
| 920 px, qualidade 35 — mais compressão | 295 096 | 3924 ms, uma execução |
| 512 px, qualidade 55 — menor densidade | 162 336 | 3440 ms, uma execução |
| 512 px, qualidade 35 — menor densidade e mais compressão | 93 598 | 3276 ms, uma execução |

A inspeção visual de `quality-options/comparison.png` e `detail-comparison.png` mostra perda de textura com maior compressão e suavização mais evidente nas duas alternativas de 512 px. Nenhuma atingiu 2,5 s nesta exploração. A alternativa de 920 px/35 conserva melhor o detalhe do que as de 512 px, mas não é equivalente à qualidade atual. Não foi adotada automaticamente: reduzir esse detalhe é uma decisão de produto perante o requisito de preservar nitidez.

As imagens individuais estão em `quality-options/page-q55.png`, `page-q35.png`, `page-q512-55.png` e `page-q512-35.png`; os traces são `round3-option-q35-network.json`, `round3-option-512-q55-network.json` e `round3-option-512-q35-network.json`. Estes resultados exploratórios não substituem uma validação repetida da opção escolhida nem garantem uma pontuação de produção.
