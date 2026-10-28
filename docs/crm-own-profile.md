# Perfil próprio do CRM

Implementado em `/definicoes`, na secção «O seu perfil». Fotografia, identificação, email, palavra-passe, sessões e confirmação de identidade usam componentes e tokens Auto Nunes Martins, com os dois temas e disposição mobile. O Clerk continua a ser a autoridade da conta; não existe autenticação paralela nem armazenamento local de palavras-passe.

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

A experiência principal já não monta `<UserProfile>`. Para preservar capacidades anteriormente disponíveis, «Opções avançadas de segurança» abre, por escolha explícita, a página de segurança do fornecedor (`openUserProfile`, `__experimental_startPath:'/security'`, API keys ocultas). Configuração de MFA, chaves de acesso, telefones e contas associadas continua nessa interface Clerk. A página própria implementa a reverificação/MFA necessária às suas operações e a gestão de sessões, mas não recria todos os fluxos de configuração avançada. Esta alternativa não deve ser descrita como uma substituição integral de todas as interfaces Clerk.

## Verificação

`src/lib/account/profile.test.ts`: política real configurável, formatos/tamanho de fotografia, campos/erros traduzidos sem mensagens sensíveis e exigência de reverificação. `test/account-profile.browser.mjs` + fixture SDK isolada: página e sidebar reais, endpoints Clerk fictícios, sem emails enviados nem alterações a contas reais. Executar `npm run test:account-browser` no CRM; usa Chrome instalado por defeito.

Os cenários cobrem desktop/mobile, claro/escuro, bloqueio durante gravação, confirmação após API/leitura, username ocupado, erros com links para campos, password atual errada, confirmação/política, fotografia inválida/grande/corrompida/pré-visualização/falha/repetição/remoção, email/código/principal, reverificação com dois fatores/cancelamento, sessões e OAuth sem password. Também verificam que repetir a leitura de confirmação não repete a mutação. O teste com SDK fictício não prova integração end-to-end com uma conta Clerk real, emails reais, políticas remotas ou entrega do webhook. Essa limitação é deliberada; nenhuma conta real foi modificada na validação.

Fontes primárias consultadas: [User](https://clerk.com/docs/js-frontend/reference/objects/user), [Session](https://clerk.com/docs/js-frontend/reference/objects/session), [alteração de password](https://clerk.com/docs/guides/development/custom-flows/account-updates/update-password), [reverificação](https://clerk.com/docs/guides/secure/reverification), [implementação oficial Clerk JS](https://github.com/clerk/javascript/blob/main/packages/clerk-js/src/core/clerk.ts) e declarações do SDK instalado.
