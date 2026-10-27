# Criação de viaturas e validação no CRM

## Fluxo

1. «Guardar e continuar» valida a identificação, aquisição e valores e cria uma ficha
   DRAFT, não uma entrada definitiva no stock. O estado pretendido (Disponível,
   Reservado ou Documentos pendentes) segue para o segundo passo.
2. O segundo passo usa o editor de fotos em rascunho, sem uploads ao selecionar.
   Os dois painéis permanecem montados: voltar/avançar preserva os File/blob URLs,
   ordem, principal, autorização de fotos, descrição formatada e restantes campos.
3. O rascunho de recuperação é guardado automaticamente neste dispositivo, sem
   botão manual no segundo passo. «Concluir no CRM» aplica o estado selecionado sem publicar.
   «Concluir e publicar» aplica o estado selecionado e a seleção pública, com
   validações e eventual confirmação explícita para publicação sem fotografias.
4. Os ficheiros são preparados de forma privada com IDs reutilizáveis. O editor
   atómico existente grava dados, ordem, estado e publicação na mesma transação,
   verificando updatedAt. A navegação final só ocorre após sucesso.
5. Rascunhos podem ser retomados através de «Completar ficha» na lista ou detalhe.

O primeiro passo exige matrícula e preços de compra e venda, além dos restantes campos essenciais. O VIN é opcional; quando preenchido, tem de ser válido. A matrícula é formatada ao perder o foco, sem deslocar o cursor durante a edição.
A cópia de recuperação usa IndexedDB, separada por utilizador e viatura, e aceita
campos incompletos e ficheiros locais. Não é uma gravação na base de dados nem uma
sincronização entre dispositivos. O indicador identifica esta distinção. Uma cópia
só fica protegida após a transação terminar; enquanto houver alterações pendentes,
o browser mantém a proteção ao fechar/recarregar. Ao reabrir, recuperam-se campos,
texto rico, ficheiros, ordem, seleção pública e passo. Uma versão atualizada no CRM
não é substituída por uma cópia antiga.

## Validação e mensagens

- Obrigatórios são marcados a partir do atributo required; os campos opcionais de
  características mantêm-se opcionais. A descrição pública só é obrigatória para
  publicar. Texto rico sem conteúdo visível é rejeitado também no backend.
- A validação de viaturas mostra erros na interface em vez de balões nativos,
  com resumo, associação ao campo e foco. Erros de formulários partilhados passam
  a listar as mensagens recebidas mesmo quando não há um controlo correspondente.
- Requisitos de conclusão/publicação aparecem junto das ações; um botão bloqueado
  tem os motivos e ligações para corrigir os campos, incluindo no outro passo.
- A antiga ação ?/webPublication podia perder ?viatura=; o formulário agora envia
  vehicleId como fallback. Um ID da rota tem sempre precedência. Não altera
  autenticação, permissões ou autorização de fotografias no backend.
- O aviso de saída na navegação interna usa ConfirmDialog do CRM. Fechar a aba,
  recarregar ou sair da aplicação continua sujeito ao aviso nativo imposto pelo
  browser; não pode ser substituído de forma fiável por um toast.

## Verificação

Testes cobrem DRAFT na criação inicial, validação dos campos essenciais, intenções
de gravação, perda do identificador na query, precedência do ID da rota e descrição
formatada vazia. A pré-visualização isolada usa os componentes reais com gravações
simuladas e dados fictícios, sem criar viaturas nem publicar no serviço real.
Foram exercitados adicionar foto, alterar anúncio, voltar ao passo um, corrigir
um obrigatório, regressar e concluir; também rascunho, conclusão privada e
bloqueio de descrição vazia. Artefactos de teste ficam fora dos ficheiros de produto.

A linha inteira de um rascunho abre o assistente de conclusão. A criação não apresenta retorno à lista no topo; o segundo passo permite voltar ao primeiro sem perder dados.

## Saída e recuperação automática

A navegação interna aguarda a gravação pendente sem abrir um diálogo. Se falhar,
a janela oferece «Tentar novamente», «Continuar a editar» e «Sair sem guardar».
A última opção conserva a última cópia protegida e descarta apenas as alterações
posteriores. A conclusão explícita elimina a cópia de recuperação depois de o
servidor confirmar o sucesso; uma falha da conclusão mantém a cópia.

Os testes de concorrência cobrem gravações em curso, novas alterações, falhas,
repetição e limpeza. A verificação isolada no browser confirmou recuperação de
campos incompletos, fotografia e autorização pública após recarregar, saída sem
janela quando protegida, opções após falha e conclusão privada sem publicação.

## Feedback de gravação

Criação e edição partilham um indicador com etapas reais: confirmar versão,
preparar fotografias (contador de ficheiros concluídos) e gravar alterações.
Não apresenta percentagens estimadas de compressão. A edição disponibiliza a
mesma ação no topo fixo e no rodapé, com bloqueio durante a gravação.

O sucesso produz uma única notificação com identificação e fotografia da viatura,
ou um ícone quando não há imagem. A publicação tem prioridade sobre a confirmação
interna quando ambas acontecem na mesma ação. URLs locais usadas pela notificação
são independentes da pré-visualização e são libertadas ao desmontar a notificação.
A inicialização do editor de texto já não marca conteúdo equivalente como alterado;
mudanças reais de texto e formatação continuam a contar como alterações.

## Introdução de retomas na venda

O formulário de venda usa a validação partilhada de retomas no browser, na ação
SvelteKit e na API. Para entrada em stock, exige matrícula portuguesa e permite
VIN opcional, validado quando preenchido, em linha com a ficha principal. Marca,
modelo, ano, combustível, quilometragem e valor atribuído continuam necessários.
O combustível exige escolha explícita; quilometragem e valor vazios são rejeitados,
enquanto zero é aceite e valores negativos de retoma são rejeitados.

A retoma entra em DRAFT, com aquisição na data da venda e custo igual ao valor
atribuído. O preço de revenda continua a ser completado posteriormente na ficha,
como no fluxo já existente. Não são exigidas fotografias nem informações do site.
Notas sobre estado/manutenção e as quatro pendências documentais da ficha principal
podem ser recolhidas logo na venda; as pendências são gravadas na viatura criada.
No abate, matrícula/VIN permanecem opcionais e não se cria ficha de stock.

A gravação de venda, retoma e viatura permanece na mesma transação; conflitos de
matrícula/VIN mantêm o formulário preenchido para correção. O botão «Novo cliente»
na venda usa o estilo primário vermelho, conforme pedido do proprietário.

Verificação: testes de schema, ações reais e criação transacional com base simulada;
regressões de anulação e consistência financeira; verificação de tipos do backend e
CRM; formulário real hidratado em Chrome headless a 390 e 1366 px com dados fictícios,
normalização da matrícula, VIN opcional, valor zero, pendências, retenção após falha e
abertura do diálogo de cliente. Não foram usados registos reais nem executadas migrations.
