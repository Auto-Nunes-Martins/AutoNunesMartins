# Experiência publicada: uma versão por fotografia

**Regra atual de pertença (28/10/2026):** todas as fotografias presentes na viatura acompanham a publicação global; não existe seleção individual. As referências históricas abaixo a «aprovadas» descrevem a política anterior. A autorização atual verifica publicação/elegibilidade da viatura, pertença a `Vehicle.photos` e versão. Ver [regra oficial](vehicle-photo-publication.md). Esta alteração não desfaz a experiência de entrega nem altera os masters ou WebP84.

Pedido do proprietário em 25/10/2026: usar no site normal a mesma versão da fotografia principal nos cartões, miniaturas, galeria e fullscreen. A alteração seletiva de 28/10/2026 substituiu essa regra nos cartões. A ficha manteve 1600 px fixos até à nova política de 30/10/2026 descrita abaixo. Originais pequenos mantêm o fallback nativo existente, sem ampliação artificial.

## Política atual — responsivo com reaproveitamento, 30/10/2026

Pedido explícito do proprietário: escolher uma resolução adequada ao dispositivo, espaço ocupado e DPR, reutilizá-la entre miniatura/principal/galeria e abrir fullscreen com os pixels disponíveis. Uma versão maior só substitui essa cópia depois de descodificada, quando acrescenta pelo menos 20% de resolução útil. Só a foto ativa no fullscreen é elegível para essa melhoria; não se preparam 2560 px para todas preventivamente. Todas as fotos continuam eager à entrada, sem repor o lazy mobile histórico.

No website, principal e miniaturas partilham a mesma sessão por fotografia/versão/resolução. Preloads, navegação e `sizes` usam o mesmo cálculo do layout da ficha. O recorte cover conta: uma fotografia larga pode exigir mais pixels que a largura do elemento. A ficha e a consulta de acesso podem fornecer dimensões já persistidas, num único batch indexado e só das versões autorizadas, sem ler Storage. Hints ausentes mantêm o fallback existente e permitem refinar a resolução depois do primeiro decode; nesse caso pode ser necessário mais 1 candidato, sem identificar bytes pequenos como uma cópia maior. Resize aumenta o grupo quando necessário e conserva cópias maiores já obtidas. Miniaturas da própria ficha também usam a sessão, incluindo as do viewer.

Cartões de catálogo/homepage/favoritos/relacionadas e o destaque mantêm a sua seleção responsiva por área/cover/DPR. Podem escolher uma resolução diferente da ficha. O handoff conserva os pixels descodificados enquanto a resolução necessária é adquirida, com as mesmas validações de identidade/versão e prazo de 15 s; não promete 0 pedidos quando a ficha precisa de mais pixels. Na navegação efetiva pode também reter os bytes já obtidos pelo cartão, por leitura estritamente cache-only: uma cópia suficiente ou maior evita pedir uma menor só para coincidir com a seleção inicial da ficha. Cache em memória continua limitada a 64 × 1048576 bytes por orçamento, 120 entradas globais e 20 × 1048576 bytes por fotografia; cópias da sessão são revogadas ao sair. Não se conserva autorização de uma visita anterior.

No CRM privado, a action mede os elementos depois de montar e escolhe entre variantes assinadas já existentes e o master nativo. Não atribui uma URL provisória de thumbnail no SSR antes de medir o grupo. Principal/miniaturas da consulta usam a área da principal; seleção/edição/previews do mesmo objeto partilham os candidatos necessários aos elementos apresentados. Blobs/rascunhos continuam locais. O fullscreen mostra os pixels disponíveis e só melhora a foto ativa após decode. Não há armazenamento persistente novo de URLs assinados, nem reutilização entre objetos de payload/autorização diferentes. A sessão CRM continua a exigir JavaScript.

Não foram alterados masters, compressão WebP84, larguras geradas, pertença/publicação, autenticação ou os limites de upload. Esta política de rede não corrige retenção de RAM durante processamento de imagens. A investigação nativa está em [native-photo-memory-investigation.md](native-photo-memory-investigation.md).

### Verificação e medições desta política

Fixtures locais, Chrome, 3 fotografias reais do repositório, mesmos 6 cartões em cada perfil. Desktop 1440×900 DPR1 e mobile 390×844 DPR2. Bytes de corpos, sem overhead HTTP, MB decimais:

| Entrada na ficha | Antes, 1600 fixos | Política final | Redução | Pedidos antes → depois |
| --- | ---: | ---: | ---: | ---: |
| Desktop | 1,303288 MB | 0,889638 MB | 31,7% | 6 → 4 |
| Mobile | 1,303288 MB | 0,462486 MB | 64,5% | 6 → 3 |

Desktop escolheu 1280; mobile escolheu 800/1280 conforme o recorte. Os cartões mantiveram os mesmos corpos: 0,791604 MB desktop e 1,989084 MB mobile, com os mesmos 6 cartões. Fullscreen e revisitas não transferiram novos corpos neste percurso. Ainda houve 1 revalidação na primeira entrada em cada perfil e 4/3 no regresso à ficha (desktop/mobile); não se promete ausência de pedidos condicionais. Nas capturas guardadas de baseline e final o handoff foi observado nos 2 perfis, sem loading enquanto os pixels temporários estavam visíveis. Uma tentativa inicial a frio navegou antes de hidratar; não foi usada para estes resultados. O teste focado verifica também o handoff durante uma aquisição atrasada.

`node scripts/check-responsive-photo-reuse.mjs` exercita público e CRM em 1024×900 DPR1, 390×844 DPR2 e 1280×900 DPR1,5. A fixture 1,2:1 mostra uma melhoria útil para 1280/2560 nos perfis desktop e mantém 800 no mobile. Nenhum frame vazio observado durante a substituição atrasada; reabrir não gerou pedidos. Inclui resize e bloqueio de reutilização por nova versão/permissão. Os testes unitários cobrem descarte/revogação local e aquisição falhada; o teste Svelte existente preserva recortes, drag, teclado e dispositivos. São fixtures, não um ensaio de produção ou de todos os navegadores.

Resultados numéricos: [baseline](measurements/responsive-reuse-2026-10-30/before/results.json), [final](measurements/responsive-reuse-2026-10-30/final/results.json), [reutilização no browser](measurements/responsive-reuse-2026-10-30/reuse-browser.json). Para repetir: definir `PHOTO_MEASUREMENT_MODES=before` e um diretório novo em `PHOTO_MEASUREMENT_DIR` para a baseline; usar `responsive` para a política atual. `PHOTO_RELAX_PREVIEW=true` regista a limitação de mudança de documento em vez de a esconder. Não substituir resultados históricos.

O procedimento de revert abaixo é histórico da experiência isolada. Depois desta política nova, não o aplicar cegamente: comparar os commits e preservar a política e os ajustes posteriores solicitados.

## Referências duradouras

- Antes: tag anotada `photo-delivery-before-shared-image-2026-10-25`, em `22022f4578eab87cf514d4ddef1c6ae1aa5357c1`.
- Commit isolado da experiência: tag anotada `photo-delivery-shared-image-2026-10-25`, título `Use one 1600px photo across public vehicle views`.
- As duas tags são publicadas no remoto de `main`. Não depende de uma stash, desta máquina ou de recordar o SHA.
- A correção do formulário CRM é um commit separado.

## Alteração seletiva de cartões — 28 de outubro de 2026

Por pedido do proprietário, o bloco partilhado `vehicleCard` volta a oferecer derivados 320/384/800/1280/1600/2560 com `srcset`. Abrange catálogo junto aos filtros, homepage, favoritos e carrossel de relacionadas. O cartão especial de destaque da homepage (`FeaturedPhoto`) e o seu preload também passam a responsivos. `sizes` considera colunas, sidebar, proporção da foto, recorte cover e células fracionárias do carrossel; a medição do elemento ajusta o valor após layout. A densidade fica a cargo do navegador. Não foi reposta a entrega responsiva nos detalhes.

Só uma navegação efetiva captura os pixels já descodificados do cartão, em memória, para uma apresentação temporária. A ficha só os aceita se a identidade da primeira fotografia coincidir com a versão da consulta atual. A camada temporária é removida quando a cópia 1600 descodifica, numa falha ou ao desmontar. Expira em 15 segundos e só pode ser consumida uma vez. Não alimenta a cache da galeria nem substitui a cópia 1600. Uma alteração de versão, outra fotografia ou origem diferente impede a reutilização.

A preparação de todas as fotos em 1600 continua apenas na navegação efetiva, nunca por hover ou por mostrar cartões. A ficha mantém todas as miniaturas eager e os preloads existentes; fullscreen reutiliza as cópias 1600. Não se presume que 1600 esteja na cache: se o cartão recebeu 800/1280, a ficha ainda tem de obter 1600. Autorização dos endpoints, publicação/pertença, versões, masters e WebP84 permanecem inalterados. Sem publicação/deploy neste trabalho.

Medição reproduzível: `node scripts/measure-card-photo-delivery.mjs`. Resultados e limitações em `docs/measurements/card-responsive-2026-10-28/`.

## Desfazer num chat futuro

Pedido: **«Desfaz a experiência de foto única e repõe as imagens responsivas.»**

1. Ler este documento, verificar o checkout e preservar trabalho não relacionado. Usar uma worktree limpa se necessário.
2. `git fetch origin main --tags`.
3. Inspecionar `git show --stat photo-delivery-shared-image-2026-10-25`.
4. Sobre o `main` atual, executar `git revert photo-delivery-shared-image-2026-10-25`. Cria um novo commit inverso apenas da experiência. Resolver eventuais conflitos mantendo alterações posteriores e restaurando a política anterior; não substituir ficheiros inteiros sem revisão.
5. Executar os testes de fotografias, tipos e build do website. Confirmar cartões, miniaturas, navegação, fullscreen, cache, versões e autorização atual; publicar pelo fluxo normal, sem force push.

**Não usar `reset --hard`, voltar o repositório inteiro à tag anterior, nem reverter intervalos de commits.** A tag anterior é uma referência de consulta. Este rollback não regrava Storage, masters ou compressão WebP84; não desfaz correções posteriores do CRM. Restaura a entrega de fotografias, não todo o site a uma data antiga.

## Alteração isolada

Antes: candidatos responsivos 320/384/800/1280/1600/2560; miniaturas escolhiam ficheiros pequenos; a primeira principal reutilizava os bytes escolhidos pelo navegador, e outras fotos da galeria pediam 2560 ou fallback. Fullscreen já reutilizava a cópia da galeria.

Agora: cartões, preloads e imagens públicas usam `?v=<versão>&w=1600`. A preparação da navegação descobre versões atuais e aquece até nove fotos com a mesma ordem de parâmetros. A galeria procura primeiro bytes retidos pelas miniaturas, depois a cache HTTP sem contacto com o servidor; só uma foto ainda não obtida faz o pedido autorizado normal. Uma falha resolvida nessa visita não é repetida; cópias locais descartadas continuam indisponíveis.

Consultas atuais de acesso e validação de versões permanecem obrigatórias. Reutilizar bytes não reutiliza autorização antiga. Endpoints, regras de publicação, cache-control HTTP, layout, recorte, animações, drag, seleção e partilha não foram alterados. A cache de miniaturas passa de 4 MiB para 64 MiB, para receber as fotografias maiores; continua limitada a 120 entradas, 20 MiB por ficheiro e à memória deste documento.

Ficheiros do commit:

- `apps/website/src/lib/vehiclePhotoSources.ts` e teste correspondente.
- `apps/website/src/lib/publicThumbnail.ts` e teste correspondente.
- `apps/website/src/lib/publicGallerySession.ts` e teste correspondente.
- `apps/website/src/lib/publicGalleryPhoto.ts` e teste correspondente (sem spinner ao rever cópias retidas).
- `apps/website/src/lib/components/stand-concepts/images.test.ts`.
- Este documento e a referência em `AGENTS.md`.

## Medições locais e limites

Build e tipos aprovados; 530 testes do website incluem identidade, autorização, falhas, descarte, partilha de bytes e ausência de spinner ao rever uma cópia retida. Chrome desktop 1440×900 DPR1 e mobile 390×844 DPR2. Fixture sem fallback remoto: seis viaturas sintéticas, ficheiros reais locais da receita WebP84, nove fotos na primeira galeria; duas exercitam fallback de masters menores. Não é uma média de todo o site nem uma medição do deploy público.

Verificação adicional nos dois perfis: hashes SHA-256 iguais entre cartão/principal/miniatura e entre principal/miniatura/fullscreen; foco por teclado, drag sem selecionar outra foto e partilha inline preservados. No mobile, cinco revisitas não pintaram frames com spinner. Revogar uma cópia local não fez novo download; retirar aprovação na fixture e voltar à ficha resultou em 404 sem reutilizar a imagem.

Bytes de corpos enviados pela fixture, sem overhead HTTP:

| Percurso                                        | Antes desktop | Foto única desktop | Antes mobile | Foto única mobile |
| ----------------------------------------------- | ------------: | -----------------: | -----------: | ----------------: |
| Catálogo visível                                |       496 584 |          1 678 122 |      761 882 |         1 124 982 |
| Entrada na ficha / miniaturas                   |       426 698 |          4 124 678 |      149 652 |         4 124 678 |
| Fotos 2/3, rever 1/3 e avançar para 4 no viewer |     1 558 581 |                  0 |    1 558 581 |                 0 |
| Regresso ao catálogo e à ficha                  |             0 |                  0 |            0 |                 0 |

O mobile carregou quatro cartões neste percurso; o desktop seis. Não comparar estes totais como se fossem o mesmo conjunto visível. Foto única: 16 pedidos de imagens ao servidor no desktop e 14 no mobile, incluindo **duas respostas 304** da primeira foto na entrada na ficha. Os restantes eram primeiros downloads de URLs distintos. As nove fotos da galeria usaram uma única largura solicitada, 1600. Abrir/reabrir fullscreen e rever fotos não gerou novos pedidos. A baseline fez 21/18 pedidos, respetivamente, incluindo revalidação no regresso à ficha.

O custo inicial aumenta porque as miniaturas recebem ficheiros grandes. As fotos preparadas são depois reutilizadas pela principal e fullscreen. Não se promete melhoria geral de velocidade nem zero pedidos em toda a navegação. O proprietário autorizou avaliar este comportamento e pode pedir o rollback acima.

## Ajuste posterior de agendamento mobile — 25 de outubro de 2026

Por novo pedido do proprietário, o agendamento mobile passou de nove para três fotos preparadas inicialmente. Preloads da quarta à nona só são elegíveis em desktop; a preparação de navegação usa três até700px e nove acima. A ficha mobile atribui URLs às restantes miniaturas apenas quando intersectam a sua faixa horizontal. Na largura390px observada foram pedidas as primeiras quatro (três completas e a quarta parcialmente visível). Ao abrir fullscreen, só a quinta adicional, já visível nessa faixa, começou a carregar; ao deslizar para o fim foram pedidas as miniaturas que entraram no campo visível. O fullscreen mobile deixa de aguardar todas as miniaturas e pode obter as visíveis em falta com a autorização normal. O desktop mantém preparação de nove e reutilização cache-only do viewer. Mantidos versão, autorização, memória limitada, ficheiro único1600 e receita WebP84; não foram repostos candidatos responsivos. As medições da tabela acima são históricas da experiência anterior a este ajuste de agendamento, não novos totais medidos.

## Política atual: todas as fotografias à entrada — 26 de outubro de 2026

O proprietário revogou o lazy loading das fotografias da viatura e pediu todas logo à entrada, tanto em mobile como em desktop. Substituída a preparação limitada a três/nove por todas as versões aprovadas descobertas na consulta atual, com até seis transferências simultâneas. Todas têm preload e miniatura eager; retiradas a observação de visibilidade e a camada de adiamento mobile. O fullscreen abre imediatamente e reutiliza os pixels retidos, com fallback autorizado normal para uma fotografia ainda em falta. Mantidos ficheiro1600, versões, autorização atual, cache limitada e receita WebP84. Esta política substitui o ajuste mobile de três fotos descrito acima; as medições antigas permanecem históricas.
