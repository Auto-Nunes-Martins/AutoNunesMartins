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

A grelha acompanha a altura normal da página, sem painel vertical limitado com `overscroll-behavior: contain`. **Arrasta-se o cartão inteiro, incluindo imagem e corpo, sem pega.** No telemóvel, um toque prolongado de 350 ms inicia a ordenação; mover antes desse prazo cancela o drag e permite scroll vertical. Espaço e setas ordenam a partir do próprio cartão. Os botões de principal/eliminar e a ajuda expansível preservam a interação normal.

Os cartões têm uma imagem de 210 px em desktop e 182 px em mobile, com enquadramento que conserva a fotografia completa e duas ações. A grelha usa posições normais de CSS Grid: eliminados o subgrid e as posições explícitas que interferiam com o placeholder. O clone usa os mesmos estilos do cartão fora da grelha, sem regras dependentes de um antepassado `.dense`, e não muda de dimensões para imitar o placeholder durante o drag.

Verificação reproduzível: `apps/crm/test/photo-gallery.browser.mjs`, com os componentes reais e fotografias fictícias, exercita roda sobre imagens e botões, ajuda fechada/aberta, gesto touch sem reorder, toque prolongado para drag, drag pela imagem e pelo corpo, dimensões do clone durante o gesto, teclado, adicionar/eliminar/capa e ausência de sobreposição a 390 e 1366 px, em ambos os temas. Os testes HTTP backend cobrem a lista completa com campo legado vazio, adição após publicação, reorder, remoção, versões antigas e despublicação.

Validação inicial da regra: 465 testes backend, 260 testes CRM, 578 testes website e dois testes Chrome aprovados. Tipos backend e Svelte check CRM sem erros; builds CRM e website concluídas. Os testes usam fixtures, incluindo Storage simulado e bases PostgreSQL isoladas; não alteram viaturas reais.

## Acabamentos da interface — 28/10/2026

- O toast de conclusão conserva a miniatura dentro de uma moldura fixa com overflow cortado e imagem posicionada em absoluto. A imagem deixa de influenciar as dimensões intrínsecas do grid; nomes longos também respeitam a largura disponível. A fixture usa o Sonner e o toast reais, imagens extremamente largas/verticais, ambos os temas e o temporizador original de 6500 ms.
- O fullscreen do website usa hover/active neutros, bordas e foco brancos, sem vermelho nos controlos e nas miniaturas. A chamada de contacto da última fotografia também usa hover neutro. Mantidos os comportamentos, áreas de toque e preferência de movimento reduzido. Verificação em `apps/website/test/galleryControls.browser.mjs`.
- Na ficha CRM, o bloco «Notas» corresponde a `description` interno e só aparece quando tem texto após `trim()`. A descrição pública e o acesso à edição mantêm-se independentes.

A revisão da interface passou nos quatro testes Chrome CRM (desktop/mobile × tema claro/escuro) e nos quatro cenários fullscreen (desktop/mobile × movimento normal/reduzido), com os componentes e ícones reais. A deformação durante drag e o overflow da imagem do toast são verificados enquanto acontecem, além do estado final.
