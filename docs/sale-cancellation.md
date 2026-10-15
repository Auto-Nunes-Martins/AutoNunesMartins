# Anulação de vendas

O CRM permite anular uma venda sem apagar o registo, a retoma, despesas ou relações. A anulação requer motivo, revisão dos efeitos e confirmação explícita. O fluxo não calcula reembolsos, não executa pagamentos e não confirma a regularização de documentos ou crédito.

## Decisões e efeitos

- Sem retoma: a viatura original regressa a `AVAILABLE`, sem data de venda e sem publicação automática no site. A venda e a entrega permanecem como histórico.
- Retoma devolvida: a ficha passa a `RETURNED`, fora do stock e do catálogo público. Permanecem as despesas, fotografias, documentos, valor de aquisição e ligação histórica à venda. A edição comum continua disponível; o estado não pode ser alterado para a reintroduzir no stock através de uma edição genérica.
- Retoma mantida: o administrador confirma o valor de aquisição independente. A ficha existente conserva as despesas e passa a usar esse valor e a data da anulação como nova aquisição. Uma reserva anterior é libertada; um rascunho permanece rascunho. O valor anterior e os dados originais ficam preservados no snapshot de auditoria. A ligação de origem à retoma permanece histórica.
- Retoma com venda posterior: é apresentada a venda dependente, que precisa de ser resolvida primeiro. Depois da anulação dessa venda, o administrador pode voltar ao fluxo da venda original.
- Retoma para abate/saída sem ficha de stock ou indisponível: o fluxo apresenta a limitação concreta. É necessária regularização factual da saída/indisponibilidade; não presume que a viatura ainda pode ser devolvida ou adquirida pelo stand.

As marcações de documentos/crédito e tarefas existentes são preservadas para revisão manual. A anulação não limpa informação pendente nem cria uma reserva nova. A viatura original e a retoma deixam de estar publicadas, mas conservam fotos e configuração pública para aprovação posterior.

## Relações e concorrência

`Sale.vehicleId` continua a ser o identificador único da venda **activa**. Fica nulo na anulação. `Vehicle.sale` e o lookup `sale.findUnique({ where: { vehicleId } })` continuam a seleccionar apenas essa venda activa, incluindo nos recálculos financeiros. `Sale.originalVehicleId` e `Vehicle.salesHistory` conservam todas as vendas, permitindo revender a mesma ficha.

O cancelamento usa uma transacção `Serializable` e bloqueia as linhas de viatura com `SELECT ... FOR UPDATE`, a mesma linha e operação que `saleFinancials.lockVehicle` utiliza na criação, entrega, edição e despesas. Quando há duas viaturas, os bloqueios são obtidos por ordem de ID. O resumo tem um token HMAC que inclui a decisão e o estado revisto. Alterações de preços, despesas, entrega ou retoma invalidam a confirmação; conflitos de serialização pedem nova revisão. A repetição da mesma confirmação é idempotente, inclusive depois de uma nova venda da original.

As relações históricas impedem eliminar a original ou a retoma em cascata. Uma protecção PostgreSQL impede reactivar uma retoma `RETURNED` por alteração genérica do estado. As caches são invalidadas depois do commit.

Vendas anuladas ficam acessíveis em `/vendas/anuladas`, no detalhe da venda e no histórico do cliente. A listagem/exportação normal de vendas e os indicadores de vendas do dashboard excluem anuladas. As viaturas devolvidas são omitidas do stock por defeito; o filtro «Devolvidas (histórico)» permite consultá-las. Valores de compra no detalhe de uma venda anulada são apresentados a partir do snapshot da anulação.

## Migration e publicação técnica

Fonte: `backend/prisma/migrations/20261014120000_preserve_cancelled_sales/migration.sql`.

Antes de disponibilizar este fluxo numa instalação real, executar a migration pelo processo normal do projecto e gerar o cliente Prisma para o esquema novo. A migration preenche `originalVehicleId` nas vendas existentes, permite libertar apenas a ligação activa, acrescenta o estado `RETURNED`, os campos de anulação, as restrições históricas e a protecção do stock devolvido.

O backend anterior não preenche `originalVehicleId`. A aplicação da migration e a actualização do backend precisam de uma transição coordenada, sem deixar o backend anterior a criar vendas no intervalo. A prontidão legal/dados do website permanece sujeita ao checklist de publicação existente.

Em 15 de outubro de 2026, a migration foi aplicada à base configurada no backend local para reparar os erros de consulta causados pelo código novo sem o esquema correspondente. O backend foi parado durante a transição e reiniciado em seguida. A comparação antes/depois confirmou preservação dos dados existentes: 19 vendas, 2 retomas, 34 viaturas e 117 despesas; o preenchimento de `originalVehicleId` ficou consistente em todas as vendas. As consultas de stock, vendas, clientes, utilizadores e tarefas voltaram a passar. A importação posterior dos cinco exemplos da homepage é uma operação separada, pedida explicitamente pelo proprietário. Não houve deploy ou push.

## Verificação

- 18 testes do serviço e endpoints: decisões sem retoma/devolvida/mantida, confirmação, valores, dependência posterior, indisponibilidade/abate, snapshot, despesas, stock, publicação, revisão desactualizada, erro de serialização, rollback, idempotência, entregas e consultas activas/históricas.
- 4 testes da migration sobre PostgreSQL isolado em memória (PGlite): migrations anteriores, backfill com venda/retoma existentes, rollback, revenda, unicidade activa, relações históricas e protecção/edição da ficha devolvida.
- 5 testes das acções reais SvelteKit: revisão, valor independente, confirmação, conflitos/dependência e redireccionamento para o histórico preservado.
- Smoke do componente real em Chrome headless, com respostas de formulário e dados fictícios: percurso de devolução e manutenção, motivo/valor obrigatórios, checkbox explícita, resumo e histórico. Não usa sessões ou dados reais.

O teste de serialização exercita a resposta a um conflito Prisma simulado; não é um ensaio de carga com duas ligações concorrentes a uma instalação PostgreSQL real.
