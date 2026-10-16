# Derivados locais de imagem — 16 de outubro de 2026

Os ficheiros de origem em `static/`, `assets/` e `src/lib/assets/` foram preservados. Os novos derivados usados pelas apps estão em `apps/website/src/lib/assets/optimized/` e `apps/crm/src/lib/assets/optimized/`. Não há alterações de fotografias no Supabase, ficheiros remotos ou dados do catálogo.

## Logótipos

WebP **sem perdas**, com o mesmo canvas, proporções, cores e transparência. Redimensionamento Lanczos3; sem recorte nem ampliação. Website: 180, 360, 720, 1200 e 1881 px; CRM: 180, 360 e 720 px. `srcset`/`sizes` selecionam os ficheiros para header, hero, convite, rodapés e wordmark. Os tamanhos do hero/convite incluem margem para a projeção/transformação visual existente e o website conserva o original de 1881 px como candidato para elevada densidade. A troca de tema antes da hidratação atualiza `src` e `srcset` em conjunto.

| Recurso | PNG anterior | Novo 360 px | Novo 720 px | Novo 1200 px |
| --- | ---: | ---: | ---: | ---: |
| Logótipo de texto escuro | 406 094 B | 26 312 B (−93,5%) | 77 832 B (−80,8%) | 168 204 B (−58,6%) |
| Logótipo de texto branco | 244 158 B | 20 334 B (−91,7%) | 55 028 B (−77,5%) | 111 842 B (−54,2%) |

São exemplos por ficheiro selecionado, não um total de download para todos os dispositivos. O navegador pode reutilizar um candidato maior já em cache. Os restantes tamanhos e bytes exatos constam de `manifest.json`. Os logótipos WebP têm erro RGB visível e erro de alpha **zero** face à referência redimensionada.

O favicon atual do CRM mantém o mesmo desenho do logótipo completo; apenas usa um novo PNG pequeno de 64 px, sem perdas, em vez do PNG de 1881 px. As propostas de desenho novo estão separadas em `docs/favicon-proposals/` e **nenhuma está ativa**.

O proprietário rejeitou a direção da série inicial 01–04. A série posterior 05–12 usa exclusivamente recortes do lettering e do perfil dos dois logótipos originais. As oito opções estão em `docs/favicon-proposals/serie-05-12/`, com comparações honestas a 16/32 px e ampliação a 128 px. A série anterior é conservada como não aceite. Não houve escolha nem ativação de proposta.

Revisão seguinte: a série atual 21–28 parte de 09/10, iguala alturas de AUTO/NUNES e revê margens, alinhamento e intervalos, com PNG/ICO renderizados por resolução numa grelha de píxeis. Os PNG originais são a origem dos contornos, sem fonte substituta; não foi encontrado um original vetorial. Os fundos vêm de tokens/cores reais do website. A série 13–20 foi apenas um estudo de fundos e fica preservada. Nenhuma proposta foi ativada, nem se implementou troca automática por tema. Comparação e proveniência em `docs/favicon-proposals/serie-21-28/`.

## Fachadas

AVIF qualidade 75, crominância 4:4:4, com WebP qualidade 90 como alternativa. Variantes 480, 640 e 1024 px para Quem somos. O hero panorâmico usa sempre o ficheiro de **1024 × 768**, incluindo em mobile: a largura realmente ampliada antes do recorte excede a de um painel visível. As fórmulas de posicionamento, zoom, máscaras e transições continuam iguais. A medição usa o contentor da fotografia, independentemente do elemento `picture`.

| Fotografia de 1024 × 768 | JPEG anterior | AVIF atual | Redução |
| --- | ---: | ---: | ---: |
| Fachada 1 | 309 525 B | 241 249 B | 22,1% |
| Fachada 2 | 298 994 B | 228 868 B | 23,5% |

Não há uma fonte maior no repositório: criar uma imagem ampliada não acrescentaria detalhe. O erro absoluto médio do AVIF face ao JPEG descodificado é de 1,639 e 1,618 por canal/255, respetivamente. Isto não é um teste de perceção universal; foram também inspecionados detalhes a 100% em `comparacao-qualidade.png` e páginas compiladas no navegador.

## Recursos mantidos

Os SVG das marcas, placeholder e mapa já são vetoriais pequenos. A imagem social PNG mantém o URL público estável e as dimensões usadas pelos metadados. Os ficheiros demo sem uso e as imagens Unsplash/Supabase não foram recomprimidos. Os originais públicos continuam disponíveis para URLs antigos.

## Reproduzir e verificar

Usar o Sharp já declarado pelo backend:

```sh
node scripts/optimize-local-images.mjs
node scripts/preview-local-images.mjs
node scripts/create-favicon-proposals.mjs
node scripts/create-brand-faithful-favicons.mjs
node scripts/create-refined-stacked-favicons.mjs
```

`manifest.json` regista dimensões, alpha, bytes, política do encoder e erro médio de cada um dos 30 derivados. `index.html` e `comparacao-qualidade.png` permitem inspecioná-los. Exportar uma cópia de revisão para uma pasta escolhida com `node scripts/export-image-review.mjs "<destino>"`; ficheiros existentes diferentes não são substituídos.

Para atualizar uma exportação criada por este script, `--refresh-owned` permite renovar apenas ficheiros cujos hashes ainda correspondam ao inventário anterior, guardando também os bytes anteriores em `Historico/`. Se algum ficheiro tiver sido editado pelo utilizador, a atualização para antes de o substituir.

Builds website/CRM aprovadas; website 362 testes; Svelte check website 0 erros/0 avisos, CRM 0 erros/15 avisos existentes. O ensaio das builds através do gateway verificou 40 recursos com GET/HEAD/304 e cache imutável. Inspeção do website desktop e viewport de 390 px, Quem somos mobile e login CRM, com dados de backend/Clerk fictícios. A autenticação real e todos os dispositivos/rácios de píxeis não foram ensaiados. Preservam-se noindex, pendências legais/de dados e estado de publicação. Sem commit, push ou deploy nesta tarefa.


## Integração final autorizada

O proprietário escolheu e pediu a aplicação da variante 31, #1B1B1D (média RGB arredondada de 25/23), no website público. WebsiteIconHead no layout raiz define um conjunto fixo de PNG/ICO e touch; os ficheiros ativos são importados com hash e /favicon.ico mantém o fallback convencional. PNG 16/32/48/64/128/180/192/256/512 e master SVG com raster original incorporado ficam preparados no projeto e na cópia de revisão. Não foi criada PWA.

Validação conjunta na main: website 374 testes, CRM 119, builds de ambas as apps, Svelte check 0 erros (CRM com 15 avisos existentes), 44 recursos GET/HEAD/304 pelo gateway e regressão Chrome dos placeholders aprovados. O gateway normaliza o MIME ICO em falta na tabela local do adapter apenas em ficheiros registados do build; só os caminhos imutáveis com hash podem receber cache longo. O utilizador autorizou commit e push de todo o trabalho pendente, incluindo a correção de placeholders. A revisão efetivamente publicada continua por verificar; isto não resolve pendências legais/de dados.
