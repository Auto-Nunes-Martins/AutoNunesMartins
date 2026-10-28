# Preparação para publicação — PENDENTE

Atualizado em 28 de outubro de 2026. Os contactos comerciais, a localização, a equipa e as redes sociais foram fornecidos e confirmados pelo proprietário. Os restantes dados oficiais mantêm placeholders. O site **não está pronto para publicação enquanto persistirem estas pendências**. A existência das páginas legais não significa que estejam completas ou juridicamente validadas.

Antes de responder a «está pronto para publicar?», consultar este documento, a configuração e a implementação corrente. Não assumir que uma revisão anterior concluiu a prontidão. Registar aqui evidência e data de cada confirmação; não inferir dados de concorrentes.

## Fontes de estado

- Campos públicos: `apps/website/src/lib/publicationReadiness.json`. `null` é apresentado como «Por preencher / Por confirmar antes da publicação». Não incluir segredos ou documentos pessoais neste ficheiro público.
- Contactos da interface: `apps/website/src/lib/components/stand-concepts/standContact.ts`, atualmente `isDemo: false`; WhatsApp ativo com o número principal confirmado, sem número fictício.
- Informação legal: `/informacao-legal`; privacidade: `/politica-de-privacidade`.
- Verificação manual na raiz: `node scripts/check-publication-readiness.mjs`, ou `npm run publication:check --workspace @anm/website`. Código 1 assinala pendências; código 0 significa apenas ausência de pendências registadas, nunca certificação. Não é executada pelo dev/build/deploy.

## Dados e decisões do proprietário

| Estado                   | Necessário                                                                        | Responsável / evidência esperada                                                                                                                                                             |
| ------------------------ | --------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pendente                 | Nome legal, forma jurídica, NIF/NIPC e sede                                       | Proprietário: dados oficiais do operador                                                                                                                                                     |
| Pendente                 | Registo comercial/conservatória e capital social, quando aplicáveis               | Proprietário: confirmar dados ou indicar «Não aplicável» com justificação nesta checklist                                                                                                    |
| Confirmado em 25/10/2026 | Telefones, email comercial, duas moradas, horários, equipa e redes sociais        | Dados fornecidos pelo proprietário e autorização direta neste chat: «Sim, são oficiais e autorizo aplicar». Mapas usam pesquisa das moradas, sem coordenadas ou números de porta inventados. |
| Confirmado em 25/10/2026 | Número oficial de WhatsApp                                                        | Proprietário confirmou que é o mesmo número principal: +351 964 243 323. Evidência: mensagem de voz 01a174c2-7b46-7642-9271-461d7eb22a54 do chat 01a17464-70e7-7a03-9873-a14f9d3c255a.       |
| Pendente                 | Entidade RAL competente, contactos, site e eventual adesão                        | Proprietário/revisão jurídica: confirmar aplicabilidade e situação atual; não presumir adesão                                                                                                |
| Pendente                 | Livro de Reclamações Eletrónico                                                   | Proprietário: confirmar registo e ligação aplicável; o portal geral no site não comprova registo                                                                                             |
| Pendente                 | Responsável pelo tratamento e contacto de privacidade                             | Proprietário: dados e contacto utilizável                                                                                                                                                    |
| Pendente                 | Finalidades/fundamentos, prestadores, destinatários, transferências e conservação | Proprietário + responsável pela implementação: refletir os serviços realmente escolhidos, não textos genéricos copiados                                                                      |

Não copiar referências CASA ou ODR do concorrente. Confirmar entidades e mecanismos atuais nas fontes oficiais durante a revisão jurídica. Crédito não faz parte do âmbito atual do website, conforme confirmação explícita do utilizador em 4 de outubro de 2026: não há secção pública nem pendência de intermediação de crédito.

## Funcionalidades e dados — revisão operacional

- **Formulários de contacto — auditoria de 28/10/2026:** o código encaminha pedidos por Resend quando as credenciais e o interruptor backend estão configurados. Os campos pendentes de publicationReadiness.json NÃO são um bloqueio de runtime: contactEndpoint.test.ts confirma encaminhamento com metadados de privacidade pendentes. Não se infere configuração ou funcionamento de produção desta auditoria. Não são criadas contas/fichas de cliente nem guardados corpos/email no CRM por este fluxo; após aceite, há notificação com nome, assunto, hora/identificador e leitura individual. Metadados HMAC de tentativa têm expiração de 35 dias e limpeza limitada nos pedidos seguintes; avisos/leituras/caixa de email/backups têm conservação por confirmar. A UI de sucesso verde confirma aceite pelo serviço, não entrega final. Privacidade, fundamentos, prestadores e operação final continuam pendentes; não foram alterados gates nem realizados envios reais. Consulte docs/legal-review-2026-10-28.md e docs/contact-email.md.

- **Contactos oficiais — 25/10/2026:** aplicados em `standContact.ts`, equipa e interface. Substituídos os dados fictícios de Lisboa e os emails `.example`; mapas pesquisam as duas moradas em Castelo Branco. WhatsApp fictício removido; o proprietário confirmou posteriormente o número principal também para WhatsApp, ativando a ligação oficial. A confirmação de contactos comerciais não confirma sede legal, responsável pelo tratamento, contacto específico de privacidade ou envio real de formulários.
- **Preferências locais:** preservar a informação já implementada sobre tema, favoritos e comparação. `anm-orbit-theme`, `anm-favorites-v1`, `anm-comparison-v1` e legado `anm-design-saved` usam armazenamento local; listas não têm expiração automática. A seleção permite pedidos à API pública, não é uma funcionalidade sem rede.
- **Scroll:** `orbit-reload-position` usa armazenamento de sessão com URL completo, coordenadas e hora. Janela de utilização de 60 segundos não equivale a apagar a entrada. A política já descreve esta função.
- **Alojamento e terceiros:** confirmar cookies, logs/IP, retenção, CDN, email, subcontratantes e transferências no ambiente final. Algumas imagens são pedidas ao Unsplash; fontes locais; Maps e WhatsApp são ligações externas. A auditoria do código não comprova a ausência de cookies ou serviços introduzidos pelo alojamento.
- **Consentimento:** não foi instalado banner/CMP. Rever a necessidade e configuração com base nos serviços efetivamente ativos, antes de acrescentar analytics, publicidade, embeds ou outros recursos.
- **Tema — 15 de outubro de 2026:** por escolha explícita do proprietário, a correção do flash no refresh usa apenas o armazenamento local existente, aplicado antes da primeira pintura e da hidratação. A proposta de cookie de tema foi retirada; não existe cookie novo nem envio desta preferência ao servidor. A política descreve a finalidade, ausência de expiração automática e remoção pelo navegador. Isto não encerra a revisão de consentimento: a Lei n.º 41/2004, artigo 5.º, e o Parecer europeu 04/2012 também abrangem tecnologias semelhantes a cookies; a preferência persistente não deve ser presumida isenta apenas por usar localStorage. Mantêm-se as pendências de revisão jurídica e dos serviços efetivos em produção.
- **Conteúdo:** rever dados fictícios, fotografias ilustrativas, afirmações comerciais, preços/disponibilidade, equipa, contactos e indexação. Preservar `noindex` das demos; aprovar expressamente o estado de indexação das páginas oficiais.

## Validação técnica — separada da revisão jurídica

- Pendente: build e runtime Node no Render no ambiente de publicação. Como registo histórico, um build anterior chegou à fase de adaptação Vercel e encontrou `EPERM` ao criar symlink no Windows. Não atribuir esse erro à informação legal nem afirmar que o build final foi validado.
- Pendente: confirmar domínio/origem e canonical/OG/JSON-LD, links, fotografias, formulários escolhidos, segurança operacional e percursos desktop/mobile.
- Pendente: revisão final de acessibilidade, contraste, navegação por teclado, links legais e adequação da comunicação ao funcionamento efetivo dos contactos e formulários.
- Testes locais aprovados não equivalem a aprovação de publicação. Esta checklist não autoriza publicação.

## Como encerrar pendências

Preencher valores confirmados na configuração e substituir placeholders no texto quando aplicável. Atualizar o conjunto real de contactos e funcionalidades. Só marcar um item de `checks` como `verified` depois de registar aqui evidência, data e responsável pela confirmação. «Não aplicável» exige decisão explícita documentada. Reexecutar a verificação manual e rever o site final; não remover pendências apenas para obter código 0.

### Registo de confirmações

- 4 de outubro de 2026 — utilizador confirmou explicitamente que o website não tem conteúdo/atividade relacionada com crédito; não aplicável ao âmbito atual.
- 25 de outubro de 2026 — proprietário forneceu os contactos comerciais, duas moradas em Castelo Branco, horários, contactos de João Nunes, Diogo Nunes e Alexandre Nunes, Facebook e Instagram; confirmou diretamente neste chat «Sim, são oficiais e autorizo aplicar». Evidência adicional na mensagem de voz `01a17471-d4a8-7fb1-bca9-50750706effd` do chat `01a17464-70e7-7a03-9873-a14f9d3c255a`. Facebook confirmado sem parâmetro de idioma. A autorização abrange apresentar estes dados no website, sem deploy externo.
- As restantes confirmações de identidade legal, registos, privacidade, serviços finais e aprovação de publicação continuam pendentes.

### Registo histórico da preparação inicial — outubro de 2026

268 testes do website aprovados. Svelte check final: 0 erros e 0 avisos. `/informacao-legal`, `/politica-de-privacidade` e `/quem-somos` responderam com 200. Campos pendentes e avisos de demonstração confirmados na interface; sem overflow na página legal mobile. A verificação manual continua a assinalar 21 pendências. Nenhum build de publicação ou deploy foi executado; estes resultados não encerram as pendências acima.

### Preparação SEO — 4 de outubro de 2026

- Por autorização explícita do utilizador, home e `/quem-somos` já não têm `noindex` incondicional; títulos e descrições foram preparados para as páginas públicas. Isto não aprova os textos demonstrativos, contactos, dados legais ou publicação.
- As previews Vercel recebem `X-Robots-Tag: noindex, follow`. Noutros alojamentos de staging, configurar `SITE_NOINDEX=true`; não existe domínio final inventado no código. As canonicals e o sitemap usam a origem do pedido, que deve ser validada no domínio final juntamente com os redirecionamentos de aliases.
- `/demo`, favoritos, comparação, páginas legais e combinações de filtros mantêm o seu `noindex`. Catálogo, páginas de paginação com resultados e filtros apenas por marca conservam a política de indexação existente.
- Sitemap dinâmico em `/sitemap.xml`, anunciado em `/robots.txt`: páginas públicas elegíveis, marcas e todas as fichas da projeção pública, incluindo páginas posteriores do catálogo. Falhas da API produzem 503, nunca um sitemap parcial; não são inventadas datas `lastmod`.
- Falha temporária do catálogo passa a devolver HTTP 503 com `Retry-After`, em vez de HTTP 200 com lista indisponível. As fichas recebem títulos com ano e descrições com dados públicos; imagem social apenas quando existe fotografia aprovada.
- Verificação local de HTML SSR: todas as 14 fichas acessíveis pelos links do catálogo (9 + 5), todas responderam 200 e continham JSON-LD. Paginação e carrossel de semelhantes já expõem links HTML; nenhuma ficha órfã nesta amostra. Sitemap respondeu 200 e incluiu as 14 fichas. Home e Quem Somos sem `noindex`; amostras de demo, favoritos, comparação e filtro combinado preservaram `noindex`.
- Conteúdo ainda por rever: 13 de 14 fichas sem fotografias, especificações vazias nas 14, descrições resumidas a marca/modelo/ano, entrada `renot clicli`, destaques da home ligados a demos e referências a financiamento em `standTrust.ts`/`catalogEditorial.ts`, incompatíveis com a confirmação acima. Nenhum dado de negócio foi inventado ou corrigido por suposição nesta revisão técnica.
- Esta validação local não mede ranking nem Core Web Vitals de produção e não encerra qualquer item pendente de publicação.

### Contacto por email — 10 de outubro de 2026

- Implementados endpoint público no backend, relay no servidor SvelteKit, submissão real do modal público e formulários inferiores, aviso de privacidade e mensagens de sucesso/erro dependentes da resposta do serviço.
- Resend escolhido com configuração privada; nenhuma chave, domínio ou endereço real foi inventado. Envio desativado por omissão e bloqueado enquanto os campos de privacidade estiverem pendentes. Não houve email real enviado.
- A página de privacidade descreve o fluxo previsto, sem criação de cliente/conta ou gravação do pedido no CRM. Sem consentimento genérico obrigatório nem subscrição de marketing.
- Mantêm-se pendentes identidade do responsável, contactos oficiais, destinatário/remetente, domínio verificado, credenciais, fundamentos, conservação, contratos, transferências e configuração de alojamento. Nenhum item marcado como verified.
- Verificação desta implementação: 119 testes backend, 333 testes existentes website e quatro novos testes relay aprovados; TypeScript e Svelte check sem erros, Svelte sem avisos. Build compilou cliente/servidor e voltou a falhar no adapter Vercel com EPERM de symlink no Windows. Lint do DesignEdition conserva 11 erros já presentes no HEAD; restantes ficheiros alterados sem erros. Nenhuma entrega real de email confirmada.

### Previews de partilha — 14 de outubro de 2026

- Completados Open Graph e Twitter Cards no HTML SSR das páginas públicas, incluindo imagem de marca PNG 1200 × 630 para páginas/fichas sem fotografia. Fichas com foto usam apenas o endpoint estável da fotografia pública aprovada; preservadas allowlist, JSON-LD e políticas de indexação/demos.
- Validação no projeto principal: 337 testes existentes aprovados; Svelte check com 0 erros/avisos; 12 rotas verificadas por HTTP com API pública fictícia e user agents de quatro crawlers. Imagens responderam 200, com MIME/bytes/dimensões corretos e sem autenticação. Esta fixture não confirma fotografias ou acesso externo no domínio real.
- Build local compilou cliente/servidor e voltou a falhar no adapter Vercel com EPERM ao criar symlink no Windows. Build de publicação permanece pendente.
- Implementação, teste reproduzível e limites de plataformas/caches documentados em `docs/social-previews.md`. Falta validar domínio final, HTTPS, acesso dos crawlers, imagens reais e previews externas. Nenhum deploy, push ou mensagem real; nenhum item marcado como verified. As pendências legais, de dados, conteúdo e publicação permanecem.

### Destino Node/Render — 15 de outubro de 2026

O proprietário escolheu Render e pediu a remoção do suporte ativo Vercel. O rótulo da verificação de build na configuração pública foi atualizado para refletir esse destino; o estado continua pending. Builds Node locais não confirmam o ambiente Render, memória, dados oficiais ou aprovação de publicação. Consultar docs/render-single-service.md para evidência técnica e limitações.

### Alterações do proprietário — 25 de outubro de 2026

Aplicadas na branch `main` da pasta principal, servida em `http://localhost:5173/`. Esta checklist trata do pedido de alterações; não encerra a checklist de publicação acima.

- [x] Duas moradas: Rua Dr. Jorge Costa, 6000-215 Castelo Branco; Estrada de Montalvão, 6000-050 Castelo Branco. Sem números de porta inventados; ligações de pesquisa no mapa para cada morada.
- [x] Telefones visíveis com indicativo: +351 964 243 323 e +351 968 392 633; email geral@autonunesmartins.pt.
- [x] Horário: segunda a sexta 09:00–13:00 e 14:00–19:00; sábado 09:00–16:00; domingo e feriados fechado ou por marcação.
- [x] Título da seleção na página inicial: «O seu próximo carro».
- [x] Chevrons anterior/próximo com proporção natural (SVG 36×48 px desktop / 30×40 px mobile), fora da fotografia, sem fundo/borda/caixa; branco a 38% em repouso, 68% ao hover e 85% no foco por teclado, sem vermelho. Foco visível por brilho discreto, hover independente da fotografia e do preço, navegação circular e por teclado.
- [x] Removida a seta diagonal branca sobre a fotografia; imagem continua clicável.
- [x] Carrossel percorre os destaques pela ordem configurada, uma entrada de cada vez; intervalo final de 4000 ms após cada imagem estar visível. A imagem antiga carregada já não permite saltar uma entrada ainda a carregar.
- [x] Troca sincronizada: fotografia já descodificada, nome, preço, ligação e indicadores mudam no mesmo render. Apenas a camada visual anterior desaparece numa dissolvência de 160 ms; não se adia a atualização lógica até ao fim. Movimento reduzido mantém troca imediata; pulso visual original do preço conservado em 650 ms, com amplitude/easing originais.
- [x] «Continue a descobrir»: dois pedidos sucessivos de abrandamento subtil (+5% e depois cerca de +4% no tempo de movimento): 951 ms de subida e 1140 ms de descida; micropausa de 100 ms só no ponto inferior, amplitude/easing preservados e nenhuma pausa extra no topo. Ciclo total de 2191 ms; preferência de movimento reduzido preservada.
- [x] Sublinhados de hover/foco revelam comprimento por recorte em vez de escala horizontal, mantendo espessura fixa: marcas, navegação desktop/mobile, ligação do hero, serviços, convite do rodapé, email e editorial do catálogo. Durações existentes conservadas; não alteradas linhas de progresso ou outros efeitos intencionais.
- [x] Removidos apenas os cantos vermelhos decorativos de «O próximo passo começa aqui»; cantos do destaque mantidos.
- [x] «Vamos conversar» no banner de serviços: sublinhado vermelho de 1 px com revelação de 420 ms e seta a deslocar-se 3 px para cima/direita em 220 ms, coerentes com o hero; proporções ajustadas, foco e movimento reduzido verificados. Outros botões do banner não receberam esse efeito.
- [x] Comparação local de fundos: um único banner, com a composição/dimensões originais, e oito botões «Versão 1–8» acima. Versão 1 inicial mantém a fotografia original; versões 2–8 usam sete fundos gerados por `image_gen`, sem modificar os originais. Só muda o fundo, depois de descodificado; texto, CTA, altura e ligação à secção seguinte conservados. Sete masters e prompts em `assets/generated/service-banner-comparison/`, variantes WebP/AVIF em `apps/website/src/lib/assets/service-banner-comparison/`.
- [x] Imagens existentes mantidas, conforme cancelamento explícito da troca. Entrega a 1600 px, receita WebP84 e masters preservados.
- [x] Catálogo com título «Viaturas».
- [x] Quem somos situa o stand em Castelo Branco; retirados cargos e aviso de contactos de exemplo.
- [x] Equipa: João Nunes (964 243 323, geral@autonunesmartins.pt), Diogo Nunes (968 392 633, diogomn99@gmail.com) e Alexandre Nunes (966 955 140, alex_nunes95@hotmail.com).
- [x] Facebook https://www.facebook.com/autonunesmartins/ sem parâmetro de idioma; Instagram https://www.instagram.com/autonunesmartins/.
- [x] Comparação com especificações na primeira coluna e valores alinhados nas seguintes; listas do detalhe mais afastadas e valores próximos dos rótulos.
- [x] Miniaturas do detalhe: roda vertical e gesto diagonal predominantemente vertical passam para a página; apenas gestos horizontais que podem mover a faixa são tratados. Contenção vertical removida e comportamento desktop ajustado para não capturar diagonais; drag, setas, seleção e scroll touch nativo preservados.
- [x] Retirado «O carro é só o início» acima dos três cards do detalhe. Conteúdo/ações mantidos; padding superior de 24 px desktop / 16 px mobile conserva a borda superior de 1 px inteira.
- [x] Ficha real verificada por clique no destaque, clique no catálogo e URL direta. Resolvida falha local de chunks de build substituídos: servidor local passou a Vite na pasta principal para servir os fontes atuais sem esse conflito.

Verificação: 532 testes aprovados, incluindo dois testes novos de sequência, imagem lenta, intervalo de 4 segundos, ausência de temporizadores duplicados, visibilidade e limpeza; teste de preço confirma os 650 ms originais. Svelte check sem erros/avisos e build Node local aprovado. Chrome a 1440 e 390 px verificou contactos com +351, equipa, mapas, redes, chevrons, navegação circular, teclado, hover e ausência de overflow. Sublinhados observados no início/meio/fim mantiveram 1 ou 2 px e transformação `none`; foco preservado. O botão do banner e a ausência dos cantos na secção editorial foram verificados nos dois tamanhos. Oito mudanças manuais seguidas confirmaram a sincronização da fotografia/alt, dados, ligação e indicador desde o início do fade de 160 ms, com pulso de preço de 650 ms. Duas voltas automáticas com as quatro viaturas reais seguiram 1→2→3→4→1→2→3→4→1, incluindo uma fotografia atrasada seis segundos apenas no navegador de teste. O temporizador mantém 4 s de visualização; rede/descodificação podem prolongar a troca, sem saltar uma entrada. Não foram enviados emails, feitos commits, push ou deploy.

O destaque existente mostra uma fotografia escolhida no CRM por viatura: o carrossel percorre **viaturas**, não todas as fotografias de uma única viatura. Não foi criado um carrossel interno adicional. WhatsApp usa agora o número principal confirmado pelo proprietário; formulários, dados legais/privacidade e restantes condições de publicação mantêm as suas pendências.

Confirmação dos refinamentos: ciclo do indicador de 2,191 s servido no Vite, amplitude de 10 px, micropausa inferior de 100 ms e nenhuma pausa superior adicional. Preço verificado no navegador com pulso original de 650 ms durante o fade de imagem de 160 ms; dados, ligação e indicadores já representam a nova viatura desde o início. A secção «Venha conhecer-nos» apresenta os dois números com +351, sem alterar os links internacionais. Depois da suite de 532 testes, foram adicionados quatro testes da roda das miniaturas; estes e os testes relacionados passaram (11 testes focados). A última verificação Svelte dos oito fundos teve 0 erros/avisos. Os builds anteriores passaram; não se repetiu o build completo apenas pelos refinamentos visuais locais.

As oito seleções de fundo foram verificadas no Chrome a 1440 e 390 px: um único elemento de imagem e o mesmo texto/CTA, largura/altura e posição estáveis entre versões (1430×620 px de área útil no desktop; 380×960 px no mobile). Os botões ficam acima; no mobile, oito opções ocupam duas linhas. Uma imagem atrasada artificialmente manteve o fundo anterior até estar pronta. Teclado, CTA e ausência de overflow confirmados. A roda vertical foi exercitada nos dois extremos da faixa, gesto horizontal, diagonal e gestos touch vertical/horizontal; a seleção da fotografia permaneceu intacta. Não houve publicação.

### Revisão de contactos e alternativas — 25 de outubro de 2026

- WhatsApp confirmado pelo proprietário como o número principal +351 964 243 323 (mensagem de voz `01a174c2-7b46-7642-9271-461d7eb22a54`); ligação oficial ativa e estilo verde original restaurado pelo estado ativo.
- Verificados os 16 links `tel:` presentes no início, Quem Somos e numa ficha de viatura: números internacionais corretos e nenhum cancelamento pelo código. O Windows consultado não tem associação `tel` explícita em UserChoice; a abertura do marcador depende da aplicação de chamadas configurada no dispositivo. Não foram efetuadas chamadas, mensagens ou emails.
- Enviar email recebeu o sublinhado de 1 px em 420 ms e seta diagonal de 3/-3 px; Ligar agora na secção de visita e Enviar pedido receberam a mesma animação de seta em 220 ms, mantendo os estados de envio e as condições dos formulários. Hover, foco, movimento reduzido e largura mobile verificados.
- As antigas propostas 6–8 foram substituídas por três novas fotografias de cockpit baseadas na direção aprovada da versão 5. Novos masters `alternative-{5,6,7}-r2.png` e derivados WebP/AVIF responsivos; prompts integrais e referência guardados em `assets/generated/service-banner-comparison/prompts.json`. Removidos apenas os 3 masters e 18 derivados dedicados rejeitados, depois de provar ausência de referências ativas e validar os caminhos absolutos. Versões 1–5 preservadas; SHA-256 do master aprovado 5: `a054793df131faa791266c0beaba200da5596a317c780279412b568fe232abbc`.
- Chrome em 1440 e 390 px: oito versões, um banner sem mudança de tamanho/posição entre fundos, controlos acima, preparação antes da troca, teclado e CTA verificados. Svelte check: 0 erros e avisos; 36 testes focados de WhatsApp e navegação aprovados. Sem novo build, commit, push ou deploy. Restantes pendências de publicação preservadas.

### Novos enquadramentos das versões 6–8 — 25 de outubro de 2026

Por novo pedido do proprietário, as três últimas opções foram novamente substituídas, agora por fotografias de detalhe requintado e enquadramento próximo/semiabstrato inspiradas na versão 1 original. Geradas com a ferramenta image_gen integrada; prompts completos e referência em assets/generated/service-banner-comparison/prompts.json. Masters alternative-5-r3.png, alternative-6-r3.png e alternative-7-r3.png na pasta dedicada; 18 derivados responsivos WebP/AVIF. As imagens r2 rejeitadas foram retiradas depois de confirmar ausência de referências ativas e validar caminhos absolutos. Os 112 assets protegidos da família original e versões 1–5 mantêm hashes idênticos. Chrome em 1440 e 390 px aprovou as oito opções, fundo carregado antes da troca, mesmo banner sem mudança de posição/tamanho, teclado e CTA. Apenas fundos e proveniência alterados; sem build, commit, push ou deploy.

### Correção de escala das versões 6–8 — 25 de outubro de 2026

O proprietário considerou o enquadramento anterior demasiado fechado e pediu zoom out semelhante à versão 1. Substituídos apenas os três fundos por vistas diagonais médias, reunindo volante, tablier e consola no mesmo enquadramento. Masters alternative-5-r4.png, alternative-6-r4.png e alternative-7-r4.png, com 18 derivados responsivos; prompts completos e referência em assets/generated/service-banner-comparison/prompts.json, geração pela ferramenta image_gen integrada. Os21 ficheiros r3 dedicados foram removidos após confirmar ausência de referências e validar caminhos. Os112 assets protegidos das versões1–5 e família original continuam byte a byte iguais. Chrome1440/390: oito fundos carregados, layout e posição constantes, CTA/teclado e preparação antes da troca aprovados. Sem outras alterações, build ou publicação.

### Fotografias distintas e nona opção — 25 de outubro de 2026

Por pedido explícito, substituídas as opções públicas 6–8 por interiores com arquitetura realmente diferente da fotografia original: grand touring em pele conhaque/alumínio, SUV com madeira clara/pele marfim e desportivo em bordô/Alcantara. Acrescentada opção pública 9 exterior, com frente de coupé em estúdio. Geradas sem fotografia de referência para evitar repetir o habitáculo original. Masters version-6-r5.png a version-9-r5.png, mais24 derivados WebP/AVIF, e prompts completos em assets/generated/service-banner-comparison/prompts.json; ferramenta image_gen integrada. As versões públicas1–5 e os112 ficheiros protegidos permanecem idênticos, incluindo os quatro primeiros objetos/imports do módulo. Removidos apenas os21 ficheiros r4 rejeitados após confirmar ausência de referências e validar caminhos absolutos. Seletor mobile em3x3. Chrome1440/390 verificou nove imagens distintas, dimensão/posição do banner constantes entre opções, teclado/CTA e carregamento antes da troca; Svelte check sem erros/avisos. Sem build, commit, push ou deploy.

### Composição mobile da abertura — 25 de outubro de 2026

Por pedido do proprietário, a abertura foi redesenhada apenas até700px: introdução mais compacta, fotografia sem setas laterais e sem espaço reservado para elas, preço alinhado à direita dos dados da viatura, CTA com alvo de44px e fundo suavizado atrás da composição. Os controlos inferiores do carrossel, temporizações existentes, imagem original e receita de fotografias foram preservados. Indicadores em faixa horizontal de quatro colunas sem divisões internas, preservando todos os valores existentes. Continue a descobrir mantém centragem horizontal e seta próxima; Limpar filtros mantém centragem no seu espaço. Logótipo mobile ampliado sem mudar a altura da navbar nem os outros botões. Chrome320/360/390/414/700/1440: sem overflow, preço à direita e indicadores na mesma linha; quatro destaques verificados sem sobreposições, teclado e movimento reduzido preservados. Em390px, abertura reduzida para cerca de582px e indicadores terminam antes de790px com navbar incluída. Svelte check sem erros/avisos. Desktop preservado pelas regras media. Sem build, commit, push ou deploy; pendências de publicação mantidas.

### Acabamento dos indicadores mobile — 25 de outubro de 2026

Após revisão do proprietário, recuperado o brilho vermelho no topo da faixa mobile e acrescentada linha superior suave em gradiente. Números e rótulos maiores, com distribuição horizontal sem caixas/divisórias e espaço suficiente para2500+ desde320px. Mantidas contagem animada, valores e apresentação desktop. Verificação Chrome320/390/414/700/1440 sem overflow, indicadores na mesma linha; desktop sem novo detalhe decorativo. Alteração restrita ao estilo mobile de OrbitStats.svelte. Sem build ou publicação.

### Separação entre indicadores e pesquisa mobile — 25 de outubro de 2026

Por pedido explícito, acrescentada linha neutra de1px sob a faixa de indicadores, alinhada com a largura da pesquisa, e reduzido o espaço até ao título seguinte de52px para28px. Mantidos brilho vermelho superior, indicadores horizontais e ausência de caixas individuais. Chrome320/390/700 confirmou linha e intervalo de28px sem overflow; desktop1440 mantém apresentação e espaçamento anteriores. Sem outras alterações ou publicação.

### Explorar por marca em mobile — 25 de outubro de 2026

Substituído o seletor mobile por uma fila horizontal de cartões com logótipo/nome e ligação direta ao filtro de marca. Scroll nativo com toque e alinhamento suave, indicação pela próxima marca parcialmente visível e barra discreta; sem autoplay novo. Inclui todas as marcas disponíveis em mobile, mantendo só as primeiras seis na grelha desktop como antes. Retirados formulário/seletor e estado local já desnecessários. Chrome320/390/700/1440 no início e catálogo confirmou dez marcas disponíveis, uma linha mobile, seis visíveis desktop, acesso por teclado ao último cartão, ligação correta ao filtro e ausência de overflow da página. Toque horizontal e scroll vertical sobre a faixa verificados sem navegação acidental. Svelte check sem erros/avisos. Sem build, commit, push ou deploy.

### Gestos, acessibilidade e carregamento mobile — 25 de outubro de 2026

- Implementado swipe horizontal na imagem grande da ficha e no fullscreen, com distinção de toque/scroll vertical/pinça, supressão do clique após arrasto e respeito pelo zoom nativo. Mantidos botões e teclado. Verificação por toque Chrome real simulado, nos dois sentidos, limites, retorno da página de contacto e retrato/paisagem, sem abertura ou fecho acidental.
- Fullscreen mobile usa a área disponível com fundo uniforme, margens seguras, botão fechar48px e miniaturas76x56; miniaturas da ficha88x66 e imagem4:3. Desktop preservado.
- Marcas mobile sem molduras/setas em cartões, com passagem automática lenta, pausa ao toque/foco/hover/fora do ecrã, botão persistente pausar/retomar e alternativa manual com movimento reduzido. Duplicados visuais fora da ordem de teclado e ocultos da leitura assistida. Grelha desktop preservada.
- Preparação inicial de fotografias mobile reduzida para três; restantes miniaturas observadas na própria faixa. Nove em desktop e ficheiro1600 preservados. Registo complementar em docs/photo-delivery-experiment.md. Medição Chrome390: índices0–3 na entrada,0–4 ao abrir viewer e novas fotos só ao percorrer a faixa.
- Descrição limitada em altura a20 linhas mobile/30desktop, botão Expandir/Recolher apenas se necessário, links além do corte fora da ordem de teclado enquanto recolhidos. Conteúdo curto sem botão. Fixture longa verificada no navegador; sem alterar descrições reais.
- Ícone de partilha aproximado ao texto apenas em mobile; setas Unicode substituídas por SVG em O caminho também, catálogo, equipamento e convite, evitando apresentação como emoji.
- Para Venha conhecer-nos foi dada uma recomendação de imagem num bloco próprio no topo, contactos e formulário em fundo uniforme; a fotografia/composição dessa secção não foram alteradas nesta revisão.
- 51 testes focados aprovados; Svelte check: 0 erros/avisos; git diff --check aprovado. Sem build, commit, push, deploy ou envio externo. Pendências legais/de formulários/publicação preservadas.

Foi criada uma pré-visualização somente no browser da proposta de Venha conhecer-nos (foto em bloco no topo e contactos abaixo); não aplicada ao código. A recomendação permanece separada dos ajustes já implementados.

### Proposta de visita aplicada para revisão — 25 de outubro de 2026

Após pedido direto para modificar a página e decidir depois de ver, aplicada a composição mobile de Venha conhecer-nos: fotografia existente e título num bloco próprio de260px, sem máscara de desvanecimento; contactos e formulário seguem sobre fundo uniforme. O título mantém um único nó/ID, com wrapper display:contents em desktop. Canais em coluna para evitar quebra artificial do email, alvos de contacto44px e intervalo de48px antes do formulário. Esta alteração substitui a nota anterior de proposta ainda não aplicada. Retiradas também as setas inferiores do destaque da home apenas em mobile, mantendo quatro indicadores interativos e passagem automática. Chrome320/390/700/1440 confirmou recorte limitado ao cabeçalho, contactos abaixo, ausência de overflow e navegação pelos indicadores. Svelte check0 erros/avisos. Sem build, commit, push ou deploy; aplicado apenas no checkout principal/Vite para revisão.

### Correção do alvo das setas mobile — 25 de outubro de 2026

O proprietário esclareceu que as setas a remover eram as do carrossel de cinco sugestões Continue a explorar, na ficha da viatura. Ocultados os controlos integrados apenas até700px em RelatedCarousel, preservando swipe, cinco indicadores e setas desktop. Reposta a ocultação indevida dos botões inferiores do destaque da home; as setas junto da fotografia da home continuam ocultas em mobile como anteriormente autorizado. Chrome390 confirmou swipe e indicadores nas sugestões, controlos desktop1440 e reposição da home. Esta entrada substitui a interpretação da nota anterior sobre as setas inferiores do destaque. Sem build ou publicação.

### Carregamento integral das fotografias — 26 de outubro de 2026

Por novo pedido explícito do proprietário, removido o lazy loading das fotografias da viatura em todos os tamanhos de ecrã. Todas as imagens aprovadas entram nos preloads e na preparação de navegação, mantendo fila de seis transferências, formato1600 e reutilização de pixels. Miniaturas eager na ficha e fullscreen; retirados os módulos de adiamento criados nesta revisão. Fullscreen abre sem esperar pela preparação completa das miniaturas e pode obter uma cópia em falta pelo acesso autorizado normal. Este pedido substitui o de preparar só três fotos mobile. O proprietário pediu também commits e push de todas as alterações desta revisão, organizados por assunto quando útil.

### Validação final antes dos commits — 26 de outubro de 2026

Suite completa do website:551 testes aprovados em64 ficheiros. Svelte check:0 erros/avisos. Build de produção com adapter Node concluído localmente; não confirma ambiente Render nem encerra a pendência de publicação. Chrome390 e1440 confirmou as12 fotografias da viatura descarregadas à entrada, miniaturas todas prontas e nenhuma fotografia nova ao abrir fullscreen; navegação mobile a partir do catálogo também preparou as12. Os contactos e alternativas do banner foram separados em commits próprios. Artefactos locais anteriores em artifacts/ não integram as alterações do website. O novo acabamento do botão Venha conhecer-nos em Quem Somos, pedido depois, será aplicado localmente fora deste push para o próximo envio.

### Revisão editorial e de dados — 28/10/2026

Três páginas canónicas foram preparadas para revisão local: Informação legal (inclui RAL/Livro), Termos de utilização e Privacidade e cookies (inclui preferências). O rodapé tem essas três ligações e acesso direto ao Livro; as rotas antigas redirecionam para as secções correspondentes. Identidade completa centralizada, mantendo responsável/contacto na política e recolha; menções societárias dependem da natureza do operador ainda por confirmar. Os textos permanecem, com aviso de dados pendentes e sem inventar identificação jurídica/adesões. Contactos comerciais oficiais mantêm-se. O aviso junto dos formulários passa a informação em camadas, sem checkbox de consentimento genérico nem alteração do tratamento. A revisão de armazenamento ganhou pendência explícita storageConsent: tema, favoritos, comparação e scroll foram inventariados, mas persistência/necessidade/consentimento e alojamento final não se presumem validados. Não foi instalado um banner que não controle nada, nem modificada a memória existente. Fontes, decisões e dados em falta em docs/legal-review-2026-10-28.md. Nenhum campo oficial foi preenchido ou check pendente marcado como verified. Esta revisão local não aprova publicação.
