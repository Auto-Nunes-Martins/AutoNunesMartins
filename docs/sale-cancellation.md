# Anular negócios e corrigir vendas no CRM

O detalhe apresenta apenas o botão «Anular ou corrigir». Abre um modal fechado por
defeito, com uma decisão por etapa: o que aconteceu, destino da viatura quando
necessário, custo/data apenas para a compra mantida, e resumo final. Fechar e
voltar conserva os campos; erros e revisão ficam dentro do modal, sem o reabrir
automaticamente ao carregar a página. Escape, foco e navegação por teclado seguem
o padrão de dialog nativo do CRM.

«Quero desfazer o negócio» mantém a venda anulada no histórico; «Registei esta venda
por engano» elimina só o registo errado. Apresentam-se apenas destinos válidos.
Uma ação indisponível tem o motivo junto da alternativa disponível, sem uma grelha
de escolhas desativadas. A cadeia detalhada e IVA/lucro estão em detalhes
recolhidos. O motivo é gerado a partir da escolha explícita, com nota opcional.
As escolhas não executam pagamentos, não calculam reembolsos e não regularizam
documentos ou crédito automaticamente.

## Viatura original e destino da retoma

- A anulação liberta a ligação ativa da venda e repõe a original em `AVAILABLE`,
  sem data de venda nem publicação automática no site. A venda anulada continua no
  histórico do cliente, fora dos indicadores e exportações de vendas ativas.
- «Devolver ao cliente» põe a retoma em `RETURNED`, fora do stock e do site,
  preservando ficha, custo, despesas e documentação. Não pode ser escolhida se
  existir uma venda posterior ativa da retoma.
- «Manter no stand como compra normal» confirma custo e data de entrada nos campos
  normais de `Vehicle`. Mantém o estado atual, incluindo reserva, rascunho ou
  entrega/venda já realizada. Conserva despesas, fotografias e documentos, sem
  publicar automaticamente.
- Ao manter, é eliminado **apenas o registo TradeIn de origem** desta venda. A ficha
  fica sem `sourceTradeIn`, cliente de aquisição ou indicação de origem antiga de
  retoma. A marca de origem na atividade de entrada da viatura e o evento de receção
  desta venda são normalizados, conservando os identificadores, autores e datas dos
  eventos. A nota automática «Retoma da venda …», quando ainda intacta, é removida; notas preenchidas pelo utilizador mantêm-se. Não se cria arquivo de origem, TradeIn órfão nem modelo de aquisição
  paralelo. O snapshot novo da anulação não conserva a retoma mantida.
- Retomas para abate/saída sem stock, ficha em falta ou estado inconsistente exigem
  regularização factual. O CRM explica o impedimento; não presume uma devolução ou
  compra de uma viatura que não está disponível.

## Cadeia A → B → C → D

Se A recebeu B, B foi vendida recebendo C e C originou D, anular A **não exige anular
as vendas seguintes**. A opção devolver/apagar B fica indisponível; é possível
mantê-la como compra normal. A confirmação pede apenas custo e data de entrada de B.
A data não pode ser futura nem posterior à venda de B.

A venda válida de B mantém preço, cliente, comissão, regime fiscal, data e entrega.
O novo custo de B recalcula só o IVA e lucro dessa venda, incluindo as despesas
existentes. A ligação da venda de B à retoma C mantém-se. Viaturas C/D, seus valores
de entrada, despesas, vendas e entregas não são reescritos. O resumo apresenta as
viaturas seguintes e o que fica preservado, incluindo a aquisição das seguintes.

## Eliminar um registo errado

A eliminação de A não é permitida se a própria A tem entrega registada, venda
posterior ou despesas registadas depois da venda. O motivo é mostrado no modal,
com a alternativa de anular. Movimentos de B protegem B, sem bloquear globalmente
a correção de A: A pode ser eliminada mantendo B como compra normal, mesmo quando
B já tem despesas, alterações ou uma venda posterior. Essa venda e C/D são
preservadas; nunca é necessário eliminar B para corrigir A.

Para uma venda elegível, o utilizador escolhe o destino da retoma:
compra normal, devolução, ou eliminar também a ficha criada por engano. Apagar a
ficha exige ausência de vendas (incluindo históricas), despesas, alterações,
fotografias e publicação, e uma ficha ainda em rascunho (ou devolvida pela própria
anulação). O servidor repete estas verificações dentro da transação.

O resumo enumera o que será eliminado e preservado, seguido de uma única ação
explícita «Eliminar esta venda» ou «Eliminar venda e ficha erradas». Não é preciso
digitar uma palavra ou marcar outra checkbox. Apenas esse formulário final envia
os acknowledgements que a API continua a exigir (`confirmed` e `ELIMINAR`), além
do token da revisão. A eliminação liberta primeiro a venda ativa,
remove o recibo de retoma quando necessário e elimina só a venda pedida e a ficha
vazia explicitamente escolhida. Não elimina clientes, despesas ou outras vendas.
Uma venda anteriormente anulada pode ser eliminada apenas se continuar elegível;
o estado atual das viaturas e a decisão já concluída não são reescritos.

## Integridade, permissões e concorrência

Usa os endpoints autenticados existentes, para os utilizadores ADMIN do CRM. Não
altera autenticação nem contas. A confirmação é assinada por HMAC e inclui a
operação, decisão, dados revistos e dependências apresentadas. Alterações relevantes
invalidam a revisão. A transação `Serializable` bloqueia original e retoma por ordem
de ID, nas mesmas linhas usadas por vendas/edições/despesas. Falhas financeiras,
restrições de relações ou falhas de atividade fazem rollback. Conflitos pedem nova
revisão. A mesma confirmação pode ser repetida sem repetir efeitos, incluindo após
eliminação.

Os campos normais de atividade registam motivo, confirmação e correções de valores,
sem criar nova origem de retoma para a viatura mantida. As caches de indicadores,
notificações e pesquisa são invalidadas depois do commit; listas usam a revisão dos
registos atuais. As restrições de relações existentes continuam a proteger vendas
posteriores: não se adiciona eliminação automática em cadeia.

**Não é necessária migração nova.** Mantém-se o esquema existente: `TradeIn.saleId`
é obrigatório e os recibos de origem são explicitamente eliminados na transação,
enquanto `Vehicle` e as vendas seguintes permanecem. A migration original de
anulação (`20261014120000_preserve_cancelled_sales`) continua a ser requisito já
existente para o código de anulação.

## Verificação local

Testes de serviço cobrem cadeias de uma e várias retomas, particular/comerciante,
custo de entrada, estado e entrega preservados, ausência de ligação/origem antiga,
proteção de despesas e fotografias, eliminação explícita, repetição idempotente,
revisão desatualizada, conflitos e rollback. Testes das ações reais verificam os
campos enviados, acknowledgements de confirmação, validação de datas e redirecionamento.

PostgreSQL isolado em memória (PGlite), com as migrations existentes, verifica
remoção de A→B sem tocar em B→C, proteção de vendas por FK, impossibilidade de
recibos órfãos e rollback conjunto de custo, métricas e relações. Os testes HTTP
usam apenas localhost e base simulada. O formulário real hidratado é exercitado em
Chrome headless a 390 e 1366 px, com dados fictícios: fechado ao carregar, etapas,
foco/Escape, campos preservados, erros, devolução, correção e bloqueios por entidade.
Os testes de conflito simulam
a resposta de serialização; não constituem um ensaio de carga PostgreSQL com duas
ligações reais.

Nenhuma destas verificações executa resets, migrations ou alterações em dados reais.

## Histórico técnico da migration original (outubro de 2026)

Fonte: `backend/prisma/migrations/20261014120000_preserve_cancelled_sales/migration.sql`.

Antes de disponibilizar este fluxo numa instalação real, executar a migration pelo processo normal do projecto e gerar o cliente Prisma para o esquema novo. A migration preenche `originalVehicleId` nas vendas existentes, permite libertar apenas a ligação activa, acrescenta o estado `RETURNED`, os campos de anulação, as restrições históricas e a protecção do stock devolvido.

O backend anterior não preenche `originalVehicleId`. A aplicação da migration e a actualização do backend precisam de uma transição coordenada, sem deixar o backend anterior a criar vendas no intervalo. A prontidão legal/dados do website permanece sujeita ao checklist de publicação existente.

Em 15 de outubro de 2026, a migration foi aplicada à base configurada no backend local para reparar os erros de consulta causados pelo código novo sem o esquema correspondente. O backend foi parado durante a transição e reiniciado em seguida. A comparação antes/depois confirmou preservação dos dados existentes: 19 vendas, 2 retomas, 34 viaturas e 117 despesas; o preenchimento de `originalVehicleId` ficou consistente em todas as vendas. As consultas de stock, vendas, clientes, utilizadores e tarefas voltaram a passar. A importação posterior dos cinco exemplos da homepage é uma operação separada, pedida explicitamente pelo proprietário. Não houve deploy ou push.
