# Home: alternativas de fotografia e movimento

## Escolha pública — 22 de outubro de 2026

Por pedido do proprietário, a versão **5 — Estrada na floresta** é a inicial,
tanto no desenvolvimento sem parâmetro como no build de produção. O seletor
público permite alternar entre **2 e 5**, para comparação. Em desenvolvimento
continuam disponíveis as sete alternativas e o parâmetro `hero`. Em produção,
esse parâmetro não substitui a escolha inicial. A opção selecionada dura enquanto
o componente está montado; não acrescenta cookies nem armazenamento persistente.

Esta escolha visual não resolve as pendências de dados e revisão de publicação.

As opções **1 e 3–7** partilham o desenho atual da V1: altura reduzida,
tipografia de base, texto, CTAs, tratamento cromático e destaque com a fotografia real,
dados e ligação da mesma viatura. As opções 3–7 substituem as antigas direções
de layout por fotografias diferentes e direções próprias de entrada do conteúdo.
A V1 conserva a composição aprovada; o seu zoom out lento de 4,8s, com
desaceleração final prolongada, é agora comum às fotografias 1 e 3–7.
A V2 conserva o layout e as entradas; apenas o hover do cartão e a
intensidade do fundo foram adaptados por decisão posterior do utilizador.

| Opção | Cenário                      | Entrada                                   | Scroll do cenário                       | Hover do conjunto                       |
| ----- | ---------------------------- | ----------------------------------------- | --------------------------------------- | --------------------------------------- |
| 1 | Estrada verde longa aprovada | Conteúdo coordenado; cenário com zoom out de 4,8s | Fundo ancorado desde o primeiro scroll | V6 comum |
| 2 | Original preservado | Original | Camadas gráficas com deslocação reforçada | V6 comum |
| 3 | Pinhal em curvas | Zoom out de 4,8s; destaque sobe suavemente | Fundo ancorado desde o primeiro scroll | V6 comum |
| 4 | Serra verde | Zoom out de 4,8s; título por revelação e destaque lateral | Fundo ancorado desde o primeiro scroll | V6 comum |
| 5 | Estrada na floresta | Zoom out de 4,8s; título lateral e destaque por opacidade; levitação após entrada | Fundo ancorado desde o primeiro scroll | V6 na fotografia; UI 2D |
| 6 | Curvas no bosque | Zoom out de 4,8s; revelação vertical do conjunto | Fundo ancorado desde o primeiro scroll | V6 comum |
| 7 | Caminho entre árvores | Zoom out de 4,8s; título e destaque chegam da esquerda | Fundo ancorado desde o primeiro scroll | V6 comum |

O utilizador escolheu apenas o **hover V6**, agora comum a 1–7:
perspetiva 1400px, translateY −2px, translateZ 6px, rotateX 2° e rotateY −8°;
transição de 500ms, cubic-bezier(.2,.65,.3,1), com retorno. A V2 mantém o
transform de scroll/ponteiro fora da interação; só durante hover/foco e os 500ms
do retorno recebe a transição. A implementação comum está em `featuredHover.css`
e o ciclo de retorno isolado da V2 em `featuredHover.ts`. Na V5, esta matriz
é aplicada apenas à fotografia para manter textos e controlos nítidos em Full HD.
As restantes entradas continuam disponíveis para comparação no desenvolvimento.

Nas opções 1 e 3–7, o cenário mantém a posição no viewport desde scrollY=0,
enquanto a navegação e o conteúdo sobem, e a secção seguinte cobre-o. O clip do
hero impede que a fotografia apareça pelo resto da página. A geometria é medida
apenas na montagem e em redimensionamentos; não existe listener de scroll,
timeline de scroll ou interpolação que acumule estado. Esta ancoragem comum
substitui as antigas intensidades fracionárias e o movimento diagonal da V7,
privilegiando a estabilidade nas inversões. Mantêm-se as fotografias, focos e
enquadramentos iniciais de cada opção, sem espera até a navegação desaparecer.

As entradas repetem na montagem/refresh. Em 1 e 3–7, os componentes entram de
forma sobreposta com a curva cubic-bezier(.18,.6,.22,1), terminando por volta de
2,1s; conservam as direções próprias de cada opção. O cenário reduz de 1,055 para
1 e assenta por último aos 4,8s, com a mesma curva aprovada na V1. Não se aplica
blur às fotografias dos headers nem suavização residual ao scroll. Sem JavaScript
ou suporte de clip, o cenário usa a posição absoluta estática. Touch não recebe
tilt de hover. Movimento reduzido desliga entrada, ancoragem e hover. O conteúdo
permanece visível sem JavaScript.

A correção das inversões rápidas foi validada separadamente da nova entrada.
Antes, capturas reais do compositor mostravam a base verde apesar de a fotografia
estar carregada e os limites DOM estarem corretos. A camada grande deslocada por
transform/timeline falhava ao regressar ao topo. A implementação final fixa a
camada no viewport e deixa apenas o recorte do hero mover-se, eliminando esse
caminho de atualização; não se atribui a falha a um algoritmo interno específico
do browser. O fallback passa a escuro. Nos testes, a base foi forçada novamente a
verde para confirmar que a ausência do flash não resulta apenas dessa cor nova.

Apenas na V5 a fotografia levita após terminar a entrada, carregar e
o cartão ficar totalmente visível. Uma camada própria percorre uma fase angular
contínua de **12s**, afinada de 19s para um ritmo mais vivo; seno/cosseno e uma segunda harmónica desfasam os eixos, sem
ease-in-out a parar em cada ponto. A elevação chega a cerca de 12px, a profundidade
a 8px e o tilt lateral a 1,4°, com deriva horizontal pequena. A posição e a
velocidade são contínuas na passagem 360°→0°. Hover/foco pausam a fase atual e
mantêm o hover V6 na camada exterior da fotografia. Os textos, nota, ícones e
controlos ficam num plano 2D independente.
Sair da interação retoma a fase; fora do ecrã ou com a página oculta também pausa.
Touch e movimento reduzido mantêm o cartão estável.

A V5 conserva a base suave de luz ambiente atrás da fotografia. O holofote forte
surge no hover/foco de teclado, com seis feixes SVG ocluídos pela fotografia
opaca. Os ângulos e a textura do leque aprovado foram preservados. O tom passou
para branco quente, com um pequeno reforço de calor no último ajuste. Não
regressa ao amarelo inicial; as opacidades mantêm-se.
O último pedido limita apenas a distância dos raios: contração de 9% em torno
da fonte, compensando as posições dos stops para manter o centro luminoso.
O filtro fica fora dessa contração e conserva a suavidade física anterior.

O holofote vive agora em `hd-feature-light`, uma camada própria do hero,
atrás do conteúdo, sem capturar ponteiro. Uma máscara suave dissipa apenas essa
luz nos limites reais do hero: 48px nas bordas, com 20px laterais em mobile.
Não existe uma máscara vertical interna a encurtar o lado direito do cartão.
As extremidades dos triângulos SVG foram prolongadas para além do ponto onde o
gradiente radial já é transparente, evitando denunciar os limites do SVG/filtro.
A geometria da fotografia é medida na montagem e em redimensionamentos, sem
listener de scroll. A máscara não afeta fotografias, texto, preço ou navbar.
A opacidade continua a entrar em 480ms e a expansão 0,88→1 em 850ms. Touch não
ativa hover persistente; com movimento reduzido a luz muda de estado sem
transição. As outras variantes não recebem esta camada.

O bloqueio após clicar em seguinte/anterior vinha de `:focus-within`: o botão
mantinha foco do rato, prolongando a inclinação e a pausa, mesmo sem hover.
As regras comuns e a V5 distinguem agora `:focus-visible` de foco de clique.
Não se remove foco nem se faz blur do botão. O rato liberta o cartão e a fase
atual da levitação continua; teclado mantém a interação estável até sair do
cartão. A correção comum de hover mantém a matriz V6 e os 500ms de retorno.

O reflexo recortado às letras de “Em destaque” permanece sem alterações.
O preço fica totalmente neutro: sem reflexo, glow, sombra luminosa ou sublinhado.
Mantém peso 600 e o tamanho base aprovado (até 42px no desktop, 34px em mobile,
30px até 360px). O valor completo, moeda e separadores crescem juntos, com uma
única leitura acessível e uma reserva invisível de espaço para evitar deslocar
nome, controlos ou CTA.

O gesto do preço tem um temporizador próprio, independente do carrossel:
um impulso de 650ms aproximadamente a cada 5s, até 1,06 do tamanho base.
Hover/foco de teclado mantêm um aumento estável de 1,045; sair devolve o tamanho
base em 260ms e retoma uma espera completa de 5s. Uma interação interrompe o
impulso em curso a partir do tamanho atual, sem multiplicar aumentos. Fora de
vista, com a página oculta ou movimento reduzido, o gesto/timer é cancelado.
O componente não é recriado por viatura: trocar foto/valor não dá pop, não
reinicia o relógio e não anima a entrada do preço. Autoplay mantém o seu relógio
separado de 8s. O crescimento usa font-size real, com espaço reservado, em vez
de ampliar uma textura de texto por transform.

A revisão de nitidez em 1920×1080/DPR1 confirmou dois transforms 3D na cadeia dos
textos do cartão anterior; não existia filtro de blur nesses ancestrais. A V5
passou a reservar perspetiva/levitação à fotografia. A entrada do cartão mantém
os tempos aprovados e remove o estado de animação concluído depois de assentar.
Textos, notas/ícones e controlos ficam sem transform/filter ancestral. Não foram
adicionados truques de contraste ou sombras para disfarçar a desfocagem.

As opções 1 e 3–7 passam automaticamente ao próximo destaque após **8 segundos**
de apresentação, depois de terminar a entrada completa e carregar a fotografia.
Hover de ponteiro fino e foco de teclado pausam; foco deixado por clique não
bloqueia a retoma. Fora de vista ou com a página oculta o timer é cancelado.
Cada retoma, troca manual ou nova fotografia dá um intervalo completo de 8s,
sem recuperar um prazo antigo. Existe um único timeout com cleanup, e a troca
automática não anuncia repetidamente o status em aria-live. Controlos manuais
continuam a anunciar a seleção. Foto, modelo e preço apontam para a mesma viatura.
A V2 usa outro carrossel e conserva a sua mecânica independente, sem autoplay;
partilha apenas a correção mínima do hover de teclado/rato.

## Site habitual e preview

O endereço de trabalho e revisão é **http://localhost:5173/**, servido por
`C:\Users\Goncalo\Desktop\AI\AutoNunesMartins`. Esta revisão está integrada no
projeto original. Em desenvolvimento, abrir `/?hero=1` até `/?hero=7` ou usar
as sete opções do seletor inferior. Em produção, o seletor apresenta apenas
2 e 5, com a versão 5 inicial renderizada no servidor.

`http://127.0.0.1:5183/` é apenas o preview da worktree em
`C:\Users\Goncalo\.codex\worktrees\5d0f\AutoNunesMartins`, criado para testes
isolados anteriores. Executar esse preview não integra alterações no original.
O código dos cinco ficheiros do hero foi comparado nas duas cópias nesta revisão;
o original/5173 é o destino autorizado e utilizado na validação final.

## Código e isolamento

`HomeHeroDirections.svelte` monta um único layout para 1 e 3–7.
`homeHeroBackgrounds.ts` fornece URLs locais, srcsets e focos responsivos das
novas opções. `homeHeroDirections.css` mantém a base V1 existente; as regras
históricas dos antigos layouts já não são montadas. `homeHeroVariants.css`
seleciona apenas as novas opções por `data-photo-variant`. `homeHeroDirections.ts`
fornece os nomes do seletor.

“Venha conhecer-nos” permanece estática. “O próximo passo começa aqui” conserva
a mecânica de scroll aceite. Os fundos são configurados por versão apenas na
homepage, em `homeVisualFamilies.ts`, sem duplicar secções. As versões 1/2 usam
os ramos anteriores, sem estilos de foco/zoom residuais ao voltar pelo seletor.
Os destaques mantêm foto configurada, slug, preço, ano, quilometragem, combustível,
estado de reserva, navegação de teclado e identificação dos dados de demonstração.

## Fotografias e resolução

As cinco alternativas finais usam fotografias reais e distintas da Pexels.
Os ensaios feitos com a ferramenta integrada ImageGen não foram escolhidos:
as fontes fotográficas permitem conservar mais detalhe nativo. Não foi usada
CLI/API de geração nem foram feitos upscales ou sharpening.

| Opção | Fotógrafo / fonte                                                                                  | Original  |
| ----- | -------------------------------------------------------------------------------------------------- | --------- |
| 3     | [Stan Versluis](https://www.pexels.com/photo/aerial-view-of-winding-road-through-forest-33991308/) | 8064×4536 |
| 4     | [Max Grakov](https://www.pexels.com/photo/aerial-view-of-winding-forest-road-33025694/)            | 5472×3648 |
| 5     | [Pok Rie](https://www.pexels.com/photo/winding-road-in-lush-green-forest-aerial-view-33275771/)    | 5472×3648 |
| 6     | [Jérémy Glineur](https://www.pexels.com/photo/curvy-road-on-mountainside-16845869/)                | 4150×3320 |
| 7     | [viewofilayda](https://www.pexels.com/photo/aerial-view-of-winding-forest-road-34295541/)          | 3000×4000 |

Uso decorativo de acordo com a [licença Pexels](https://www.pexels.com/license/).
Não se afirma que sejam as instalações ou a localização do stand.
WebP qualidade 93 com smartSubsample, apenas redução de dimensão e recortes
mobile próprios. Os srcsets vão até 5760px, limitados pelo original de cada foto.
A opção 7 tem o menor limite horizontal (3000px); em ecrãs muito largos com DPR
elevado pode revelar menos detalhe que as outras. A V1 gerada mantém o limite
conhecido de 1860×846.

Assets ativos, dimensões, pesos, fontes e recortes:
`apps/website/src/lib/assets/images/hero-directions/forest-variants.sources.json`.
Ficheiros finais na mesma pasta com os prefixos `pine-bends`, `green-serpentine`,
`forest-ribbon`, `woodland-curves` e `green-trail`.
Proveniência e prompts da V1 continuam em `road-to-feature.sources.json`.

## Cartão do catálogo e ação de comparação

O cartão existente `DiscoverVehicles.svelte` mantém texto, ligação `/viaturas`
e a sua interação própria. Recebeu um fundo florestal da fotografia de Venti
Views usada como referência pela secção editorial, com sobreposição neutra,
texto claro e seta em círculo claro para continuar evidentemente clicável.
O recorte final é 1,65× mais fechado do que a primeira proposta do cartão,
privilegiando textura verde. Foi recortado diretamente do original de 5471×3076,
sem blur gravado no ficheiro ou ampliação artificial; WebP 640/1280, qualidade 93.
O tratamento de apresentação aplica blur de 1,2px apenas à fotografia; texto e
seta permanecem nítidos. O filete verde à direita vinha de `max-width:100%`
global a limitar a imagem com margem de segurança; `max-width:none` permite
cobrir os quatro lados com os 4px previstos.
Crédito, licença e recorte em `catalog-forest.sources.json`, junto aos assets.
Não foi aplicado a este CTA o hover dos headers.

A revisão de light mode encontrou a mesma falha nas sete opções: a regra geral
de cartões cinzentos em `orbitLightTheme.css` incluía `.discover` e impunha texto
escuro sobre a fotografia. O CTA foi retirado apenas desse grupo e conserva a
sua paleta local clara sobre a foto, sem alterar fontes, recortes, zoom, blur,
exposição V3 ou sobreposição. Por decisão expressa do utilizador, o modo claro
usa a identidade dark anteriormente aprovada: vermelho original, linha/acento e
glow originais, sem adaptação pastel. Apenas o foco de teclado usa um contorno
escuro visível sobre a página clara. A seta mantém o vermelho da marca no círculo
claro; as outras superfícies e os cartões vizinhos não mudam.

## Famílias secundárias novas

Foram gerados **13 cenários decorativos novos**, com a ferramenta integrada
ImageGen, depois de observar as cinco referências reais dos headers. Não são
recortes ou recolorações das fotografias dos headers, nem colagens: cada cenário
tem uma chamada, prompt, ficheiro e composição próprios.

| Versão | Catálogo | O próximo passo | Venha conhecer-nos |
| --- | --- | --- | --- |
| 3 | Copas densas de bosque vistas do alto | Estrada suave à direita entre copas | Curva ampla no limite superior de floresta |
| 4 | Folhagem fresca e calcário | Estrada em vale verde e calcário | Ravina e água entre rochas claras |
| 5 | **Fotografia e tratamento aprovados preservados** | **Fotografia e efeito aprovados preservados** | Ribeiro e granito sob floresta verde-oliva |
| 6 | Trilha e fetos em bosque frio | Curva suave em encosta verde-azulada | Vale e ribeiro de tons frios |
| 7 | Eucaliptos e vegetação sálvia | Caminho de terra em vale natural | Clareira em colinas de eucaliptos |

As duas gerações iniciadas para catálogo/editorial V5 antes da aprovação expressa
foram guardadas sem aplicação. O CTA V5 mantém `forest-ribbon` e o editorial V5
mantém a fotografia complementar Pexels 33275772. São exceções pedidas pelo dono.
Os fundos 1/2, a faixa de estatísticas e as fotografias dos headers não mudaram
por este trabalho de famílias.

Os ficheiros finais `scene-v*-*.webp` ficam em
`apps/website/src/lib/assets/images/hero-directions/`. Os prompts completos,
origens, hashes, dimensões nativas, recortes e pesos estão em
`generated-families.sources.json`. A ferramenta entregou **1086×1448** para os
quatro CTAs e **1672×941** para os nove cenários largos. Foram criados srcsets e
recortes mobile sem upscale, com WebP 95. Estes limites são reais: não são imagens
4K e o detalhe em ecrãs grandes/DPR alto é inferior ao das fontes nativas dos
headers. Não representam instalações ou localização reais do stand.

Os três cenários V3 foram refeitos numa segunda ronda (`scene-v3-r2-*`), usando
a vista aérea, luz uniforme, copas densas e verdes escuros do header preservado.
As outras famílias permanecem congeladas. A remoção/renumeração sugerida foi
cancelada: existem as sete identidades originais 1–7, sem apagar a V3.
Uma afinação posterior reduz a exposição apenas das três fotografias secundárias
V3 para 70%, aproximando sombras e verde profundo do header. Atua na imagem,
sem escurecer textos/painéis nem acrescentar blur; o header e os outros fundos
mantêm as fontes e filtros anteriores. É tratamento de apresentação, não uma
alteração dos ficheiros fotográficos ou novo detalhe artificial.

## Superfícies do mapa e formulário

`homeVisitThemes.ts` limita as cores por versão 3–7 à tonalidade do mapa,
ao fundo do formulário e aos fundos dos campos (incluindo hover/foco). Textos,
placeholders, ícones, botões, bordas neutras e restantes painéis conservam os
valores anteriores. As versões 1/2 usam exatamente os fallbacks anteriores.
Nas V3–V6 a saturação dos tokens foi reduzida em 84% em direção a cinzentos de
luminosidade semelhante, deixando só um subtom; a V7 mantém o tom anterior.
Os formulários V3–V7 usam agora a mesma transparência da referência V1/2:
alpha 201/255 (cerca de 79%) no painel e 9/255 nos campos, com 19/255 em hover
e 22/255 em foco. O blur de fundo de 12px já existente é conservado. Os campos
mantêm um subtom quase neutro e o menu nativo de opções continua opaco para
garantir leitura. Antes deste ajuste os fundos alternativos eram opacos.

O mapa existente é um SVG local, não um serviço de tiles. `VisitMapArtwork.svelte`
usa o mesmo desenho e troca apenas as cores de terreno, ruas, blocos e água;
mantém todos os paths/coordenadas e o marcador vermelho/branco. O original
continua intacto e é usado nas versões 1/2. Não se alteram ligações, dados de
contacto, campos ou envio/validação; placeholders pendentes continuam pendentes.

O botão da toast que aponta para `/comparar` usa box-sizing border-box,
altura mínima de 38px no desktop e 44px com ponteiro de toque. A alteração de
padding/altura é delimitada a esse link em `NotificationHost.svelte`.
Não se alteraram posição da toast, faixa de estatísticas ou layout da comparação.

## Validação focada no original

- `photo-variants-report.json`: 1 e 3–7 em 1440×900 e 390×844/DPR 3. Geometrias,
  texto/foto/link iguais; fundos distintos carregados; entrada/refresh, hover,
  scroll/paragem, movimento reduzido, seleção 1–7, URL direta e V2 independente.
  Sem erros de execução.
- `wide-variants-report.json`: 3–7 em 2560×1440/DPR 2; scroll lento, rápido,
  inverso e paragem, cobertura do cenário e detalhe disponível. Opção 7 final
  também em 390 e 320px. Conteúdo sem JavaScript nas cinco alternativas.
- Typecheck da aplicação: zero erros e zero avisos.

Capturas e relatórios em `.cache/hero-directions/`, ignorados pelo Git.
`headers-final-report.json` verifica hover V6 com matriz/timing iguais nas sete
opções, scroll e touch/movimento reduzido. `v1-choreography-report.json` e
`v1-arrival-final-report.json` registam a entrada coesa e ancoragem inicial.
`card-toast-final-report.json` verifica recorte/blur/cobertura do CTA, teclado,
ligação e altura real do botão comparar (38px desktop, 44px touch).
`v5-hovering-report.json` verifica início após entrada, pausa/retoma sem reinício,
hover V6 e estabilidade touch/movimento reduzido. `v5-continuous-report.json`
regista mais de dois ciclos reais completos (25,5s a 12s/ciclo), amplitude e velocidade
espacial não nula, incluindo as passagens de ciclo. A experiência anterior de
dois ciclos ease-in-out foi substituída por esta trajetória contínua.
`final-families-report.json` regista as três áreas das sete versões em desktop e
mobile, fontes carregadas, cobertura, comparação dos fundos preservados e retorno
3→1→2 sem estilos residuais. Pequenas diferenças de rasterização são registadas;
não se afirma identidade absoluta de todos os pixels.
`first-scroll-extended-report.json` cobre incrementos desde 8px, avanço, inversão,
cobertura e nova entrada após refresh nas V1/3–7, mantendo a visita estática e a
timeline editorial existente.
`themes-seven-report.json` verifica as sete identidades em 1440/390, claro/escuro,
os paths e marcador do mapa, contraste, foco, validação nativa e retorno à paleta
anterior em 1/2. `price-v3-final-report.json` verifica formato/acessibilidade e
dimensões de layout do preço, além da segunda ronda V3 em desktop/mobile.
`v5-polish-final-report.json` regista a animação anterior do preço, entretanto
substituída pela apresentação do valor completo descrita acima. O reflexo da
label conserva a sua implementação.
`form-transparency-report.json` verifica alpha/blur equivalentes à referência,
contraste dos píxeis efetivamente renderizados, foco/hover e menu nativo opaco
nas sete versões, em 1440/390 e claro/escuro. `v3-dark-final-report.json` verifica
a exposição V3, a preservação do header e fontes/filtros iguais nas outras opções,
incluindo a remoção do tratamento ao voltar ao seletor 1.
`catalog-theme-before.json` regista o defeito original em claro e a referência
dark aprovada. `catalog-approved-final-report.json` compara as sete opções em
claro/escuro e 1440/390, incluindo repouso/hover/foco, navegação, preservação
exata de src/filtro/transform/foco da imagem e cobertura sem filete. Confirma
vermelho/glow iguais à referência dark e paletas dos cartões vizinhos estáveis.
Os ensaios intermédios de adaptação pastel foram rejeitados e não fazem parte
do resultado final: a referência é o vermelho e o glow originais aprovados.

`reverse-before-*.json` regista flashes verdes reais na implementação anterior,
em desktop e mobile. `reverse-after-desktop-summary.json` e
`reverse-after-mobile-summary.json` cobrem 1/3–7 em 1440/390px, com milhares de
frames por caso: zero falhas de cobertura e zero flashes verdes. Incluem scroll
antes de terminar a entrada, ciclos rápidos de subida/descida e novos percursos
normais após regressar ao topo; a base verde foi reposta apenas durante o ensaio.
`post-reversal-paint-report.json` compara separadamente os mesmos pontos do
percurso antes/depois de seis ciclos rápidos e scroll com roda nas V1/V5,
em 1440/390px, além da origem da camada e cadência durante descida lenta.
As amostras são comparadas na mesma posição para não confundir as sombras do
conteúdo móvel com alterações da fotografia: nos quatro casos, a diferença de
píxeis e a deriva da origem foram zero, sem agravamento do percentil 95 dos
intervalos entre frames. Esta verificação de fluidez é
distinta da deteção de flashes. A cadência pertence ao Chrome local de teste,
não constitui uma garantia de desempenho para todos os dispositivos.
`v2-reversal-report.json` confirma a recuperação do percurso próprio da V2 após
cinco ciclos rápidos, nos dois tamanhos, sem alterar a sua implementação.

`common-arrival-final-report.json` verifica as seis fotografias em 1440/390px:
zoom out comum de 4,8s, curva e enquadramento final, entrada coordenada do
conteúdo, primeiros 8px de scroll, ausência de reinício da animação após
inversões e recorte sem fuga para outras secções. Inclui movimento reduzido,
com fundo absoluto estático. A V5 foi novamente validada com os testes de
levitação/hover e o ciclo completo dos detalhes do preço após a entrada prolongada.

`ambient-final-report.json` compara a luz V5 ligada/desligada em 1440/390px,
claro/escuro e com/sem movimento reduzido. Verifica presença visual, fotografia
sem alteração de píxeis, ausência de fundos na label/preço e camada sem filtro,
animação ou captura de ponteiro. As outras opções não montam esta camada.
`reverse-after-ambient-summary.json` repete os ciclos rápidos com a luz aplicada
em desktop/mobile; o teste de levitação confirma novamente o hover V6, pausa e
retoma da fase e estabilidade em touch/movimento reduzido.

`spotlight-final-report.json` regista a primeira versão aprovada do holofote,
antes dos retoques de alcance e preço, em 1440/390px,
claro/escuro e movimento normal/reduzido. Guarda repouso, estado intermédio,
hover e foco, além da mesma pose com os feixes desligados. A comparação de
píxeis confirma impacto forte fora da imagem e fotografia intacta, sem mudança
de layout/ligação ou overflow horizontal. Verifica foco equivalente, hover
inativo em touch, transições desligadas com movimento reduzido e ausência da
camada nas restantes opções. `reverse-after-spotlight-summary.json` repete
inversões durante/depois da entrada com os feixes ligados por foco, em desktop
e mobile. O teste de levitação/hover foi repetido com a composição final.
Nessa versão anterior, nos oito casos, o aumento máximo fora da fotografia foi de pelo menos 154/255
num canal, com mais de 27 mil píxeis a variar acima de 15/255. Na amostra interior
da fotografia, a diferença máxima foi apenas um nível de canal, com média abaixo
de 0,014/255: arredondamento de composição, sem lavagem da imagem. Não se afirma
identidade absoluta de todos os píxeis rasterizados.

`carousel-functional-final.json` cobre intervalos de 8s com relógio controlado,
hover, cliques repetidos, saída do rato sem blur, retoma da fase da levitação,
setas/Home/End de teclado, saída de vista, visibilitychange e ligações coerentes.
`autoplay-shared-final.json` verifica as seis opções partilhadas, touch com
movimento reduzido, preservação da V2 e um intervalo adicional com relógio real
(cerca de 8,1s até a seleção seguinte ser observada).
`header-revision-visual-report.json` verifica os três preços em 1440/390/320px,
claro/escuro, estado de maior ampliação e movimento reduzido: sem colisões,
overflow ou interferência no sinal de scroll. Compara a luz ligada/desligada e
regista a queda progressiva até às bordas reais do hero; guarda a área direita
separadamente. Os relatórios distinguem a oclusão da própria fotografia da cauda
exterior dos feixes. As inversões rápidas com a nova camada do hero mantêm
zero flashes verdes e zero falhas de cobertura nos dois tamanhos principais.
O alcance visível à direita cobre cerca de 57 dos 61px disponíveis no desktop;
a cauda exterior desce gradualmente e chega ao limite com diferença de um nível
de canal, sem uma linha interna a cortar o feixe. O núcleo mantém a intensidade
da versão aprovada apesar da contração exterior de 9%. `price-motion-final.json`
regista a animação anterior, entretanto substituída pelo temporizador próprio;
as capturas `header-final-*-hover.png` e `header-final-right-*.png` mostram o
hover de rato sem o contorno de foco de teclado. `reverse-after-final-summary.json`
regista o teste de inversões da composição final.

A revisão final usa `price-timer-final.json`: mudanças repetidas preservam o
mesmo nó e não disparam animação; o impulso surge aos 5s, uma troca automática
aos 8s não dá pop, e o impulso seguinte continua no seu próprio prazo. Verifica
interrupção por hover sem somar tamanhos, saída limpa, teclado, página oculta,
fora de vista, movimento reduzido, cleanup e preço acessível único sem iluminação.
`sharp-before-report.json` e `sharp-after-report.json` acompanham capturas 1:1
em Full HD/DPR1, viewport 1920×947, 1440/1366, escala125% e mobile. Os textos e
controlos mantêm as caixas estáveis entre fases de levitação, enquanto a foto
continua a mover-se e conserva a matriz V6 no hover. `last-refinement-visual.json`
regista os dois temas em desktop/mobile, preço no pico do temporizador nativo,
hover com ponteiro real e ligação da fotografia acessível através do ícone 2D.
`reverse-after-crisp-summary.json` verifica inversões rápidas com a nova separação
de planos, sem flashes verdes ou falhas de cobertura. As capturas atuais são
`sharp-after-*-text-1to1.png` e `last-refinement-*-hover.png`; as anteriores
`header-final-*` documentam a versão anterior do preço.

## Revisão do comportamento dos dois fundos secundários

Após comparar as sete versões em desktop/mobile, a escolha é conservar
“Venha conhecer-nos” estática: o fundo serve de ambiente para leitura, mapa e
preenchimento sem movimento concorrente. “O próximo passo começa aqui” mantém
a profundidade discreta ligada diretamente ao scroll nativo; a secção curta
funciona como pausa editorial e o deslocamento não continua quando o scroll para.
Com movimento reduzido, ambos ficam estáticos. Não foi necessário trocar fotos,
alterar focos/recortes, tons, layout ou o comportamento dos headers nesta revisão.
`section-behavior-before.json` regista enquadramentos e cobertura nas entradas,
centro e saídas, ida/volta e paragem. `section-behavior-final.json` acrescenta
scroll lento (incrementos de 8px), rápido, inverso e movimento reduzido nas
sete versões e nos dois tamanhos; não foram observadas lacunas ou deriva residual.
O verificador existente `scripts/check-home-hero-directions.mjs` foi adaptado
ao layout comum, à ancoragem do header e à duração de entrada coordenada.
Não se repetiram testes globais nesta
revisão visual. A validação técnica não constitui aprovação de publicação.
