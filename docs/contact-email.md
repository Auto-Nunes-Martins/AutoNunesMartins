# Pedidos de contacto por email

Implementado em 10 de outubro de 2026. O envio está desativado por omissão; faltam os dados oficiais e a configuração do serviço. Não houve envio real nem aprovação de publicação.

## Funcionamento

Os formulários públicos (modal, formulário inferior e variantes do formulário inferior) enviam JSON ao endpoint SvelteKit `/api/contact`. Este verifica a origem e limita o corpo a 16 KiB. Encaminha para `/api/public/contact` no backend Express com um segredo privado partilhado. O visitante nunca recebe esse segredo nem a chave Resend. As páginas de demonstração conservam o comportamento demonstrativo do seu modal.

O backend valida e limita os campos, rejeita campos extra e o campo anti-bot preenchido, aplica limites e envia um email HTML com alternativa de texto simples pelo Resend. O destinatário e remetente são definidos no servidor, com o email do visitante em `reply_to`. Só responde 202 após a API Resend aceitar o pedido e devolver um identificador. Isto não comprova entrega na caixa de entrada. Uma visita só é confirmada pelo stand depois de acordar o horário.

Não são criados clientes, pedidos em base de dados, subscrições de marketing ou emails automáticos ao visitante. Não há anexos. O caminho da página ajuda a identificar a ficha; não enviamos parâmetros de pesquisa nem URLs completos. Em falha, o formulário mantém os dados para nova tentativa. Repetir o mesmo conteúdo utiliza a mesma chave de idempotência enquanto o formulário permanecer aberto.

## Configuração para ativação

1. Criar conta Resend e verificar o domínio remetente (DNS indicado pelo serviço). Desativar tracking de aberturas e cliques, que este fluxo não necessita.
2. No backend, configurar `RESEND_API_KEY`, `CONTACT_FROM_EMAIL` (endereço simples no domínio verificado), `CONTACT_TO_EMAIL` e `CONTACT_RELAY_SECRET` aleatório com pelo menos 32 caracteres. Manter estes valores fora do Git e do browser.
3. No servidor do website, configurar o mesmo `CONTACT_RELAY_SECRET`. O backend e website precisam de ligação HTTPS em produção. Não ativar login público no Clerk do CRM como parte deste trabalho.
4. Preencher todos os campos `privacy` de `publicationReadiness.json` com dados confirmados: responsável e contacto, finalidade/fundamento, prestadores e transferências efetivos, conservação da caixa de email e backups. Registar evidência em `publication-readiness.md`. Confirmar também os dados do operador e contactos oficiais em `standContact.ts`.
5. Verificar o DPA do Resend, subcontratantes, mecanismos de transferência e prestadores de alojamento e caixa de correio. Resend publica o DPA em https://resend.com/legal/dpa e informação RGPD em https://resend.com/security/gdpr. A responsabilidade de verificar o enquadramento final cabe à empresa.
6. Só então definir `CONTACT_PRIVACY_READY=true` no website e `CONTACT_ENABLED=true` no backend. Reiniciar/republicar ambos. Fazer um envio controlado e confirmar a receção na caixa real e o funcionamento de “Responder”.

Não basta ativar as flags: elas representam a confirmação operacional do proprietário, não uma certificação. Os campos pendentes não foram inventados. Não se exige consentimento genérico nem aceitar termos para enviar um pedido; o fundamento de cada finalidade precisa de confirmação. Marketing permanece fora deste fluxo.

## Segurança e operação

Limites por processo: cinco tentativas por identificador derivado do IP em dez minutos e 80 tentativas em 24 horas por backend. Contadores em memória sem conteúdo do pedido; o HMAC deriva um identificador pseudónimo da identificação enviada pelo website. Não são partilhados entre réplicas e reiniciar limpa os contadores: para múltiplas instâncias é necessário um limite distribuído ou de gateway. Configurar o endereço do cliente apenas com cabeçalhos de proxy fiáveis no alojamento SvelteKit, nunca aceitar um IP arbitrário vindo do browser. Estes limites não substituem proteção do alojamento contra abuso.

O endpoint de contacto passa antes do logger de pedidos. Erros de parsing não são enviados ao logger. Rever também logs do alojamento, proxy e prestador, sem registar corpos, credenciais ou emails dos visitantes. A caixa de correio contém dados pessoais: restringir acesso, aplicar o prazo acordado e definir recuperação e eliminação de backups. O plano gratuito tem limites e não garante disponibilidade ilimitada. Não ativar cobrança de excedentes sem decisão do proprietário.

## Validação

Testes com envio simulado verificam destinatário fixo, reply-to, rejeição de injeções/campos extra, configuração em falta, erros do prestador, idempotência e limite de tentativas. O envio real exige credenciais e receção confirmada, ainda pendentes.

Verificação local: 119 testes do backend aprovados; 333 testes existentes do website e quatro testes novos do relay aprovados. TypeScript do backend e Svelte check sem erros; Svelte sem avisos. O lint dos restantes ficheiros alterados passou; `DesignEdition.svelte` conserva 11 erros preexistentes, confirmados também na versão HEAD. O build compilou os bundles do cliente e servidor, incluindo o endpoint, mas a adaptação Vercel falhou novamente com `EPERM` ao criar um symlink no Windows. Não foi validado um artefacto final de publicação.

## Apresentação visual — 15 de outubro de 2026

O email interno usa a identidade já existente do projeto (vermelho, cabeçalho escuro e tipografia de sistema), com assunto, nome/email, mensagem e referência à página/viatura. O botão de resposta usa apenas mailto; o reply-to do pedido Resend mantém o visitante. A referência é apresentada como caminho, sem inventar domínio público. Não há imagens remotas, trackers ou dependências localhost. Os estilos essenciais são inline e a estrutura usa tabelas de apresentação com suporte Outlook e largura fluida.

Todos os campos do visitante são escapados; quebras de linha viram br sem interpretar HTML. Mantêm-se remetente/destinatário/assunto, texto simples, chave de idempotência e todos os gates existentes. Remetente e restantes credenciais continuam por configurar, sem bloquear a preparação do template. O HTML é entregue ao prestador como campo html; o destinatário vê a apresentação visual no cliente de email.

Prévia exclusivamente fictícia: [HTML](previews/contact-email.html), [desktop](previews/contact-email-desktop.png), [mobile](previews/contact-email-mobile.png). Gerar novamente com node --import tsx backend/scripts/preview-contact-email.ts. Inspeção visual no Chrome headless, 900 px e 375 px, sem overflow horizontal; oito testes de template/endpoint com envio simulado passaram. Compatibilidade nos clientes Gmail/Outlook/Apple Mail reais e entrega efetiva continuam por validar. Nenhum email real foi enviado e CONTACT_ENABLED não foi ativado.
