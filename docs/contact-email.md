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

### Identificação do visitante no serviço conjunto — 20 de outubro de 2026

Foi corrigida a perda do endereço do visitante no salto gateway → website. No runtime público Render (`RENDER=true` e `RENDER_SERVICE_TYPE=web`, variáveis fornecidas pela plataforma), o gateway aceita exclusivamente o endereço único de `CF-Connecting-IP`. A [documentação oficial da Render](https://render.com/articles/host-pocketbase-on-render#making-pocketbase-see-the-real-client-ip) confirma que o ingresso Cloudflare substitui este cabeçalho, enquanto um prefixo de `X-Forwarded-For` pode ser escolhido pelo visitante. Não se usam o primeiro IP de XFF, contagens de proxies adivinhadas ou ranges de saída da Render.

O gateway substitui sempre o cabeçalho interno `x-anm-client-address`, ignorando uma cópia enviada pelo visitante. O launcher fixa `ADDRESS_HEADER=x-anm-client-address` **apenas no website**, ligado a `127.0.0.1`. O relay valida esse endereço e envia ao backend somente o identificador HMAC existente. IPv6 equivalente e IPv4 mapeado são normalizados para não gerar contadores diferentes. O CRM não recebe um novo cabeçalho de endereço nem altera autenticação, cache ou configuração do seu adapter.

Fora da Render usa-se apenas o endereço do socket; mesmo um cabeçalho Cloudflare é ignorado. Não definir `RENDER=true` manualmente num servidor diretamente acessível: a confiança pressupõe o ingresso público Render/Cloudflare documentado, sem caminhos alternativos a partir de redes não fiáveis. Não expor os listeners internos. Outros proxies/alojamentos precisam de uma decisão de confiança própria, não de copiar este modo. No modo Render, se o cabeçalho estiver ausente, duplicado, inválido ou contiver uma lista, o envio responde 503 sem chegar ao prestador; as páginas normais continuam acessíveis. Não há fallback para o IP comum do proxy.

Validação local reproduzível: `node --test deployment/*.test.mjs` e `npm exec --workspace @anm/website -- vitest run src/routes/api/contact/contactGateway.test.ts src/routes/api/contact/contactEndpoint.test.ts`. Os testes usam sockets HTTP reais no gateway, relay e limiter backend, uma fronteira adapter simulada e um prestador de email simulado. Verificam dois visitantes independentes, sexto pedido bloqueado, renovação da janela de dez minutos, teto global de 80, cabeçalhos forjados, endereços IPv4/IPv6 e ativação bloqueada. Não foram enviados emails reais nem alteradas flags, dados de privacidade ou credenciais.

Antes de ativar envios em produção, confirmar a versão implantada e a chegada do cabeçalho do ingresso no domínio final, sem publicar/logar IPs. Repetir duas origens independentes e a tentativa de forjar cabeçalhos num ambiente de teste com prestador simulado; confirmar que cinco tentativas da primeira não bloqueiam a segunda. A simulação local não comprova a configuração da infraestrutura implantada. Os limites continuam em memória e por processo: redes com o mesmo IP partilham limite, reinícios limpam contadores e réplicas não os partilham. Não foi acrescentado CAPTCHA nem serviço externo.

## Validação

Testes com envio simulado verificam destinatário fixo, reply-to, rejeição de injeções/campos extra, configuração em falta, erros do prestador, idempotência e limite de tentativas. O envio real exige credenciais e receção confirmada, ainda pendentes.

Verificação local: 119 testes do backend aprovados; 333 testes existentes do website e quatro testes novos do relay aprovados. TypeScript do backend e Svelte check sem erros; Svelte sem avisos. O lint dos restantes ficheiros alterados passou; `DesignEdition.svelte` conserva 11 erros preexistentes, confirmados também na versão HEAD. O build compilou os bundles do cliente e servidor, incluindo o endpoint, mas a adaptação Vercel falhou novamente com `EPERM` ao criar um symlink no Windows. Não foi validado um artefacto final de publicação.

## Apresentação visual — 15 de outubro de 2026

O email interno usa a identidade já existente do projeto (vermelho, cabeçalho escuro e tipografia de sistema), com assunto, nome/email, mensagem e referência à página/viatura. O botão de resposta usa apenas mailto; o reply-to do pedido Resend mantém o visitante. A referência é apresentada como caminho, sem inventar domínio público. Não há imagens remotas, trackers ou dependências localhost. Os estilos essenciais são inline e a estrutura usa tabelas de apresentação com suporte Outlook e largura fluida.

Todos os campos do visitante são escapados; quebras de linha viram br sem interpretar HTML. Mantêm-se remetente/destinatário/assunto, texto simples, chave de idempotência e todos os gates existentes. Remetente e restantes credenciais continuam por configurar, sem bloquear a preparação do template. O HTML é entregue ao prestador como campo html; o destinatário vê a apresentação visual no cliente de email.

Prévia exclusivamente fictícia: [HTML](previews/contact-email.html), [desktop](previews/contact-email-desktop.png), [mobile](previews/contact-email-mobile.png). Gerar novamente com node --import tsx backend/scripts/preview-contact-email.ts. Inspeção visual no Chrome headless, 900 px e 375 px, sem overflow horizontal; oito testes de template/endpoint com envio simulado passaram. Compatibilidade nos clientes Gmail/Outlook/Apple Mail reais e entrega efetiva continuam por validar. Nenhum email real foi enviado e CONTACT_ENABLED não foi ativado.
