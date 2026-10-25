# Homepage — entrega de imagens e Lighthouse

Revisão de 24 de outubro de 2026. Esta alteração otimiza a entrega da composição existente. Mantém cores, recortes, zoom, tipografia, conteúdo, interações e os tempos aprovados das animações. Não encerra a preparação para publicação descrita em `publication-readiness.md`.

## Evidência e comparação

O relatório fornecido pelo proprietário, de `https://www.autonunesmartins.com/` às 21:28:29 UTC, usa Lighthouse 13.4.1 e apresenta performance 82, acessibilidade 97, boas práticas 100 e SEO 69. O LCP é a fotografia de fundo do header, não as letras nem a fotografia da viatura. A versão AVIF de 3840 px pesa 2 901 386 bytes. O bloqueio de indexação indicado é `X-Robots-Tag: noindex, follow`.

Foram feitas três execuções antes e três depois no mesmo serviço local compilado, através de `http://127.0.0.1:3080/`, com Chrome, Lighthouse 13.4.1, viewport 1653 × 1296 CSS px, DPR 1,5, perfil desktop, simulação RTT 40 ms / 10 240 Kbit/s e multiplicador de CPU 1. Cada execução usa uma sessão de navegador nova. A origem, o servidor e a máquina diferem da medição pública; os números locais não são uma previsão ou medição de produção.

| Mediana de três execuções | Antes local | Depois local |
| --- | ---: | ---: |
| Performance | 75 (73–76) | 83 (81–84) |
| LCP | 4477 ms | 2760 ms |
| Transferência total | 5 855 421 bytes | 3 970 759 bytes |
| Total Blocking Time | 69 ms | 27 ms |
| CLS | 0 | 0 |
| Acessibilidade | 97 | 97 |
| Boas práticas | 100 | 100 |
| SEO local | 100 | 100 |

O SEO local já era 100: o serviço local não tem o mesmo bloqueio de indexação do ambiente público. Esse valor não representa uma correção do SEO público. O LCP local ainda não atinge o limiar verde desktop; permanecem oportunidades de melhoria.

## Alterações

- Acrescentada a variante de 2880 px do fundo, evitando o salto de 2560 para 3840 px em ecrãs que precisam de cerca de 2600 px físicos. As fontes originais e o recorte são preservados.
- Reencodificadas as variantes AVIF da floresta e da imagem de descoberta, com qualidade 55 e crominância 4:2:0, após comparação no navegador. A variante selecionada do fundo nesta medição passa para 1 221 963 bytes, cerca de 58% menos. Os fundos da pausa editorial e dos contactos não foram reencodificados.
- Antecipada no HTML a descoberta do fundo AVIF com preloads que têm os mesmos `media`, `imagesrcset` e `imagesizes` das fontes do `picture`. O navegador seleciona uma única variante.
- Unificada a indicação `sizes` da fotografia em destaque e do seu preload com a grelha efetiva. A fotografia não ocupa 55vw no desktop; a nova indicação considera as colunas, o espaçamento e o limite de largura. Nesta medição passa de 1600 para 1280 px sem reduzir a densidade necessária para o tamanho apresentado.
- Agrupadas as leituras de geometria do header antes das escritas de estilos e coordenadas com o agendador de frames existente. A inicialização continua antes da pintura seguinte e preserva os pivôs das fotografias e legendas.

O gerador reproduzível é `scripts/optimize-home-v5-images.mjs`. Os ficheiros derivados necessários fazem parte do código; relatórios brutos, traces, capturas e cópias de comparação não fazem parte do produto.

## Verificações

- Build Node aprovado, Svelte com zero erros e zero avisos, lint dos ficheiros alterados aprovado.
- 41 testes relevantes aprovados: URLs e resoluções, agendamento de frames, dimensionamento de imagens e retenção local de fotografias da galeria e cabeçalhos de indexação.
- Comparação de capturas em desktop e telemóvel, nos temas claro e escuro: mesma geometria de secções, posição e ajuste das imagens, filtros e definições das animações. A codificação das imagens muda os pixels; não se trata de igualdade binária. As capturas foram inspecionadas quanto à qualidade percebida. As secções de pausa e contacto mantêm igualdade de pixels, salvo arredondamento de captura inferior a um nível de canal.
- Verificação nos breakpoints 390, 700, 701, 1050, 1051, 1653 e 1920 px: mesmo canvas e pivôs, sem overflow, um pedido para o fundo e um para a fotografia inicial em destaque.
- Regressão da galeria: voltar a uma fotografia já descodificada não faz novo pedido HTTP. O foco por teclado no botão de partilha continua funcional.

## Avisos que permanecem

**Contraste:** não foram alteradas cores. O relatório identifica o índice selecionado dos motivos de visita (`.chosen .reason-index`, vermelho sobre fundo escuro, razão 4,0:1), o pequeno título no topo do convite (4,22:1), e os textos da divisória e disponibilidade no bilhete (3,04:1). São falhas reais para texto pequeno, cujo mínimo indicado pelo relatório é 4,5:1. Corrigi-las exige uma alteração visual específica a aprovar pelo proprietário; não foram ocultados textos ou retirados da auditoria.

**Indexação:** preservados `SITE_NOINDEX`, os cabeçalhos e as regras de robots existentes. A decisão de desbloquear o ambiente público depende dos dados oficiais e da revisão de publicação; não é resolvida por obter uma pontuação local maior.

**Cache de navegação:** o relatório público indica `NetworkExceedsBufferLimit`, classificado pelo Lighthouse como não acionável. O serviço local indica políticas `no-store`. A redução de bytes não comprova uma correção de bfcache em produção; não se alteraram políticas de cache ou a validação de acesso às fotografias para fazer passar a auditoria.

**CSS, JavaScript e layout:** permanecem os diagnósticos de CSS/JS não utilizados na primeira vista e medições de layout no arranque. Não se encurtaram animações, não se removeram estados ou conteúdo e não se alterou a restauração de scroll para suprimir avisos. A divisão estrutural de componentes por rota e medições adicionais do arranque são trabalho distinto ainda por validar. As estimativas de poupança do Lighthouse, incluindo as restantes imagens, não são uma garantia de ganho sem avaliar a qualidade e o funcionamento.

Nenhum dado legal, contacto demonstrativo, consentimento ou item de preparação para publicação foi confirmado por esta otimização. Não foi executado deploy manual.


## Segunda ronda — 25 de outubro de 2026

O novo relatório público, recolhido às 01:00:37 UTC, já identifica o asset de 2880 px da alteração anterior: performance 92, acessibilidade 97, boas práticas 100 e SEO 69, LCP 1874 ms e 3 704 745 bytes. Esta referência pública não deve ser comparada causalmente com a pontuação local.

### Mudanças finais

- Catálogo, favoritos, comparação, Quem somos e páginas legais passam a fornecer o conteúdo a partir da sua própria rota, através de snippets. Os mesmos componentes continuam renderizados no servidor; não foram substituídos por placeholders nem adiados até à hidratação.
- A ficha fornece o seu runtime de galeria, descrições, metadados e componentes de detalhe. A homepage deixa de importar essas dependências. As funções de cache e os componentes de partilha mantêm o seu código.
- O preloading de código muda de eager para hover, evitando carregar imediatamente as outras rotas. A navegação por ponteiro/touch continua a antecipar código; o preloading de dados mantém-se off. Este comportamento segue as [opções de links do SvelteKit](https://svelte.dev/docs/kit/link-options#data-sveltekit-preload-code).
- Acrescentadas variantes lossless de 240 px dos logótipos e corrigido sizes para o tamanho apresentado, incluindo o zoom existente. O desenho, alpha e cores são preservados; o gerador verifica os pixels na resolução derivada.
- A imagem de descoberta, apresentada atrás do desfoque existente de 1,6 px, usa AVIF45: a variante de 810 px passa de 272 255 para 211 802 bytes. A comparação nos dois temas e tamanhos apresentou diferenças médias inferiores a 0,4 níveis de canal, com máximo 4/255, sem mudança visual percebida. Fontes, recortes e dimensões são os mesmos. O fundo nítido do header e as fotografias das viaturas conservam qualidade e bytes.
- O script de arranque e os ficheiros de keyframes, indicador, cantos e superfícies de contacto ficaram exatamente como no HEAD anterior.

### Medição comparável desta ronda

Mesmo Lighthouse 13.4.1, origem local 3080, viewport 1653 × 1296, DPR 1,5 e perfil de simulação da ronda anterior. Três referências antes e duas execuções da versão definitiva, cada uma com navegador novo. A segunda execução definitiva encerrou a amostra; não se escolheu o melhor resultado isolado.

| Mediana local | Antes | Depois definitivo |
| --- | ---: | ---: |
| Performance | 84 (84–90) | 85 (84–86) |
| LCP simulado | 2636 ms | 2601 ms |
| Speed Index | 1311 ms | 1165 ms |
| Total Blocking Time | 0 ms | 0 ms |
| CLS | 0 | 0 |
| Transferência total | 3 875 449 bytes | 3 734 172 bytes |
| JavaScript transferido | 182141 bytes | 130685 bytes |
| CSS transferido | 47648 bytes | 38242 bytes |

O ganho estável é a redução de cerca de 28% no JavaScript e 20% no CSS, seis pedidos de script a menos e menos 141 KB de transferência total. O diagnóstico de JavaScript não utilizado passa; o de CSS passa de 27 para 17 KiB estimados. A pequena diferença na pontuação/LCP está dentro da variação observada e não comprova uma melhoria significativa nesses dois valores. Não se promete uma pontuação pública superior a 92 ou 100.

### Validação e limites

- 509 testes do website aprovados; build Node aprovado; Svelte com zero erros e zero avisos. Ficheiros novos e rotas alteradas sem erros de lint. DesignEdition conserva exatamente os mesmos 24 diagnósticos de lint do HEAD, sem novos diagnósticos.
- 32 combinações de oito rotas, dois tamanhos e dois temas: geometria, fontes, cores, títulos, descrições, headings e links iguais. Comparação visual e de pixels efetuada; diferenças nos fundos lazy de contactos foram isoladas e desapareceram depois da entrada real no viewport e descodificação, com igualdade de pixels nos quatro casos revistos.
- Quatro casos de fullscreen mantêm geometria, miniaturas prontas em conjunto, estados e imagens não arrastáveis.
- Teste reproduzível: com o build local e backend ativos, executar node scripts/check-public-route-loading.mjs (PLAYWRIGHT_CHANNEL=chrome por omissão). Verifica ausência de preloads de rotas alheias no arranque, preload de código por intenção sem pedido de dados, navegação real, retorno a fotos sem HTTP, miniaturas agrupadas, foco e feedback inline de partilha com botão estável. A fixture precisa de um destaque publicado com pelo menos três fotografias.
- Maior esforço AVIF à mesma qualidade não deu ganho útil; não foi aplicado. Não foram reprocessadas fotografias armazenadas remotamente, alteradas permissões de acesso ou enfraquecida a validação de fotografias.
- Permanecem os avisos de contraste e o noindex público, sem alterar cores ou decisões de publicação. Permanecem CSS de estados não presentes na primeira vista e leituras de geometria no arranque. Não se apagaram estados, conteúdo ou animações apenas para suprimir os diagnósticos.

As pendências oficiais de publicação mantêm-se. Esta ronda não executa deploy manual; push e disponibilidade no site público são verificações distintas.


### Entradas de imagem ainda assinaladas no relatório público

A auditoria distingue compressão de resolução e normaliza dimensões para a região visível, object-fit e densidade. As dimensões visíveis do fundo são 1653 × 917 CSS px; o ficheiro real de 2880 px tem 2880 × 1920 px. Não interpretar as dimensões recortadas do diagnóstico como a dimensão do ficheiro original.

| Recurso no relatório | Pedido / bytes | Tratamento nesta ronda |
| --- | --- | --- |
| Fundo do header | 1221963 bytes | 2880 px mantidos; já reduzido de 3840 na primeira ronda; zoom/DPR preservados |
| Painel de descoberta | 272255 bytes | 810 px mantidos; 272 255 → 211 802 bytes, comparado visualmente |
| dacia-jogger-extreme-2023-cf06e4d3ad62 | 1280 px / 279966 bytes | Mantido; o aviso aponta resolução e compressão |
| audi-q5-50-tfsi-e-quattro-2022-37767adcfa24 | 1280 px / 229164 bytes | Mantido; o aviso aponta resolução e compressão |
| audi-a6-avant-2023-eb5212472e45 | 1280 px / 193538 bytes | Mantido; o aviso aponta compressão |
| audi-q5-50-tfsi-e-quattro-2023-aba3596caa8c | 800 px / 163596 bytes | Mantido; o aviso aponta compressão |
| audi-q3-35-tdi-quattro-2021-525fd2168c63 | 800 px / 155148 bytes | Mantido; o aviso aponta resolução e compressão |
| audi-a3-sportback-30-tfsi-2022-527ff7026c07 | 1280 px / 160762 bytes | Mantido; o aviso aponta resolução e compressão |
| audi-q5-50-tfsi-e-quattro-2022-37767adcfa24 | 800 px / 96708 bytes | Mantido; o aviso aponta compressão |
| Interior | 298161 bytes | Mantido; o aviso aponta compressão |
| audi-a6-avant-2023-eb5212472e45 | 800 px / 90582 bytes | Mantido; o aviso aponta compressão |
| audi-a3-sportback-30-tfsi-2022-527ff7026c07 | 800 px / 69506 bytes | Mantido; o aviso aponta compressão |
| Logótipo claro | 26312 bytes | sizes corrigido, variante lossless 240 px: 14 324 bytes |
| Logótipo escuro | 20334 bytes | sizes corrigido, variante lossless 240 px: 11 920 bytes |

No serviço de fotografias, a lista de variantes é 320, 384, 800, 1280, 1600 e 2560. O manifesto escolhe a primeira variante publicada maior ou igual ao pedido. Por isso, acrescentar apenas 960 ao frontend não faria as fotografias existentes ficarem menores: o serviço ainda poderia entregar 1280. Variantes intermédias publicadas exigem geração e revisão próprias. Transformar no pedido também acrescentaria download e descodificação no caminho crítico; não foi introduzido sem uma medição completa de qualidade e latência.

Nas três fotografias com pedidos 800 e 1280, o segundo pedido ajusta a resolução ao recorte vertical depois de conhecidas as dimensões reais. Não foi retirado à custa de subamostragem. A meta de 1743 KiB do relatório público não foi eliminada: a redução real de imagens na comparação local é cerca de 81 KB; a maior redução restante desta ronda está no código/CSS.
