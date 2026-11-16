# IVA documentado e resultado de gestão

Implementação autorizada pelo proprietário em 15-11-2026. Não constitui declaração de conformidade fiscal nem publicação.

## Regras escolhidas

- Particular: IVA da viatura = arredondar(max(venda − compra, 0) × 23 / 123, 2). Despesas fora desta base.
- Comerciante: IVA da viatura zero, por configuração do proprietário. Mantém IVA da comissão e dedução das despesas.
- Comissão nova: bruto com IVA incluído a 23%; IVA arredondado por documento e líquido = bruto − IVA. Apenas o líquido entra no resultado.
- Despesa: conservar total da fatura e registar IVA efetivo. IVA identificado integralmente dedutível para gestão; zero explícito significa sem IVA, vazio significa por identificar.
- Resultado estimado = venda − compra − IVA da viatura − (despesas brutas − IVA das despesas) + comissão líquida. Não subtrair novamente o saldo de IVA. Antes de gastos gerais e impostos sobre o rendimento.
- Retoma = aquisição independente; a venda original mantém o preço total. Correções de aquisição e resolução de cadeias usam a mesma fórmula.

## Datas e resumo fiscal

O dashboard estima o IVA por mês, ano atual ou últimos 12 meses. Usa a data da venda para o IVA da viatura e da comissão, e a data da fatura para as despesas, incluindo viaturas em stock. CSV e PDF separam os valores a pagar, a deduzir e o saldo.

O contador global inclui comissões antigas sem bruto confirmado e despesas com IVA ou data da fatura por confirmar. O resumo serve para gestão interna. Vendas anuladas ficam excluídas.

## Migração e compatibilidade

Migração aditiva: backend/prisma/migrations/20261115120000_document_vat/migration.sql. Aplicar na janela de atualização do backend/CRM e regenerar Prisma antes de executar o novo código. Não aplicada à base de dados real durante a implementação.

Preserva montantes originais de despesas e comissões líquidas antigas. Não infere bruto, IVA nem datas fiscais. Guarda valores anteriores de IVA/resultado/comissão em Sale.legacyFinancials antes de recalcular estimativas das vendas ativas; vendas anuladas e snapshots não são recalculados. O resultado histórico estimado pode mudar pela correção da fórmula, sem inventar deduções históricas.

Editar despesas na ficha da viatura para confirmar IVA e data fiscal. Editar comissão na venda: bruto vazio numa comissão antiga preserva o líquido; bruto confirmado converte explicitamente; 0 retira a comissão. API antiga com commission líquido compatível; comissão já documentada exige edição bruta. Formulário novo envia commissionGross.

Sem rollback automático. Preservar documentos novos antes de qualquer reversão; não eliminar colunas com documentos registados.

## Validação

Domínio, PostgreSQL isolado (PGlite), migração sobre histórico, ações de formulário e exportações. Casos: particular/comerciante, comissão bruta, despesa com/sem IVA e por identificar, cêntimos, crédito, períodos distintos, stock, edições/remoções, cache e cadeias de retomas.

## Verificações executadas nesta alteração

- CRM: 418 testes; tipos partilhados: 63 testes.
- Backend: suite geral com 693 testes, com cinco falhas numa execução concorrente (timeouts e efeito subsequente). Todos os quatro ficheiros afetados passaram isoladamente: 41 testes. Sem alteração a código de fotografias/contactos.
- Verificação financeira final: 80 testes de domínio, API, cadeia de retomas, propagação e migração.
- Typechecks backend/tipos e Svelte: sem erros; Svelte mantém seis avisos existentes em cinco ficheiros.
- Build de produção do CRM concluído localmente com URLs fictícios de localhost e avisos existentes; não publicado.
- Chrome: seletor de período e saldo credor a 1280 e 390 px. Teste: apps/crm/test/document-vat.browser.mjs (PLAYWRIGHT_CHANNEL=chrome para usar Chrome instalado).
- Exportações: CSV com pagar/deduzir/saldo e aviso de pendências; PDF com página fiscal própria validada.

A base de dados real não foi consultada nem migrada. Confirmar documentos históricos continua a exigir os valores/datas efetivos, através dos formulários existentes.
