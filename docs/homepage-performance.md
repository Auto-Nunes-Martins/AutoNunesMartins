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
