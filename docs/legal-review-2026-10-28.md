# Revisão legal/editorial do website — 28 de outubro de 2026

Estado: preparada para revisão LOCAL. Não constitui aprovação jurídica, autorização de publicação ou validação da configuração de produção. Nenhum dado oficial foi inventado, nenhuma pendência foi resolvida por testes/build e não foram alterados processamento, gates, armazenamento, credenciais, DB ou contas. Esta revisão não tem autorização de push/deploy.

## Referências editoriais consultadas

As referências servem para organização e experiência de leitura; não são fontes da lei nem prova de conformidade.

| Referência | Observado | Decisão para Auto Nunes Martins |
| --- | --- | --- |
| [Uaucar](https://www.uaucar.pt/), páginas de [privacidade](https://www.uaucar.pt/politica-de-privacidade/), [cookies](https://www.uaucar.pt/politica-de-cookies/), [termos](https://www.uaucar.pt/termos-e-condicoes/) e [contacto](https://www.uaucar.pt/contacte-nos/) | Ligações no rodapé, RAL visível, CMP e informação de formulário distribuída por várias opções. | Aproveitar descoberta fácil; não copiar adesões, crédito, dados do operador, consentimentos genéricos ou o texto de navegação como aceitação. |
| [Paulcar — resolução de conflitos](https://paulcar.com/resolucao-de-conflitos/), [privacidade](https://paulcar.com/politica-de-privacidade/) e [contactos](https://paulcar.com/contactos/) | Página RAL curta, rodapé com ligações diretas e aviso junto do formulário muito breve. | Usar concisão e navegação direta, com informação em camadas própria; uma ligação genérica não identifica, por si, a entidade aplicável ao nosso operador. |
| [Rorizcar — termos](https://www.rorizcar.com/termos-e-condicoes) | Tópicos por assunto, políticas interligadas e RAL/Livro no rodapé. | Separar os assuntos em páginas pequenas. Não transportar foro exclusivo, exclusões amplas, marketing/analytics genéricos ou dados de outro stand. A página de privacidade não foi recuperada pelo extrator; não se presume que tenha sido auditada integralmente. |
| [Benecar](https://benecar.pt/), [condições e proteção de dados](https://benecar.pt/condicoes-gerais-de-utilizacao), [RAL](https://benecar.pt/resolucao-alternativa-de-litigios.pdf) | Rodapé legal abrangente, secções de dados e ligações junto de vários formulários; atividade muito mais ampla, com conta/loja/crédito. | Conservar a ligação entre informação e contexto. Não importar funcionalidades, bases legais ou consentimentos de uma operação diferente. |

Uaucar e Paulcar foram lidos no navegador depois de o extrator devolver 406/indisponibilidade. Não foram aceites categorias opcionais, enviados formulários ou resolvidos CAPTCHAs. As observações não são uma auditoria técnica dos cookies desses terceiros.

## Fontes primárias verificadas e aplicação

- [RGPD, artigos 5.º, 6.º, 12.º e 13.º](https://eur-lex.europa.eu/legal-content/PT/TXT/?uri=CELEX:32016R0679): informação transparente na recolha, identidade/contacto, finalidades/fundamento, destinatários, conservação, transferências e direitos. Texto consultado no navegador oficial, pois o extrator encontrou a proteção JavaScript. As lacunas reais continuam visíveis e impedem concluir prontidão.
- [EDPB — proteção de dados desde a conceção, secção transparência](https://www.edpb.europa.eu/sites/default/files/files/file1/edpb_guidelines_201904_dataprotection_by_design_and_by_default_v2.0_en.pdf): informação concisa em camadas, sem labirinto. Nota curta + expansão nativa + política a um clique; não basta esconder as lacunas na última camada.
- [DR — Decreto-Lei 7/2004, artigo 10.º](https://diariodarepublica.pt/dr/detalhe/decreto-lei/7-2004-240775): identificação permanente e acessível. Firma/NIF/sede/registo não substituídos pelos contactos comerciais confirmados.
- [DR — Lei 144/2015](https://diariodarepublica.pt/dr/detalhe/lei/144-2015-70215248), artigo 18.º na redação aplicável, e [lista DGC](https://www.consumidor.gov.pt/upload/processos/i006589.pdf): identificar entidade/vinculação e sítio aplicáveis, sem copiar adesão de concorrentes. A lista geral é ajuda, não resolve o campo do operador.
- [DR — regime do Livro de Reclamações](https://diariodarepublica.pt/dr/legislacao-consolidada/decreto-lei/2005-34431675) e [ASAE — perguntas frequentes](https://www.asae.gov.pt/ficheiros-externos-2018/perguntas-frequentes-sobre-o-livro-de-reclamacoes-vermelho-fisico-pdf.aspx): acesso visível à plataforma, separado do contacto comercial. O link geral não comprova o registo do stand.
- [Regulamento UE 2024/3228](https://eur-lex.europa.eu/legal-content/EN/ALL/?uri=oj%3AL_202403228): plataforma ODR descontinuada/revogação em 20/07/2025. Não foi acrescentada ligação ODR; referências antigas em páginas de terceiros não prevalecem.
- [DR — Lei 46/2012, artigo 5.º da Lei 41/2004 republicada](https://diariodarepublica.pt/dr/detalhe/lei/46-2012-174793), [CNPD — cookies](https://www.cnpd.pt/media/x2zdus50/nota-informativa-cnpd_cookies_20210625.pdf) e [Parecer 04/2012, WP194](https://ec.europa.eu/justice/article-29/documentation/opinion-recommendation/files/2012/wp194_en.pdf): a análise inclui armazenamento/acesso no terminal e necessidade/duração da função expressamente pedida; não se presume isenção por usar localStorage. A persistência indefinida não foi validada como estritamente necessária.
- [Resend DPA](https://resend.com/legal/dpa): identifica operações principais nos EUA e mecanismos contratuais. Não confirma que a conta, região, subcontratantes, correio, alojamento e garantias deste operador estejam validados.

## Factos verificados no código

| Operação | Evidência/estado |
| --- | --- |
| Montra pública | Sem checkout, conta pública ou crédito. Catálogo/favoritos/comparação pedem projeções públicas. Não foram importados termos de comércio eletrónico ou marketing de terceiros. |
| Contacto | `contactRequest.ts`, relay `/api/contact`, backend `publicContact.ts`: nome/email/assunto/mensagem + pathname sem query; honeypot, limites e idempotência. Aceite 202 exige confirmação do prestador, não entrega final. `CONTACT_ENABLED` e credenciais controlam runtime. O teste contactEndpoint confirma encaminhamento com metadata de privacidade nula: não existe gate automático baseado em readiness. |
| CRM | `contactBudget.ts`/`contactNotifications.ts`: evento com nome/assunto/hora/identificador/HMAC do payload e leitura por utilizador. Não cria cliente/conta nem guarda email/corpo neste fluxo. O evento pode continuar a impedir repetição depois da expiração da tentativa. |
| Antisspam | Identificadores derivados/HMAC e contadores; pseudonimização, não anonimato. Tentativas expiram em 35 dias, com limpeza de até 250 registos por pedido; não implica eliminação exata no dia 35. Não se aplica ao CRM/email/backups. |
| Terceiros | Fontes e SVG de mapa locais; links Maps/WhatsApp/redes dependem de clique. `images.ts` permite pedidos diretos a Unsplash em percursos que usem esses identificadores. Não há analytics/pixel/iframe integrados encontrados nos ficheiros executáveis auditados. Isso não prova o estado de hosting/proxy/produção. |
| Alojamento | Docker/gateway/adapter Node existem no repositório. Não foram lidos segredos nem verificados contratos, contas, regiões, logging ou retenção do ambiente publicado. |

## Armazenamento: avaliação por operação, sem alterar comportamento

| Operação | Trigger e dados | Duração observada | Decisão pendente |
| --- | --- | --- | --- |
| Tema `anm-orbit-theme` | Escolha claro/escuro; lido também antes da pintura/hidratação. Cookie homónimo legado eliminado quando presente, não usado como preferência atual. | localStorage sem TTL. | Avaliar memória prolongada/consentimento e informação na escolha. Não foi classificada automaticamente como isenta. |
| Favoritos `anm-favorites-v1` | Coração solicitado; slugs lidos no arranque; migração de `anm-design-saved` quando existe. | Sem TTL; limpar lista grava `[]`, não apaga necessariamente a chave/legado. | Função pedida é clara; justificar duração/acesso futuro ou obter escolha válida para memória persistente. |
| Comparação `anm-comparison-v1` | Seleção expressa de até 3 slugs; leitura no arranque; recuperação de sessão antiga. | localStorage sem TTL. | Mesma análise de necessidade/duração; não afirmar que ser local basta para isenção. |
| Scroll `orbit-reload-position` | pagehide em rotas abrangidas: URL completo, x/y/time; leitura no arranque. | sessionStorage; só usado para restaurar com idade inferior a 60 s, sem apagar por esse limite. | Avaliar necessidade estrita desta conveniência automática ou consentimento/mudança de implementação. |
| Formulário | UUID/payload para retry numa WeakMap do formulário, sem nova persistência no navegador. | Memória do documento/formulário. | Contexto de envio solicitado/segurança, documentado separadamente da memória de preferências. |

Não foi instalado um banner decorativo nem alterados armazenamento, memória, scripts de arranque, consentimento, tracking, imagens ou gates. A pendência `storageConsent` foi adicionada, mantendo as anteriores pendentes. A escolha entre persistência com mecanismo válido e limitação da memória exige decisão humana/revisão jurídica antes da publicação.

## Implementação e camadas de informação

Três páginas canónicas com identidade visual partilhada: Informação legal (inclui RAL/Livro), Termos de utilização e Privacidade e cookies (inclui preferências). O rodapé tem estas três ligações e acesso direto ao Livro de Reclamações. Privacidade deixa de afirmar contactos fictícios ou bloqueio de envio por campos nulos. Não há promessa de segurança absoluta, prazo inventado, foro exclusivo ou cláusula de perda de direitos legais.

O aviso do formulário mostra finalidade/identidade comercial e ligação aos direitos. O estado de identificação jurídica pendente é visível no sumário; expansão contém responsável/contacto, percurso, destinatários, lacunas de fundamento/conservação e instrução de minimização. A política completa abre em novo separador para preservar o rascunho. Não se adicionou checkbox de aceitar política, consentimento de marketing ou subscrição. Honeypot, validação, sucesso verde, busy, retry e limites mantêm-se.

## Dados e decisões a recolher num único pacote

1. Identificação oficial: firma, forma jurídica, NIF/NIPC, sede; registo/conservatória e capital quando aplicáveis (ou justificação de não aplicabilidade).
2. Responsável e contacto de privacidade; confirmar finalidades/fundamentos por operação e eventual encarregado/representante se aplicável.
3. Entidade(s) RAL efetivamente aplicáveis, site/contactos e natureza da vinculação; registo e ligação do Livro de Reclamações.
4. Prestadores reais de hosting/CDN/DB/storage/correio/Resend, regiões, DPAs/transferências e configuração de tracking/logs. Não enviar credenciais no chat.
5. Prazos/critérios operacionais de email, CRM/notificações/leituras, logs e backups, e quem aplica a eliminação.
6. Decisão sobre memória persistente das preferências/scroll e mecanismo de consentimento/necessidade, com revisão da versão de produção. Nada foi removido silenciosamente para tornar os textos mais simples.

Só depois destas confirmações e das restantes verificações operacionais se pode fechar a preparação para publicação. Compilação, acessibilidade e testes de navegação são evidência técnica separada.

## Minimização e aplicabilidade — consolidação local

A identidade completa concentra-se em Informação legal; os termos remetem para essa página. Privacidade e recolha mantêm identificação/contacto suficientes do responsável e ligação à identidade central. Não há conclusão de não aplicabilidade sem factos do operador.

| Campo / localização | Obrigação e motivo | Facto em falta |
| --- | --- | --- |
| Nome/firma, NIF/NIPC, sede e email — Informação legal | Identificação acessível do prestador, DL 7/2004, art. 10.º. Contactos comerciais não substituem identidade jurídica. | Identidade oficial e sede. |
| Forma jurídica e registo/conservatória — menções societárias em Informação legal | Condicionais à natureza/registo: DL 7/2004, art. 10.º, e CSC 171.º. Não se presume sociedade. | Natureza do operador e registo efetivo. |
| Capital, realização, capital próprio ou liquidação — mesma secção, se exigíveis | CSC 171.º: capital para sociedades por quotas, anónimas e em comandita por ações; realização se distinta; capital próprio do último balanço aprovado se igual/inferior a metade do capital; liquidação quando aplicável. | Tipo societário e pressupostos; adaptar a menção após confirmação. |
| Licença, título/ordem e regras profissionais — apenas para atividade regulada | DL 7/2004, art. 10.º: requisitos condicionais. O código auditado não oferece crédito; não se inventa licença ou autorização universal. | Existência de atividade sujeita a autorização/profissão regulada. |
| Responsável e contacto — privacidade e aviso de recolha | RGPD 12.º/13.º: resumo necessário na recolha, sem repetir todo o bloco societário. | Responsável jurídico e contacto efetivo. |
| Encarregado/representante — privacidade, se aplicável | RGPD 13.º: contactos quando aplicáveis. Não se presume obrigação universal de nomeação nem dispensa sem avaliação. | Existência/designação e aplicabilidade. |
| Entidade RAL, site e vinculação — Informação legal#litigios | Lei 144/2015, art. 18.º. Lista geral não demonstra adesão. | Entidade(s) e vinculação efetivas. |
| Livro de Reclamações — rodapé e Informação legal | DL 156/2005, art. 5.º-B: acesso visível à plataforma. Comprovar registo operacional não exige expor um identificador de registo sem necessidade. | Registo e destino efetivo do operador. |
| Finalidades/bases, destinatários, conservação, direitos e transferências — privacidade | RGPD 13.º, conforme operações reais; sem repetir em termos ou identidade comercial. | Prestadores, critérios e configurações já pedidos. |

Fontes adicionais: [CSC, artigo 171.º, texto consolidado oficial](https://diariodarepublica.pt/dr/legislacao-consolidada/decreto-lei/1986-34443975-67194417) e [DL 74/2017, introdução do artigo 5.º-B](https://diariodarepublica.pt/dr/detalhe/decreto-lei/74-2017-107541411). Restantes fontes primárias acima. Não se pedem documentos pessoais, nomes de sócios/administradores, datas de constituição ou balanços completos como conteúdo público por rotina.

As rotas antigas devolvem 308 para `/politica-de-privacidade#preferencias` e `/informacao-legal#litigios`. Fragmentos não chegam ao servidor; o destino é a secção principal. Os identificadores úteis antigos também existem nos documentos canónicos para ligações diretas. Não há páginas antigas com metadata duplicada.

Mantêm-se os 16 valores oficiais nulos e as 22 verificações pendentes. O pacote acima é único; a natureza do operador determina as menções societárias exigíveis. Memória, recolha, consentimento e configuração preservados. Validação local: Svelte sem erros/avisos; 26 testes focados; três páginas em desktop/mobile e claro/escuro; redirecionamentos/âncoras; oito contextos de formulário com pedidos simulados e rascunhos preservados. Build e revisão em localhost são evidência técnica, sem resolver pendências legais.

Clarificação do proprietário: manter tema em localStorage e funcionamento da sessão existente. Esta preferência não constitui consentimento dos visitantes para todas as operações nem autoriza ampliar persistência/autenticação. Os tempos de conservação em falta dizem respeito sobretudo a pedidos/emails, avisos e leituras CRM, logs e backups; são distintos da duração da sessão e da preferência de tema. O proprietário permite propor prazos, mas a definição operacional e execução externa continuam pendentes. Não foi criada limpeza automática nem apagado dado real nesta consolidação.
