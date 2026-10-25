# Desktop: imagens e integração mobile — 25/10/2026

Base: `25f40c4`. Medições realizadas localmente antes do commit e push; não representam uma implantação em produção. O snapshot mobile
das rondas 2 e 3 foi integrado sem substituir as alterações desktop. O relatório
mobile separado conserva as suas medições e limites.

## Alterações desktop

- O `sizes` inicial dos cartões públicos usa as dimensões persistidas da fotografia
  e a geometria de cada grelha: homepage, catálogo e favoritos. Inclui o recorte
  `cover`, a altura `largura / 1.4 + 60px`, colunas, filtros laterais e limites de
  largura. O browser continua a aplicar DPR; os ramos mobile anteriores e o fallback
  sem dimensões permanecem. O observador continua a acompanhar mudanças da caixa.
- Os cartões da seleção na homepage usam prioridade baixa; a fotografia de destaque
  e o fundo continuam prioritários. Catálogo e favoritos conservam prioridade automática.
  A medição não isola um ganho atribuível apenas a esta indicação.
- Foram acrescentados quatro tamanhos do fundo wide, diretamente da fonte aprovada,
  com a mesma codificação: AVIF 55, 4:2:0, esforço 5; WebP 88, esforço 6, smartSubsample.
  Os originais, variantes anteriores, recorte, foco, filtros, cores, CSS e zoom 1,055
  foram conservados. O gerador e o módulo gerado incluem os novos tamanhos.

| Perfil CSS / DPR 1,5 | Variante anterior → nova | AVIF anterior → novo | Redução |
| --- | --- | ---: | ---: |
| 1440×1000 | 2560 → 2304 | 987026 → 813173 B | 173853 B / 17,6% |
| 1653×1296 | 2880 → 2688 | 1221963 → 1076411 B | 145552 B / 11,9% |
| 1920×1080 | 3840 → 3072 | 2079138 → 1374908 B | 704230 B / 33,9% |
| 2560×1440 | 5472 → 4096 | 4878148 → 2346039 B | 2532109 B / 51,9% |

Os seis pares visuais incluem os quatro perfis, claro/escuro e a fase de zoom máximo.
Confirmaram a mesma geometria e um pedido do fundo por caso. A resolução selecionada
cobre os pixels físicos necessários, incluindo o zoom: no perfil 1653, cerca de 2600 px
exigidos contra 2688 fornecidos. A inspeção lado a lado não mostrou perda percetível;
as imagens reamostradas não são pixel idênticas. Os contadores animados podem mostrar
números diferentes em screenshots tirados em instantes diferentes; não foram alterados.

## Pedidos e LCP

A primeira comparação local, a 1597×1000 / DPR 1,5, passou de 9 para 6 pedidos de fotografias
de capa e poupou 258596 bytes transferidos nesses pedidos. No catálogo de 1440 px, passou
de 12 para 9 pedidos e poupou 258749 bytes. As variantes finais nesses dois perfis foram as mesmas da referência.
Em larguras maiores, a nova estimativa evita também conservar variantes excessivas
pedidas inicialmente. O teste de browser cobre 11 casos nas três rotas, incluindo
os breakpoints 1199/1200, e verifica uma resolução pedida por capa.

Lighthouse 13.4.1, Chrome headless, viewport 1653×1296 / DPR 1,5, RTT 40 ms,
10240 Kbit/s, CPU 1×; mesmo snapshot público, sem builds/encoders concorrentes.
Dois ensaios por configuração; Brotli de qualidade 4 nos dois proxies HTTP/1.1 locais.

| Medida | Base | Desktop + mobile ronda 2 |
| --- | ---: | ---: |
| Pontuação simulada | 86 / 86 | 84 / 85 |
| LCP simulado | 2674 / 2659 ms | 2824 / 2774 ms |
| Transferência | 3593788 B | 3191587 B |
| TBT / CLS | 0 / 0 | 0 / 0 |

A redução de 402201 bytes não melhorou este LCP simulado. A variante só com desktop
deu 2781/2768 ms, portanto a diferença não pode ser atribuída apenas ao startup inline.
O início de todos os recursos do head variou cerca de 50 ms apesar de TTFB semelhante;
o proxy local e o modelo não reproduzem Cloudflare/HTTP/2 da produção.

Uma comparação adicional mediu LCP **observado**, aplicando 10 Mbit/s e 40 ms realmente
ao browser, com CPU 1×, Brotli e os mesmos dados. Servidores previamente inicializados,
navegadores novos, execução alternada:

| LCP observado | Base | Desktop com prioridades |
| --- | ---: | ---: |
| Execução 1 | 2952 ms | 2612 ms |
| Execução 2 | 2912 ms | 2604 ms |
| Mediana | 2932 ms | 2608 ms |

Redução observada de 324 ms / 11,1%. Uma série anterior, sem indicação explícita de prioridade,
deu 2832/2836 → 2564/2480 ms. Não se atribui isoladamente o ganho à prioridade dos cartões.
Um ensaio com o novo servidor ainda frio foi separado e excluído: o seu primeiro SSR
atrasou o início do fundo para 706 ms, em vez de cerca de 70–80 ms. Os resultados são locais,
não uma previsão de pontuação pública. O snapshot mobile da ronda 3 foi integrado depois
destas séries; as suas medições próprias estão em `mobile-performance-round3.md`.

Depois da integração final, a mesma comparação observada foi repetida contra a base,
sem outros browsers, builds ou encoders próprios concorrentes. O harness configura
1310720 B/s (10240×1024/8) e 40 ms; o rótulo de 10 Mbit/s acima é aproximado.

| LCP observado final | Base | Desktop + mobile rondas 2 e 3 |
| --- | ---: | ---: |
| Execução 1 | 2764 ms | 2432 ms |
| Execução 2 | 2804 ms | 2400 ms |
| Mediana | 2784 ms | 2416 ms |

Redução de **368 ms / 13,2%** neste perfil local. Esta medição final observada não é
uma pontuação Lighthouse simulada nem uma confirmação de desempenho em produção.

## Outros avisos e validação

Os 17512 bytes de CSS assinalados não são 17512 bytes comprovadamente mortos. O ficheiro
partilhado contém estilos de detalhe, outras rotas, mobile, hover e estados ausentes
na auditoria. Exemplos: `.vehicle-description`, `.photo-step`, `.vehicle-layout`,
`.orbit-company` e media queries. Não se apagaram esses estilos. Separar o CSS scoped
por rota exige preservar especificidade e cascata; o relatório estima apenas 40–50 ms.

Os 103,7 ms de forced layout são atribuídos à primeira leitura do hero em
`orbit-startup.js`, que força o cálculo inicial do documento. Não são 103,7 ms
demonstradamente removíveis por agrupar leituras. As classes da navbar e `motion-on`
mudam geometria antes das leituras seguintes. A integração mobile contém o agrupamento
validado e evita a leitura da navbar quando scroll < 100; não altera fórmulas ou keyframes.

Um ensaio AVIF 52 de 2880 px ocupou 1140099 bytes, contra 1221963 na versão 55. Ficou apenas
nos artifacts: a redução de resolução adequada já oferece mais poupança neste perfil,
sem baixar a qualidade de codificação. Não se aplicou nova compressão às fotografias
das viaturas ou aos logótipos.

Validação da integração: 527 testes passaram; Svelte check com 0 erros e 0 avisos;
build concluído. Os quatro smokes de runtime (mobile/desktop, claro/escuro) passaram,
incluindo scroll restaurado, startup inline, libertação das fotos e `noindex`.
Os oito assets wide novos passaram GET/HEAD/304, comparação de bytes e cache immutable.
Os onze casos de cartões passaram na build combinada. A navegação por intenção,
hover sem pedidos de dados, retorno à galeria sem revalidação, miniaturas agrupadas
e feedback de partilha com dimensões estáveis também passaram.

Evidência local não versionada em `artifacts/desktop-delivery/`:
relatórios Lighthouse, séries observadas, capturas e comparações, logs e builds congeladas.
O script reproduzível dos cartões é `scripts/check-public-card-images.mjs`.

As melhorias técnicas não resolvem os dados legais/oficiais pendentes e não constituem
aprovação de publicação. Readiness, placeholders e regras de indexação não foram alterados.
