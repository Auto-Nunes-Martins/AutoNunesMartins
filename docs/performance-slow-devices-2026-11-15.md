# Seguimento: equipamentos mais lentos e galeria horizontal

Pedido: melhorar a fluidez sem simplificar o desenho aprovado e aproveitar melhor o ecrã ao rodar um telemóvel na galeria fullscreen. Este seguimento altera apenas o website público; as otimizações anteriores do CRM permanecem intactas.

## Alterações

- As cenas públicas declaram apenas os canais de scroll consumidos pelo seu CSS. Retirado o processamento duplicado da mensagem editorial e da zona principal da ficha; preparação, convite, história e fotografia de Quem Somos conservam os seus movimentos. Os protótipos com coreografia completa mantêm o comportamento anterior.
- Referências aos alvos das cenas são obtidas ao atualizar a árvore, em vez de pesquisar os mesmos elementos em cada frame. Deixa de haver interpolação contínua para propriedades que não afetam o desenho.
- Menus de seleção abertos agrupam scroll/resize no coordenador de frames existente, com leituras antes das escritas. A abertura continua imediata; fechar o menu cancela trabalho pendente.
- A galeria agrupa os eventos de resize da janela e do viewport. As fotos inline só são novamente adquiridas/descodificadas se a resolução necessária aumentar. A foto ativa em fullscreen continua a melhorar de resolução quando necessário, preservando a política de reutilização, autorização e substituição depois do decode.
- Num telemóvel horizontal, nome, contador e botão de fechar passam para a faixa lateral existente das miniaturas. A fotografia dispõe de toda a altura segura, sem corte, distorção nem controlos sobrepostos. Desktop e portrait mantêm o layout.

Não se alteraram fontes, fotografias, compressão, brilhos, máscaras, intensidade das cores, timing das animações, consentimento ou funcionalidades comerciais.

## Comparação local

Chrome, compilação de produção, origem local, catálogo e fotografias fictícios. CPU 6× em 390×844 DPR2 e 4× em 1440×900 DPR1; rede simulada de 1,6 Mbps, latência 120 ms. Terceiros bloqueados e fotografias servidas pela fixture. Não equivale a um telefone físico, PageSpeed, CrUX ou INP real. Scroll programado com 81 posições; os valores abaixo são tempo acumulado de recálculo de estilos nesse percurso.

| Página           | Mobile antes → depois | Desktop antes → depois |
| ---------------- | --------------------: | ---------------------: |
| Homepage         |        1818 → 1630 ms |         1604 → 1350 ms |
| Catálogo         |          267 → 285 ms |           263 → 140 ms |
| Quem Somos       |         1058 → 698 ms |          1080 → 583 ms |
| Ficha da viatura |         1378 → 332 ms |          1156 → 213 ms |

São amostras locais, com variabilidade. O catálogo mobile não melhorou nesta medição; não se atribui um ganho universal. A remoção do processamento sem consumidores explica a melhoria mais acentuada na ficha. O percentil 95 dos intervalos entre frames na ficha mobile passou de 31,3 para 12,5 ms neste percurso; na homepage ficou aproximadamente igual, em 37,5 ms.

CLS inicial: 0 nas páginas medidas, exceto homepage mobile com 0,000078 antes e depois. Nos eventos amostrados da comparação, menu mobile até 96 ms, filtros mobile até 184 ms; a abertura da galeria ainda atingiu 312 ms sob CPU 6× (320 ms antes). Não se apresenta este último resultado como interação instantânea nem como medição de INP. O trabalho remanescente não foi escondido retirando efeitos.

Resultados completos: [antes](measurements/slow-devices-2026-11-15/before.json) e [depois](measurements/slow-devices-2026-11-15/after.json). Tentativas preliminares com fixtures incompletas de fotografias foram excluídas.

## Galeria

Na fotografia 3:2 de teste:

| Viewport horizontal | Largura visível antes → depois | Altura visível antes → depois |
| ------------------- | -----------------------------: | ----------------------------: |
| 844×390             |               524,6 → 560,8 px |                349,8 → 374 px |
| 667×375             |               502,1 → 538,3 px |                334,8 → 359 px |
| 740×320             |               419,6 → 455,9 px |                279,8 → 304 px |

Em portrait 390×844, a foto mantém 374×249,4 px. O ganho depende da proporção: uma fotografia já limitada pela largura não aumenta ao disponibilizar mais altura. O teste adicional usa imagens 16:9, 3:4 e 3:2, conserva o índice ao rodar, valida seleção por miniaturas, navegação por teclado, contacto, fechar e foco. Os alvos de fechar mantêm pelo menos 44×44 px.

## Verificação e reprodução

- 925 testes unitários aprovados, build concluído e Svelte/TypeScript sem erros nem avisos.
- Oito perfis de rotação Chrome e oito WebKit: 390×844, 375×667, 320×740 e 430×932, com e sem movimento reduzido. WebKit incluiu um nome longo para validar a faixa lateral; ambos concluíram normalmente. Não são testes em aparelhos físicos.
- Sublinhados, swipe, hover e movimento reduzido aprovados em 390, 700, 701 e 1440 px na compilação de produção.
- A comparação visual de canais antigos/otimizados é feita no mesmo documento. Em cargas frias separadas, a política existente de fontes opcionais pode escolher fallbacks diferentes sob rede lenta; isso não é uma alteração de tipografia desta implementação.
- Passaram 14 comparações de estados estabilizados: 12 com píxeis idênticos e duas do convite com diferenças residuais máximas de 0,027% dos píxeis, dentro da tolerância de 0,1%. [Resultados por secção](measurements/slow-devices-2026-11-15/visual-channels.json). Menu, ordenação por rato/teclado, favoritos e carrossel também foram exercitados sob CPU limitado.

Executar a partir de `apps/website`, depois do build:

```powershell
node test/heroLayout.browser.mjs --slow-devices
node test/heroLayout.browser.mjs --gallery-rotation
```

`SLOW_DEVICE_OUTPUT` e `GALLERY_ROTATION_OUTPUT` escolhem diretórios novos. `SLOW_DEVICE_COMPARE_MOTION=1` compara os canais no mesmo documento, `SLOW_DEVICE_EXTRA_INTERACTIONS=1` verifica também favoritos/carrossel. `SLOW_DEVICE_ROUTES` e `SLOW_DEVICE_WIDTHS` permitem repetir apenas os casos relevantes. Capturas ficam em `.cache`, sem limpeza automática.

Não há nova promessa de pontuação de produção. Requerem medição posterior os dados reais de rede/servidor, terceiros e dispositivos físicos.
