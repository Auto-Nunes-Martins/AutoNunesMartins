# CRM: revisão da sessão e recuperação

Revisão de código e verificações locais em 21 de outubro de 2026. Não foram alteradas contas, sessões reais, credenciais ou definições do serviço Clerk.

## Evidência e diagnóstico

O CRM utiliza `svelte-clerk` 1.1.0 e o backend Express valida a sessão com Clerk. O SDK do browser renova o JWT de sessão de curta duração. No SDK de servidor instalado, `locals.auth().getToken()` sem opções devolve o JWT recebido nesse pedido; chamar novamente esse método não força uma renovação.

Existiam caminhos compatíveis com o sintoma de continuar dentro do CRM e perder acesso aos dados após inatividade:

- Não havia coordenação de renovação ao regressar à tab, recuperar a ligação ou navegar depois de inatividade. O preload de dados no hover podia iniciar o pedido antes de qualquer validação da navegação.
- O relay reenviava o token recebido sem tratar a expiração entre os dois servidores. Os pedidos sem sessão para endpoints JSON eram redirecionados para a página de login.
- O inventário e os rascunhos convertiam falhas em resultados com total zero. A página mostrava zero no inventário e escondia a falha dos rascunhos. A atividade e a timeline de vendas ocultavam falhas como listas vazias; o layout interpretava403 como provisionamento pendente.
- O tratamento de erros não JSON tentava consumir o mesmo corpo duas vezes, podendo perder o estado HTTP original.
- A configuração Pino não redigia os cabeçalhos de autenticação incluídos pelos logs HTTP.

Estes caminhos foram reproduzidos com respostas e sessões simuladas. Não existem nesta revisão registos do incidente original que permitam atribuir uma causa única ao ocorrido na conta real.

## Alterações

- Renovação através do SDK Clerk, deduplicada no browser e isolada por pedido no servidor. No servidor, um JWT quase expirado é renovado com a opção suportada `expiresInSeconds: 60`; uma leitura rejeitada com401 admite uma única nova tentativa. Não são criados refresh tokens próprios, nem guardados tokens no armazenamento do CRM.
- Navegação após inatividade espera pela renovação. Falhas mantêm a página atual e apresentam recuperação. O regresso à tab e a recuperação da rede revalidam páginas de consulta, preservando formulários com alterações e páginas de edição. O preload de código continua ativo; o preload antecipado de dados privados foi desligado.
- Pedidos explícitos dos componentes e submissões de formulários validam primeiro a sessão. Escritas e uploads nunca são repetidos automaticamente. Um401 durante uma submissão mantém os campos e passa a ser uma falha recuperável do formulário.
- Tokens ou respostas concluídos após mudança da sessão são descartados. O helper do browser limita pedidos autenticados ao próprio CRM; o relay do servidor omite cookies e não segue redirecionamentos para outros destinos.
- Endpoints JSON e ações com sessão inválida devolvem401 explícito; navegação de documento continua protegida pelo fluxo Clerk.401,403 e falhas de serviço deixam de ser apresentados como ausência de dados nos caminhos corrigidos. Os erros oferecem nova tentativa e, quando necessário, login noutra janela.
- Authorization, Cookie e Set-Cookie são redigidos nos logs HTTP.

## Verificação e limites

Os testes cobrem renovação deduplicada, expiração entre CRM/API,401 persistente,403 sem repetição, falta de sessão, falha de rede, timeout, cancelamento, mudança de conta durante um pedido, isolamento entre utilizadores, preservação dos formulários, ausência de repetição de escritas, falhas parciais de inventário/rascunhos e redação dos logs. Os scripts `scripts/check-crm-auth-entry.mjs` e `scripts/check-crm-session-recovery.mjs` exercitam os componentes reais com navegação/sessão simuladas, sem credenciais nem alterações de dados reais.

`requireUser` continua a provisionar uma conta ADMIN para qualquer utilizador autenticado na instância Clerk, conforme a política existente. A restrição de criação de contas/convites depende das definições externas dessa instância. Esta revisão não confirma que o registo público esteja desativado, quais os utilizadores convidados, a política de MFA, a duração máxima das sessões ou a política de inatividade; esses pontos não podem ser deduzidos de testes locais e não foram alterados.

Referências: [renovação da sessão Clerk](https://clerk.com/docs/guides/sessions/force-token-refresh), [objeto Session e getToken](https://clerk.com/docs/js-frontend/reference/objects/session), [objeto Auth do servidor](https://clerk.com/docs/reference/backend/types/auth-object), [pedidos autenticados](https://clerk.com/docs/guides/development/making-requests). O comportamento foi também confirmado no código das dependências instaladas.
