# Regra oficial das fotografias das viaturas

Pedido do proprietário de 28 de outubro de 2026: **todas as fotografias guardadas em `Vehicle.photos` acompanham a publicação global da viatura**. Não existe uma seleção individual de fotografias públicas ou privadas dentro da viatura.

- Uma viatura só aparece no site quando `webPublished` está ativo e cumpre a elegibilidade atual: Disponível ou Reservada, sem data de venda nem venda associada. Adicionar fotografias nunca publica automaticamente uma viatura.
- `Vehicle.photos` é a única fonte de ordem, capa e conteúdo da galeria. A primeira fotografia válida é a principal tanto no CRM como no anúncio. O limite continua a ser 20 fotografias e os caminhos continuam a ser validados quanto à pertença à viatura.
- Numa viatura já publicada, as fotografias adicionadas ficam públicas quando são guardadas. Reordenar atualiza a ordem e a capa; eliminar retira a fotografia da lista pública. Nos fluxos com rascunho, tudo é aplicado na mesma transação ao guardar.
- O destaque editorial da homepage pode escolher qualquer fotografia atual da viatura elegível. A escolha do destaque não exclui fotografias da galeria nem muda a capa da viatura. Se essa fotografia for eliminada, o destaque não é substituído silenciosamente.
- Os controlos de inclusão/exclusão individual foram removidos. Os indicadores mostram o estado global guardado ou «Por guardar» para novos ficheiros do rascunho. A prévia inclui a lista completa.

## Compatibilidade e migração

`publicPhotoPaths` permanece no esquema como campo legado, temporariamente espelhado nas escritas e na resposta de detalhe CRM. **Nunca filtra leituras públicas**, mesmo que tenha um subconjunto antigo, esteja vazio ou desatualizado. Não é necessário alterar registos existentes: a nova regra é aplicada nas leituras a partir de `photos`.

Os endpoints aceitam `photoPaths` de clientes antigos como entrada obsoleta e ignoram esse subconjunto. Os clientes atuais enviam a lista completa em `photos` e os dados globais de publicação separadamente. Não é necessária migração Prisma, backfill ou reprocessamento para esta alteração; nenhuma atualização de dados reais foi executada.

## Acesso e entrega

As consultas continuam a verificar publicação, estado, pertença atual e versão da fotografia em cada pedido. URLs antigas deixam de servir uma posição cuja identidade mudou; retirar a publicação oculta todas as fotografias. A cache de bytes não substitui a autorização atual. Não se expõem caminhos ou URLs de Storage no DTO público.

Mantêm-se os masters privados, a receita WebP84 e a experiência de ficheiro público único de 1600 px, sem `srcset`, descrita em [photo-delivery-experiment.md](photo-delivery-experiment.md). Não foram reprocessados ficheiros.

## Scroll e ordenação

A grelha acompanha a altura normal da página, sem painel vertical limitado com `overscroll-behavior: contain`. Só a pega inicia drag; o corpo da fotografia permite scroll vertical por toque. A pega também permite Espaço e setas por teclado. Botões e ajuda expansível preservam a interação normal.

Verificação reproduzível: `apps/crm/test/photo-gallery.browser.mjs`, com o componente real e fotografias fictícias, exercita roda sobre imagens e botões, ajuda fechada/aberta, gesto touch sem reorder, drag pela pega, teclado, adicionar/eliminar e ausência de sobreposição dos cartões a 390 e 1366 px. Os testes HTTP backend cobrem a lista completa com campo legado vazio, adição após publicação, reorder, remoção, versões antigas e despublicação.

Resultado local desta alteração: 465 testes backend, 260 testes CRM, 578 testes website e dois testes Chrome aprovados. Tipos backend e Svelte check CRM sem erros; builds CRM e website concluídas. Os testes usam fixtures, incluindo Storage simulado e bases PostgreSQL isoladas; não alteram viaturas reais.
