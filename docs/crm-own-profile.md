# Perfil próprio do CRM

Implementado em `/definicoes`, na secção «O seu perfil». Fotografia, identificação, email, palavra-passe, sessões, eliminação própria e confirmação de identidade usam componentes e tokens Auto Nunes Martins, com os dois temas e disposição mobile. O Clerk continua a ser a autoridade da conta; não existe autenticação paralela nem armazenamento local de palavras-passe.

## Integração e capacidades

- `svelte-clerk@1.1.0`, através de `useClerkContext`. As assinaturas foram verificadas também na árvore própria de dependências desse SDK, diferente da árvore Clerk do backend.
- `user.update`, `setProfileImage({file})`/`file:null`, `updatePassword`, `createEmailAddress`, `EmailAddress.prepareVerification/attemptVerification`, `user.getSessions` e `SessionWithActivities.revoke`. Só operam sobre o utilizador autenticado. A sessão atual não tem botão para se revogar nesta página.
- Campos habilitados/obrigatórios, limites do username e política de palavra-passe vêm do recurso de configuração carregado pelo SDK. O adaptador `accountSettings` isola o getter de leitura `__internal_environment.userSettings`, existente no código oficial Clerk JS mas não incluído na interface pública de `svelte-clerk`. Se faltar, a edição dependente dessa configuração fica indisponível com explicação. Este ponto exige reverificação numa atualização do fornecedor.
- Validação local da política de composição; palavras-passe comprometidas, resistência e disponibilidade de identificadores são sempre decididas pelo Clerk. Não se apresenta uma regra inventada como sendo a política da conta.
- Fotografia: seleção conservadora do CRM (JPEG/PNG/WebP, até 5 MB), descodificação antes da pré-visualização, gravação explícita, retenção na falha e libertação dos object URLs. O fornecedor ainda valida o upload final.
- Email: código apenas se `email_code` estiver habilitado. Adicionar/verificar não substitui silenciosamente o endereço principal. A escolha do principal só aparece para endereços verificados. Reenvio e recuperação de endereços pendentes não criam outro endereço. Configurações exclusivamente por link/SSO usam a alternativa avançada abaixo.
- Contas sem password recebem criação apenas se o atributo estiver habilitado; contas com password desabilitada mostram o fornecedor de acesso em vez de campos sem efeito.

## Confirmação e segurança

O SDK Svelte não exporta `useReverification`. A interface própria trata `session_reverification_required`, inicia `session.startVerification` com o nível indicado (por defeito `multi_factor`) e oferece os fatores devolvidos pelo servidor: password, código email/SMS ou passkey no primeiro fator; SMS, autenticador ou código de recuperação no segundo. Usa `prepare*FactorVerification`/`attempt*FactorVerification` e só repete a operação original depois de `status === complete`. Não há `skip`, chave administrativa ou redução silenciosa de segurança. SSO de reverificação sem fator suportado recebe indicação para iniciar sessão novamente; não se finge conclusão.

O contexto Clerk atualiza fotografia/nome do sidebar. Cada gravação exige também `user.reload` antes do sucesso, seguido de token atualizado e invalidação dos dados do painel. Se a gravação responder mas a nova leitura falhar, a página bloqueia novas alterações e oferece «Confirmar estado da conta», que repete apenas a leitura. Cancelamento da reverificação mantém os campos. As palavras-passe ficam apenas na memória dos campos, são limpas após sucesso/saída/troca de conta e nunca passam pelo sistema de drafts ou logs.

O backend existente continua a receber `user.updated` pelo webhook com assinatura Svix (`backend/src/routes/webhooks/clerk.ts`). A propagação de nome/email/avatar para a tabela local depende desse webhook estar configurado e ser entregue; invalidar a página não substitui o webhook. Não foram alterados o backend, as configurações do fornecedor, a BD ou ficheiros de ambiente nesta entrega.

## Limite explícito de interface

A experiência principal não monta `<UserProfile>`. O botão genérico foi substituído por acessos descritivos apenas quando a configuração/recursos confirmam capacidades adicionais (MFA, chaves de acesso, telefones, contas associadas ou email sem código). Usam a área Clerk adequada: segurança para MFA/passkeys e conta para email/telefones/associações. Sem capacidades adicionais não há botão redundante. A gestão avançada continua no fornecedor; a interface própria mantém as operações normais e a reverificação.

Fotografia e identificação partilham um painel compacto, com fotografia de 72 px e formulários separados; email e sessões formam uma coluna contínua junto da palavra-passe. O portal Clerk usa `getContainer` suportado. O hook oficial de scroll lock acrescenta `innerWidth-clientWidth` ao padding do body; o CRM já reserva esse espaço com `scrollbar-gutter:stable`, causando reserva dupla. A compensação é anulada apenas enquanto o portal próprio está aberto, preservando o padding anterior e o scroll lock/foco do fornecedor. Ao fechar, scroll e foco regressam sem animação de scroll. Não há seleção de classes internas Clerk nem alteração da segurança.

## Eliminar a própria conta

A secção separada exige escrever ELIMINAR e reconhecer a perda de acesso nas aplicações e no ambiente de teste que partilham a instância. `user.deleteSelfEnabled` e, quando disponível, `actions.delete_self` condicionam a disponibilidade; a página não altera configuração nem contorna restrições. Usa apenas `user.delete()` do SDK sobre a identidade/sessão capturada, verificando-as antes da ação e de qualquer repetição por reverificação. O diálogo usa a mesma confirmação própria de identidade/MFA. Uma mudança de conta cancela a confirmação pendente. Não há campo para outro ID, endpoint administrativo nem cascata de dados empresariais.

Só a resolução confirmada de `user.delete()` anuncia eliminação. O SDK emite UserSignOut; a sessão capturada é terminada se ainda estiver ativa, a cache local é limpa e segue-se a página de entrada. Uma resposta de rede incerta nunca repete a mutação automaticamente: oferece uma leitura de confirmação; falha de leitura/401 não é prova de eliminação. Uma leitura bem-sucedida da mesma conta permite nova decisão explícita. Erros do fornecedor preservam a confirmação para corrigir/repetir ou cancelar.

Auditoria backend: `user.deleted` assinado chama o ciclo de desativação existente. O tombstone, a desativação e a libertação das tarefas pendentes são transacionais e preservam utilizador/referências/histórico; eventos atrasados e provisionamento não ressuscitam a identidade. Os testes existentes de webhook/lifecycle foram executados com mocks, sem webhook ou BD real. A entrega do webhook continua necessária para a propagação local. Não foi eliminada nenhuma conta real.


## Verificação

`src/lib/account/profile.test.ts`: política real configurável, formatos/tamanho de fotografia, campos/erros traduzidos sem mensagens sensíveis e exigência de reverificação. `test/account-profile.browser.mjs` + fixture SDK isolada: página e sidebar reais, endpoints Clerk fictícios, sem emails enviados nem alterações a contas reais. Executar `npm run test:account-browser` no CRM; usa Chrome instalado por defeito.

Os cenários cobrem desktop/mobile, claro/escuro, bloqueio durante gravação, confirmação após API/leitura, username ocupado, erros com links para campos, password atual errada, confirmação/política, fotografia inválida/grande/corrompida/pré-visualização/falha/repetição/remoção, email/código/principal, reverificação com dois fatores/cancelamento, sessões e OAuth sem password. Também verificam que repetir a leitura de confirmação não repete a mutação. O teste com SDK fictício não prova integração end-to-end com uma conta Clerk real, emails reais, políticas remotas ou entrega do webhook. Essa limitação é deliberada; nenhuma conta real foi modificada na validação.

Fontes primárias consultadas: [User](https://clerk.com/docs/js-frontend/reference/objects/user), [Session](https://clerk.com/docs/js-frontend/reference/objects/session), [alteração de password](https://clerk.com/docs/guides/development/custom-flows/account-updates/update-password), [reverificação](https://clerk.com/docs/guides/secure/reverification), [implementação oficial Clerk JS](https://github.com/clerk/javascript/blob/main/packages/clerk-js/src/core/clerk.ts) e declarações do SDK instalado. Para o modal, foi inspecionado também o [hook oficial useScrollLock](https://github.com/clerk/javascript/blob/main/packages/ui/src/hooks/useScrollLock.ts).


Validação da revisão local: 17 testes unitários de política/capacidades e 14 cenários Chrome de perfil, layout/modal e eliminação simulada. Inclui estados permitidos/desabilitados, cancelamento, troca de identidade, erro do fornecedor, MFA, resultado incerto sem repetição automática, limpeza de sessão e redirecionamento. O teste do modal reproduz o scroll lock do código oficial, mede geometria antes/durante/depois e demonstra a reserva dupla ao desligar a correção no fixture. Não é uma validação com conta Clerk real.
