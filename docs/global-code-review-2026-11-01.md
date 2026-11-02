# Revisão global do código — 1 de novembro de 2026

**Atualização de 2 de novembro: consolidação autorizada.** O proprietário autorizou
explicitamente o commit de todas as alterações pendentes relevantes do projeto e o push da
`main`. O texto e manifesto abaixo conservam o estado histórico da revisão, anterior a essa
autorização. Não constituem o inventário final da consolidação: a retirada de diagnósticos e o
lifecycle durável das fotografias estão descritos em `photo-process-isolation.md` e
`vehicle-photo-cleanup.md`. Os placeholders e pendências legais continuam por confirmar.

**Estado original: alterações locais na `main`, então pendentes de validação do proprietário.** Base:
`ad704756d822d8d83c264723c54f7ec2ffcd89dc`. Não houve stage, commit, push, PR ou deploy deste lote.
Este diff não deve ser incluído numa publicação de outro trabalho. A autorização anterior para
publicar fotografias/rascunhos/alertas não se estende automaticamente a esta revisão global.

O [manifesto de ficheiros](global-code-review-2026-11-01-files.json) separa alterações funcionais/de
verificação, formatação, clarificações de comentários e documentação. Guarda a base, os hashes e o
inventário rastreável. Não houve atualização de dependências, mudança de receita das fotografias,
migração de dados reais ou eliminação de ficheiros tracked. Não foram abertos ficheiros `.env` nem
impressos valores de segredos. As verificações HTTP e de base de dados utilizaram fixtures locais,
mocks e PGlite; não foram feitos uploads ou testes de carga em produção.

**Cobertura e limites da revisão**

A base contém 1 617 ficheiros tracked. O inventário de código elegível contém 835 ficheiros
TS/MTS/JS/MJS/Svelte/CSS nas aplicações, backend, shared, deployment e scripts. A passagem inicial
de formatação incluiu ainda dois ficheiros novos dessa primeira correção. Foram inventariados todos
os grupos; a revisão manual aprofundou os fluxos e fronteiras abaixo. Isto não equivale a uma
leitura manual linha a linha de todos os 1 617 ficheiros nem prova ausência de outros defeitos.

| Área                        | Cobertura aprofundada e evidência                                                                                                                                                                                                                                   |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Backend/API                 | Autenticação Clerk e ciclo de utilizadores, autorização de tarefas/pesquisa, dados Prisma, caches, operações de viaturas/vendas/despesas, transações, rascunhos e eliminações. Testes HTTP e serviços, incluindo propagação financeira e conflitos.                 |
| Fotografias/Storage         | Transporte, autorização pública/privada, escolha de variantes, manifests, sanitização, caches de bytes, workers, encerramento, limites e diagnósticos. A pipeline já publicada foi preservada e revalidada.                                                         |
| CRM                         | Hooks, sessões, relay autenticado, carregamentos/listas, navegação, formulários, rascunhos, previews, notificações, exportações CSV/PDF e componentes. Testes unitários, tipos, build e fixtures de browser.                                                        |
| Website                     | SSR e rotas públicas, fotografias/stream/fallback, galeria, prioridades/sizes, contactos, SEO/JSON-LD, movimento/scroll, timers, acessibilidade e dados legais pendentes. Testes unitários e galeria a 390/1440 px, com movimento normal/reduzido.                  |
| Shared/domínio              | Schemas, NIF, vendas, descrições HTML, enquadramento de fotografias, helpers UI, diagnóstico e memória. Preservação das condições/exports usados pelo runtime.                                                                                                      |
| Base de dados               | Schema e migrations por domínio, integridade, lifecycle, índices/limites e transações. Migrations e SQL exercitados apenas em bases locais isoladas; nenhuma mudança de schema neste lote.                                                                          |
| Deployment/configuração     | Docker canónico/compatibilidade, contextos de build, gateway, isolamento de headers, encaminhamento, timeouts, arranque/migrações, encerramento, healthchecks e variáveis por origem.                                                                               |
| Scripts/native/documentação | Entrypoints e consumidores por convenção, scripts de operação/teste, parser/addon de allocator, licenças e contexto operacional. Não se classificou documentação ou diagnóstico como lixo por ter origem num agente. O addon Linux não foi compilado neste Windows. |

**Lote 1 — visibilidade da pesquisa e caches limitadas**

- **P1 confirmado, corrigido localmente:** a pesquisa de tarefas não aplicava a regra de
  visibilidade dos endpoints de tarefas, e a chave de cache não incluía o ator.
  [search.ts](../backend/src/routes/search.ts) usa agora `taskVisibilityWhere(actorId)` e uma chave
  JSON com ator, pesquisa e limite. [task.ts](../backend/src/lib/data/task.ts) centraliza a regra já
  existente: tarefas próprias ou sem responsável (Geral). Não foi inventado um bypass administrativo
  nem alterada a política do histórico global.
- Criação, edição, estado, movimento, eliminação e limpeza efetiva de tarefas invalidam `search:`
  **depois do commit**. A desativação que liberta tarefas para Geral também invalida a pesquisa após
  a transação. Falhas/rollback não publicam estado intermédio. Os testes cobrem dois atores, Geral,
  estados, cache, revogação por mudança de responsável e chamadas sem sessão.
- [cache.ts](../backend/src/lib/data/cache.ts) limita valores e registos de operações pendentes a
  512 entradas, com TTL, LRU e deduplicação de carregamentos simultâneos. A invalidação e o
  encerramento usam identidade da operação; não foi criada uma tabela permanente de epochs. O
  excesso de operações pendentes continua a ser servido sem guardar novos registos, portanto isto
  não é um limitador de concorrência global.
- [storage.ts](../backend/src/lib/data/storage.ts) usa uma instância independente com até 2 048 URLs
  assinados e o TTL anterior de 40 minutos. A assinatura em lote mantém-se. Não se afirma que este
  mapa de strings explique a memória nativa das fotografias públicas.

Ensaio determinístico local contra o código da base: 20 leituras simultâneas da mesma chave passaram
de 20 chamadas ao loader para uma; 2 000 chaves distintas deixaram de reter 2 000 valores e retêm no
máximo 512. Os limites são por **número de entradas**, não um limite exato de bytes ou RSS. Evicções
podem aumentar pedidos quando o conjunto de trabalho ultrapassa o limite. A expiração sem tráfego
não exige um timer: a retenção em repouso continua limitada pela capacidade.

**Lote 2 — fronteiras de I/O, lifecycle e código sem consumidores**

- [storageClient.ts](../backend/src/lib/data/storageClient.ts) recebe apenas a construção lazy do
  cliente/bucket. `storage.ts` mantém os exports compatíveis e `photoVariants.ts` passa a importar o
  transporte diretamente. Remove o ciclo `storage → photoVariants → storage`, sem criar outro
  cliente, agente HTTP ou política de autenticação.
- Foram removidos os símbolos internos sem consumidores `getTaskById`, `createSignedUploadUrl` e a
  implementação de warmup já desligada (`preparePublicThumbnails`, fila e drain). A pesquisa incluiu
  imports, exports/entrypoints, rotas e scripts; a rota antiga de assinatura já estava retirada. Os
  campos históricos de diagnóstico mantêm-se. A remoção do warmup morto não é apresentada como uma
  nova poupança em produção: a chamada já tinha sido removida no lote anterior.
- [api.ts](../apps/crm/src/lib/server/api.ts) cancela o corpo da primeira resposta 401 antes de a
  substituir por uma repetição autorizada com token renovado. Preserva o corpo do erro final e não
  repete mutações. O fixture correspondente deixou de espalhar casts `any` e explicita a fronteira
  parcial de `App.Locals`.
- [notifications.ts](../apps/website/src/lib/notifications.ts) não inicia um timer para uma
  notificação que foi imediatamente descartada por uma fila de 20 notificações pausadas. Mensagens,
  ordem publicada, duração e ações mantêm o comportamento anterior. O teste verifica que não sobram
  timers depois de descartar novos avisos e destruir o host.

**Lote 3 — exportação separada do transporte e carregamento de PDF a pedido**

A rota de exportação do dashboard passou a tratar autenticação/parâmetros/resposta; a geração do
documento ficou em [dashboardPdf.ts](../apps/crm/src/lib/server/dashboardPdf.ts). Tanto essa rota
como [exports.ts](../apps/crm/src/lib/server/exports.ts) só carregam a biblioteca PDF quando é
pedido um PDF. Pedir CSV deixa de carregar esse motor. Não foram alteradas as linhas, colunas,
fontes, layout ou cálculos do PDF.

Dois documentos sintéticos, com relógio fixo, foram comparados com a implementação de `ad704756` e
ficaram byte a byte iguais:

| Documento |  Bytes | SHA-256                                                            |
| --------- | -----: | ------------------------------------------------------------------ |
| Dashboard | 10 196 | `e40b22fe166e9c19fe819872d9415b6f910910d892be54376810769b4553b42c` |
| Tabela    |  1 366 | `e0940d0ed41b49fa59bd0cde23c4a330d6c1bf06e44bc4939cc5e1060ef59f60` |

Em três processos Windows/Node 24 novos, a mediana da importação do módulo de exportação passou de
aproximadamente 385 ms para 4,6 ms. A diferença das medianas de RSS desses processos isolados foi
cerca de 12,2 MiB e de heap usado 5,5 MiB. São medições locais de **importação fria de um módulo**,
não o tempo total de uma página nem uma previsão do RSS de Render. O primeiro PDF continua a
suportar o carregamento do motor.

O CSV passou também a colocar entre aspas campos com CR isolado, além dos separadores/aspas/LF já
tratados. O conteúdo é preservado: por exemplo, um campo `A\rB` é agora delimitado corretamente. Há
testes de CR, LF, CRLF, aspas, BOM, números, telefones e zeros iniciais.

**Lote 4 — avatares fora do processo principal; receita de fotografias preservada**

O endpoint de avatares de avaliações ainda executava decode/resize/WebP no backend principal, apesar
de admitir imagens até 16 MP.
[reviewAvatarProcessor.ts](../backend/src/lib/server/reviewAvatarProcessor.ts) reutiliza a sessão
efémera existente e o novo job tipado `avatar`. O normalizador conserva a receita anterior: raster
estático, rotação, crop 128×128, WebP84, remoção de metadados e SHA-256. Não altera a receita
WebP84/effort6 das fotografias de viaturas.

A autenticação e a admissão continuam na rota; a admissão abrange receção, encerramento do child e
persistência. O resultado só fica disponível depois do `close`. Não há fallback pesado no parent
após uma falha do worker. Mantêm-se 5 MiB de entrada, 16 MP, 64 KiB de saída, validação de
formato/bytes/hash, um job em voo, ausência de fila, ambiente limitado e ausência de credenciais no
child. O job usa o deadline de 55 s já usado pela otimização e o lifecycle/guard existentes. O
override operacional explícito `PHOTO_PROCESSING_MODE=inline` mantém a semântica anterior; não foi
configurado nenhum novo ambiente de produção.

O resultado de orientação e alpha foi comparado também com o normalizador da base, com hashes
guardados nos testes. O worker real foi exercitado com essas imagens, o limite de 16 MP, dados
corruptos, SVG, animação e excesso de pixels/bytes. O protocolo simulado cobre timeout, crash,
resultado inválido e encerramento idempotente. O HTTP mantém 400 para imagem inválida, 413 para
excesso de bytes e 429 para admissão ocupada, assim como a versão/MIME pública. Falhas operacionais
novas do worker devolvem 502/503/504 com mensagens seguras, em vez de classificar uma imagem válida
como inválida; 503 inclui `Retry-After: 3`. Uma segunda operação é rejeitada enquanto o encerramento
ainda não terminou. O provider `native.codec` passa a contar também estas sessões de avatar quando
esta mudança for publicada.

Ensaio compilado local, três processos novos por modo/fixture, Sharp 0.34.5 e Node 24.14.0, sem GC
forçado:

| Fixture sintético        | Resultado igual     | Mediana de duração inline → isolado | Pico adicional do parent inline → isolado | Pico do child isolado |
| ------------------------ | ------------------- | ----------------------------------: | ----------------------------------------: | --------------------: |
| PNG 128×128, 35 703 B    | 398 B, mesmo hash   |                     4,32 → 165,9 ms |                  cerca de 1,21 → 0,57 MiB |       cerca de 58 MiB |
| PNG 4000×4000, 693 368 B | 3 846 B, mesmo hash |                     20,8 → 173,5 ms |                  cerca de 16,6 → 1,75 MiB |       cerca de 74 MiB |

**Contrapartida para validação:** isto contém o codec no child e reduz o pico do processo principal
neste ensaio, mas aumenta arranque, CPU e o custo total transitório de processos. No fixture de 16
MP, a CPU inline foi cerca de 16 ms e a CPU do child cerca de 124 ms; a granularidade da medição
Windows torna valores pequenos pouco precisos. O RSS do parent depois da operação foi semelhante
entre modos. Não há prova de redução da memória total, de retenção em Linux ou de que os avatares
expliquem as leituras públicas observadas. O script
[benchmark-review-avatar-isolation.mjs](../scripts/benchmark-review-avatar-isolation.mjs), com
`--compiled`, reproduz o ensaio após o build backend e conserva os ficheiros temporários sintéticos.

A compressão de viaturas foi avaliada separadamente com
[benchmark-synthetic-photo-encoding.mjs](../scripts/benchmark-synthetic-photo-encoding.mjs). Nos
dois fixtures 800×500, Q83 poupou aproximadamente 2,9%/3,9% e Q82 4,3%/8,3%, mas alterou pixels. A
recompactação lossless dos pixels já descodificados preservou-os e produziu ficheiros cerca de
15×/4,3× maiores. Estes fixtures não sustentam uma garantia de ausência de degradação visível em
fotografias reais. **A receita não foi alterada e não houve recompressão do Storage.**

**Lote 5 — legibilidade, verificação e consistência de deployment**

O conjunto atual, incluindo o seguimento do hero, tem 410 caminhos: 337 apenas de
formatação/clarificação de comentários, 71 de alterações
funcionais, testes ou ferramentas de verificação e dois documentos. Estas categorias são disjuntas;
a passagem global de 365 ficheiros formatados abaixo inclui também 30 do conjunto funcional atual.

Foi usado o Prettier instalado e bloqueado no projeto, versão 3.8.3, sem instalação ou upgrade.
Foram formatados 365 ficheiros, incluindo alguns com alterações funcionais. Em 25 componentes Svelte
só foram formatados script/style e conservado o template nessa passagem. As clarificações
posteriores de comentários estão identificadas à parte. `OrbitVisitStudio.svelte` foi preservado
porque a transformação proposta não passou a comparação do compilador. O manifesto identifica cada
caso e os hashes da passagem de formatação.

O verificador [check-review-format-equivalence.mjs](../scripts/check-review-format-equivalence.mjs)
compara a base com todos os ficheiros alterados que não pertencem ao conjunto funcional. Compara
AST, operadores, valores de literais, raw strings de tagged templates e diretivas; para Svelte
compila client e server, compara o JavaScript e o CSS com hash de scope fixo e verifica warnings.
Normaliza apenas diferenças sintáticas irrelevantes, como parênteses, aspas opcionais de chaves e
quebras de linha de templates sem tag. Isto evita tratar formatação como autorização para mudar
texto/whitespace visual.

Foram ainda separadas as justificações de oito comentários de acessibilidade dos códigos
`svelte-ignore`, preservando exatamente o output do compilador. Quatro outros casos ficaram intactos
porque a transformação candidata não passou a comparação estrita. Não foram retiradas proteções de
acessibilidade para silenciar o linter. `ignoreRestSiblings` explicita no ESLint do CRM a omissão
intencional de propriedades ao construir DTOs; o import morto de `publicPhoto` e uma referência de
tipo inline foram limpos.

O teste de deployment revelou um defeito já presente na base:
[backend/Dockerfile](../backend/Dockerfile) era apresentado como cópia compatível, mas faltavam o
build/test do addon allocator e `MALLOC_ARENA_MAX=2` já existentes no Dockerfile raiz. A
documentação `render-single-service.md` confirma que ambos usam o contexto raiz. A cópia foi
alinhada byte a byte ao canónico, sem alterar o ficheiro raiz, portas, segredos, schema ou flags de
Render. A consistência e os testes de arranque passaram; não foi feito um build Docker/Linux.

**Validação**

| Verificação             | Resultado                                                                                                                        |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Backend completo        | 643/643 testes                                                                                                                   |
| CRM completo            | 369/369 testes; após tipar o fixture do relay, os 13 testes desse módulo passaram novamente                                      |
| Website completo final  | 853/853 testes                                                                                                                   |
| Shared/types            | 37/37 testes                                                                                                                     |
| Shared + deployment     | 45/45 testes                                                                                                                     |
| Tipos                   | Backend sem erros; CRM e website `svelte-check` com 0 erros e 0 warnings                                                         |
| Builds                  | Backend TypeScript, CRM e website concluídos                                                                                     |
| Browser CRM             | 15 testes de rascunhos/notificações/eliminação aprovados, incluindo 390/1366 px                                                  |
| Browser galeria pública | 4 perfis aprovados: 390/1440 px × movimento normal/reduzido                                                                      |
| Bytes                   | Goldens/igualdade de PDFs e avatares, mais regressões existentes de masters/variantes/metadados                                  |
| Formatação              | Último guard: 242 scripts, 90 Svelte e 9 CSS; CabinReveal e os helpers CRM alterados depois foram reclassificados funcionais, sem repetir o guard global |

Ocorrências durante a validação: uma primeira execução concorrente teve timeout no fixture de
contacto; os testes isolados e a suite backend final passaram. As tentativas em sandbox de
sockets/browser tiveram limitações de loopback/Chrome, resolvidas com fixtures locais autorizadas e
o Chrome instalado. O primeiro build CRM compilou os módulos e encontrou EPERM a criar uma pasta
gerada; os ancestrais foram verificados sem reparse points e a repetição autorizada passou, sem
limpeza manual. O novo teste de timer tinha uma expectativa incorreta sobre a ordem antes de
`publish`; foi corrigido para o comportamento já existente e a suite website final passou. A revisão
independente identificou no primeiro patch de avatar a conversão incorreta de falhas operacionais do
worker em 400; esse defeito novo foi corrigido, com testes distintos para validação e 5xx e nova
verificação de tipos/build. A divergência de Dockerfiles foi um achado da base, não uma regressão de
formatação.

O ESLint global **não fica integralmente verde**. Permanecem usos de `any` em fixtures existentes,
descrições de `svelte-ignore` que o plugin instalado interpreta como códigos, casos de HTML
deliberadamente sanitizado/JSON-LD/SVG de repositório e warnings da análise de diretivas ou do modo
custom-element do plugin que não aparecem na compilação real da aplicação. Os módulos de produção
novos/alterados verificados passaram o lint focado. Não foram feitas atualizações de dependências
nem supressões globais para esconder estes diagnósticos. A tipagem, builds e equivalência do
compilador são verificações separadas.

**Decisões e oportunidades que ficam explícitas**

**CSV e folhas de cálculo:** a UI oferece “CSV / Folha de cálculo”; não foi encontrado um fluxo de
reimportação CSV. A correção de CR conserva os dados, mas não neutraliza fórmulas. Estes exemplos
sintéticos mostram a decisão que ainda existe:

| Entrada               | Campo CSV atual | Possível interpretação automática numa folha    |
| --------------------- | --------------- | ----------------------------------------------- |
| Texto `=1+1`          | `=1+1`          | Fórmula; pode mostrar `2`                       |
| Texto `+351912345678` | `+351912345678` | Número; pode perder o sinal inicial             |
| Texto `00123`         | `00123`         | Número; pode perder os zeros iniciais           |
| Número `-12.5`        | `-12.5`         | Valor numérico, que deve continuar numérico     |
| Texto com CR `A\rB`   | `"A\rB"`        | Um campo delimitado; o CR original é conservado |

Prefixar texto para Excel altera o conteúdo para outros consumidores, e aspas/apóstrofos não são uma
proteção universal. A decisão de oferecer uma exportação orientada a folha de cálculo como texto
literal precisa de validação do contrato; não foi aplicada silenciosamente.
[Referência técnica: OWASP CSV Injection](https://community.owasp.org/attacks/CSV_Injection).

- **Avatar:** validar conscientemente o isolamento com o custo de arranque documentado. É proteção
  do processo principal, não uma otimização de CPU ou prova de menor memória total. Se publicado,
  observar requisições reais normais e encerramento, sem nova carga artificial.
- **Fotografias:** baixar Q84 não foi justificado pelas fixtures. Validação fria por ETag/304 e
  evitar a releitura de uma fotografia preparada na gravação continuam a exigir contratos seguros de
  versão, autorização e prova de preparação; não basta confiar em headers/estado do cliente. A
  validação de integridade e a origem segura foram mantidas.
- **Leituras CRM:** o digest de revisão da lista varre versões de linhas para detetar inclusive
  alterações sem `updatedAt`. Substituí-lo por `MAX(updatedAt)` perderia invalidações; uma revisão
  material exige medição/índice ou desenho de revisão transacional, não foi improvisada uma
  migração.
- **Frontend/arquitetura:** existem componentes grandes, sobretudo `DesignEdition`, que partilham
  markup/CSS entre vistas. A revisão preservou as fronteiras e não introduziu layers vazias nem uma
  divisão mecânica que arrisque CSS scoped/DOM. Helpers de scroll já agregam leituras/escritas e
  respeitam cleanup/reduced-motion; caches de navegação já são limitadas e scoped ao utilizador.
- **Métricas web e memória:** não foi feita uma campanha de Lighthouse/Core Web Vitals nem um A/B em
  produção. Os checks locais de browser e compilação sustentam preservação do comportamento, não uma
  melhoria quantificada de LCP/INP/CLS. Nem estes ensaios nem os limites de caches demonstram que a
  retenção nativa das fotografias públicas desapareceu.

Os placeholders e pendências legais de `publication-readiness.md`/`publicationReadiness.json` foram
preservados. Testes/builds aprovados não significam aprovação legal, de dados ou de publicação. O
passo seguinte é a revisão deste conjunto concreto pelo proprietário; a publicação permanece
bloqueada até instrução explícita nesse âmbito.

**Seguimento — estabilidade inicial do hero e entrada das estatísticas (1–2 de novembro)**

A comparação cold com `ad704756` reproduziu a mesma contração da árvore local anterior à
correção: o defeito precedia a revisão global. A escala visual do cartão desconta 3,8808%
da sua altura natural, inclusive no mínimo desktop. Essa altura só era publicada por
`anchorStart` durante a hidratação; o primeiro layout usava o fallback zero. O header
manteve 80 px desktop e 76 px mobile.

| Viewport / DPR | Antes: altura inicial → hidratada | BUILD3: primeira pintura → hidratada |
| --- | ---: | ---: |
| 1440 × 950 / 1 | 705,859375 → 684,515625 px | 684,515625 → 684,515625 px |
| 390 × 950 / 1 | 587,8125 → 573,5 px | 573,5 → 573,5 px |

Foram isolados três problemas, com provas diferentes:

- **Reserva tardia:** a primeira tentativa no inline existente no fim do body passou os
  perfis de hidratação, mas falhou quando o HTML foi entregue em partes. No mobile, a
  primeira pintura ocorreu aos 116 ms, antes da cauda aos 333,7 ms; o hero ainda contraiu
  14,3125 px. Esse resultado impediu um fecho prematuro.
- **Pulso do fundo:** na página local real, Svelte substituía o `style` do root durante a
  hidratação. A ação lia a altura sem o desconto e só depois repunha a variável. O canvas
  guardava 705,859375 px enquanto o root já tinha 684,515625 px; o fundo passou de
  838,515625 para 859,859375 px e voltou num frame. O root permanecia estável, pelo que
  observar apenas CLS/altura do hero não detetava o movimento.
- **Salto dos rótulos:** os textos das estatísticas já estavam visíveis na posição final
  quando a entrada do pai começava em `translateY(12px)`/opacidade 0,35. O teste contra
  BUILD2 detetou o rótulo de 891,515625 para 903,515625 px, sem mudança do hero/fundo.
  `OrbitStats.svelte` não tinha diferenças contra a base antes desta correção.

O bootstrap em `assets/orbit-startup.js` observa brevemente a montagem inicial do hero a
partir do head. Um marker no último filho fora do fluxo identifica o conteúdo mensurável
completo. A reserva é publicada quando as folhas CSS ativas estão disponíveis; um
`ResizeObserver` acompanha alterações reais durante parsing, usando a altura natural
arredondada e evitando escritas repetidas. O `MutationObserver` desliga no marker; o
observer de tamanho e o listener de CSS desligam em `DOMContentLoaded`. Não há novo
pedido de rede, timer, polling ou API global. O inicializador de scroll/navbar mantém o
seu lugar. `anchorStart` repõe a reserva antes de ler o canvas durante a hidratação.

A fórmula, o mínimo desktop, a escala, o recorte e as animações do hero foram mantidos.
Uma wrapper Grid fracionária isolada não reproduziria exatamente o ramo do mínimo que
decresce com a altura natural do cartão; não foi aplicada uma aproximação silenciosa.
O conteúdo mensurável ainda incompleto não é apresentado como um estado final garantido.

Nas estatísticas, a pose pré-entrada coincide agora com o início da animação, preservando
o percurso de 600 ms e o estado final. O sinal nasce no head apenas quando existe
`IntersectionObserver`, para não transferir o salto para o inline tardio. Movimento
reduzido, ausência desse observer e cancelamento da entrada terminam sem deslocamento
e com opacidade 1. Até BUILD3, a borda, os valores e a contagem não foram alterados.
A decisão posterior de retirar apenas a linha superior está registada abaixo.

**Verificação das correções de carregamento (BUILD3)**

- 44 testes focados de tema/startup, scroll e prioridade de fotos; `svelte-check` com
  zero erros/warnings; BUILD3 SSR/client/adapter-node aprovado.
- 16 perfis do build: 1440/390 × 950, DPR 1, fontes 0/+650 ms, movimento normal/reduzido,
  cold/reload, scripts +1500 ms e imagem sintética +1000 ms. Alturas, fundo, secção
  seguinte e entrada dos rótulos estáveis, sem erros de browser.
- Quatro perfis isolados do componente real: observer ausente, movimento reduzido,
  contagem normal completa e normal → reduzido → normal. Valores finais, posição,
  opacidade e fim das animações aprovados. Isto não afirma que os restantes componentes
  do website suportam ausência de `IntersectionObserver`.
- Cinco perfis progressivos persistentes: duas larguras × CSS 0/+650 ms com corte após
  o hero, mais mobile com corte após as estatísticas. A cauda foi atrasada 1200 ms;
  o SHA do HTML original e da junção das partes é igual. A reserva precedeu a primeira
  pintura e esta precedeu a cauda. Os rótulos e o cartão não saltaram para baixo;
  a opacidade do cartão não recuou. A asserção adicional de opacidade dos rótulos foi
  validada offline nos mesmos 21 registos do website, sem nova navegação.

Comandos a partir de `apps/website`, depois do build, usando o browser de testes instalado:

```text
node test/heroLayout.browser.mjs
node test/heroLayout.browser.mjs --stream
node test/orbitStats.browser.mjs
```

O modo progressivo reutiliza a fixture e o harness, através de `test/progressiveHero.mjs`.
O parser é resolvido pela dependência declarada de `@anm/types`; o compilador da fixture
isolada vem da toolchain Vite existente. Não foram instaladas dependências. Os artefactos
ficam em `.svelte-kit`; os scripts encerram apenas os seus processos/browser.

Na prova progressiva instrumentada anterior ao harness persistente, a primeira reserva
precedeu o primeiro paint nos quatro casos: 111,3 < 444 ms e 735,7 < 776 ms desktop;
95,7 < 136 ms e 723,5 < 756 ms mobile. São timings de uma fixture com atraso artificial,
não ganhos de FCP/LCP atribuíveis a produção. A prova adicional com estatísticas no
prefixo mostrou 128 frames já pintadas antes do inline: os rótulos começaram e iniciaram
a animação em 753,453125 px, terminando em 741,453125 px, sem salto descendente. Uma
asserção auxiliar confundiu `transform` com a propriedade individual `translate`;
o log desse ensaio foi preservado e os mesmos frames passaram um validador geométrico
separado, antes da regressão persistente de cinco casos também passar.

Na navegação real local, PATCH2 manteve o fundo em 838,515625 px durante 1431 frames.
Uma recarga no mesmo contexto isolado, com cache ativa, a 2560 × 1440/DPR 1 manteve
hero 769,171875 px, fundo 923,171875 px e estatísticas de 152 px, sem LayoutShift/erros.
Esse viewport foi uma hipótese QHD/100%; não se abriu o perfil pessoal Brave. Um GET
posterior confirmou que o inline servido em `localhost:5173`, o source e o bootstrap
embutido no BUILD3 têm o mesmo conteúdo normalizado. Não foi necessário restart.

**Fontes, visual e limites que permanecem explícitos**

O pulso real do fundo não foi causado por troca de fonte: CDP manteve Inter Medium no
título e Inter SemiBold na navegação/preço antes/depois. Em fixtures Vite separadas,
a remoção/reinserção dos estilos SSR produziu casos Inter → Arial, apesar de o valor
CSS de `font-family` permanecer igual. O build de produção não apresentou essa reinserção:
com fontes rápidas os três alvos usaram Inter; com atraso sintético usaram Arial em
ambos os lados do A/B. As faces Orbit usam `font-display: optional`; um preload ajuda
o ficheiro a chegar cedo, mas não obriga a substituir o fallback depois de o browser
decidir mantê-lo. [CSS Fonts 4](https://drafts.csswg.org/css-fonts-4/#font-display-desc).
Não foram alterados ficheiros de fontes, métricas, preloads ou tipografia.

Os valores residuais de CLS das fixtures Vite anteriores (0,00181723 desktop /
0,00274205 mobile) não devem ser confundidos com o pulso geométrico real. Um A/B do build
com animações sincronizadas deu zero pixels diferentes no caso mobile/fontes atrasadas;
o caso desktop equivalente teve 306 pixels diferentes em 1 368 000: 282 nas duas linhas
de rasterização do sublinhado de “Explorar viaturas” (uma linha abaixo no fixed) e 24 no
pequeno ponto antes do nome do stand. O resto dos pixels coincide; os registos de geometria
adjacentes também coincidem. A causa desta diferença decorativa de 1 px não foi fechada.
As capturas font0 foram sobrescritas pelo harness, pelo que não sustentam igualdade de
pixels. Não se afirma CLS global zero nem identidade visual universal a partir de
capturas em fases diferentes das animações.

A linha horizontal hero/estatísticas permaneceu presente e constante no CSS e nos
registos medidos. Uma fixture offline com a floresta fixa comparou pré-entrada,
0/100/300/600 ms e estado final dos stats, em DPR 1 e 1,5: a faixa de 9 px da fronteira
teve zero pixels diferentes. Alterar apenas os dígitos também deu zero diferenças.
Fixando os stats e avançando a floresta, mudou a aresta fracionária superior, mas as
linhas 880–884 permaneceram iguais. Não se demonstrou oclusão da borda pelos números.
As duas primeiras capturas humanas não tinham enquadramento/scroll sincronizados.
A gravação Gyazo enviada depois confirmou o desaparecimento abrupto: após o refresh
aos 2,43 s, a borda superior ainda está visível aos 4,00 s e passa a textura florestal
aos 4,05 s, no primeiro frame com números. A borda inferior e os limites do bloco
mantêm a posição. Um controlo offline que mudou apenas o canvas de absolute para
fixed, com geometria e animações fixas, não reproduziu a mudança; a causa de composição
não foi demonstrada. Estes controlos não foram usados para negar a evidência do vídeo.
Evidência adicional:
`C:/Users/Goncalo/.codex/visualizations/2026/11/01/01a194ad-57c4-7880-aafe-c245e44e662d/stats-edge-offline-results.json`
e `stats-edge-digit-results.json`, `gyazo-edge-metrics.json`, `gyazo-gif-metrics.json`
e `stats-pin-offline-results.json` na mesma pasta.

**Decisão explícita do proprietário — retirar a linha superior (2 de novembro)**

O pedido “Olha, podes remover essa linha simplesmente” substituiu a investigação da
causa visual. Em `OrbitStats.svelte`, a borda superior conserva a espessura de 1 px,
mas fica transparente; no mobile foram retirados a cor e o pseudo-elemento que
desenhavam a mesma linha superior, incluindo o seu brilho. A borda inferior desktop,
o pseudo-elemento inferior mobile, os valores, a contagem e as animações permanecem
intactos. A alteração não elimina espaço de layout nem usa a borda para mascarar um
reflow. O source anterior foi preservado e o seu SHA coincide com o manifesto BUILD3.

Após esta alteração, o build SSR/client/adapter-node e `svelte-check` passaram novamente
(zero erros/avisos). Uma comparação isolada dos sources anterior/atual a 1440 e 390 px
confirmou caixas, alturas, paddings e espessuras exatamente iguais: 152 px desktop e
116,203125 px mobile nesta fixture. O topo passou a transparente, a linha inferior
permaneceu igual e as quatro montagens terminaram com 15/500+/2500+/24h, opacidade 1
e zero erros. Um GET apenas do HTML de `localhost:5173` confirmou o CSS novo servido,
sem restart nem pedidos de media. A matriz de 25 perfis BUILD3 não foi repetida para
esta mudança apenas de pintura. Evidência: `stats-line-removal-results.json`,
`stats-line-removal-main5173-check.json`, logs e PNG antes/depois na pasta do executor.
As capturas isoladas iniciais de fundo branco foram preservadas e complementadas por
quatro PNG com sufixo `-dark`, usando a paleta escura real. A linha superior passa de
mediana R 46 para 12 no desktop e de 145 para 13 no mobile; a inferior mantém 51 e 47,
respetivamente. Caixas, espaços e valores continuam iguais. Esse complemento visual
está em `stats-line-removal-dark-results.json`, com logs e capturas na mesma pasta.

A troca para o modelo longo continua a aumentar a altura em 35,046875 px desktop e
20,453125 px mobile, como na base. Reservar a caption maior desde SSR aumentaria a
altura da primeira viatura; essa mudança foi separada da correção de carregamento.

Artefactos principais de BUILD3, anteriores à remoção da linha: `apps/website/.svelte-kit/hero-layout-1793578135822/`,
`stats-entry-1793578289194/` e `hero-stream-1793578876794/`, cada um com `results.json`.
A evidência externa original, os reds específicos e as capturas permanecem em
`C:/Users/Goncalo/.codex/visualizations/2026/11/01/01a194be-f71d-77b2-9d6c-1194d2fbf98c/`,
incluindo `hero-shift-probe*.json`, `hero-real-5173*.json`, `hero-stream*-results.json`,
`stats-stream-build3-results.json` e os respetivos logs. As matrizes usaram dados sintéticos
e recursos locais; as verificações reais foram navegações locais normais, sem mutações.
Não foi fornecido relatório Lighthouse nem feita campanha de utilizadores em produção.

**Seguimento das imagens — medição local e correção limitada, 2 de novembro**

O perfil Node anterior à otimização usou 1707×900, DPR 1,5, cache HTTP normal e uma
fixture de fotografia PNG 3072×1024, sem requests externos. No cold, o destaque pediu
1280 e depois 2560; os corpos sintéticos foram 8230 e 30970 B. Os dois pedidos 1600
pertenciam aos cartões inferiores, não a uma terceira aquisição do destaque. No reload,
as fotografias tiveram três 304, sem corpo. Estes PNG não medem os bytes das fotos reais.

Os assets reais locais transferiram 1 762 350 B no CDP cold e zero no warm: a floresta
AVIF 2880 representou 1 221 963 B de corpo, com preload reutilizado; os dois CSS Brotli
somaram 40 339 B de corpo, os 13 JS Brotli 142 215 B e as cinco fontes 119 516 B.
O catalog-portrait AVIF de 211 802 B começou antes do LCP, embora estivesse abaixo do
viewport. Isso é uma observação de carregamento, sem demonstrar que adiar a imagem
melhora a experiência. HTML: 157 450 B de corpo, sem encoding nesta fixture Node.
O LCP foi a floresta, 464 ms cold/148 ms warm; estes tempos de localhost não são
Lighthouse, produção nem prova do custo do backend.

Um segundo controlo passivo, sem leituras repetidas de geometria ou naturalWidth,
confirmou 1857 mudanças de `sizes` nos três objetos de foto durante cerca de 4,8 s,
com 619/620/620 chamadas a `decode`, mas apenas quatro pedidos de fotografia. O ratio
recalculado a partir de naturalWidth/naturalHeight inteiros, corrigidos por densidade,
realimentava o arredondamento ao alterar `sizes`. Não se equiparam essas chamadas a
downloads ou a descodificações físicas, nem se atribuem os long tasks medidos ao ciclo.

A correção reutiliza as dimensões versionadas já carregadas no stock, apenas quando
slug, índice e URL da foto coincidem. Não acrescenta consultas, Storage, enrichment
backend, payload serializado ou recompressão. O destaque e o preload usam o mesmo
helper SSR de cover; retratos e fontes sem hint conservam o sizes inicial anterior.
A action partilhada prefere metadados válidos e, no fallback, conserva um ratio
conservador por src/srcset, invalidado quando muda o recurso, numa falha ou placeholder.
Não infere a foto real de um data/blob temporário. Os cartões recebem os hints que já
tinham disponíveis. Srcsets, larguras disponíveis, WebP84, dimensões HTML, recortes,
animações e interação não foram alterados. O perfil after confirmou um único pedido
2560 de prioridade alta no destaque, sem o 1280 anterior: três pedidos 200 de fotos
no cold em vez de quatro e dois 304 no warm em vez de três. O corpo final 2560 continua
com os mesmos 30970 B sintéticos, versão e ETag. Cada um dos três objetos teve apenas
uma mudança de sizes e duas chamadas decode, sem ciclo durante 4,8 s. As caixas dos
cards coincidiram exatamente; a diferença subpixel do hero foi inferior a 0,5 px,
sem sincronização da animação idle, pelo que não se declara igualdade de pixels.
O JS real cresceu 576 B Brotli; fotos, floresta, CSS e fontes permaneceram iguais.

Validação deste patch: 110 testes em 11 ficheiros, `svelte-check` com zero erros/avisos
e build SSR/client/adapter-node concluído. Um primeiro build falhou com EPERM numa
pasta gerada; a repetição autorizada passou, sem cleanup manual. Logs
`hero-photo-performance-unit.log`, `hero-photo-performance-svelte-check.log` e
`hero-photo-performance-build-elevated.{stdout,stderr}.log` na pasta externa deste agente.
Os testes cobrem hints incompatíveis/inválidos, novas fontes/srcsets, erro/placeholder,
fallback estável, resize e teardown, além das suites de sessão/galeria/miniaturas.

O proprietário ampliou a verificação aos restantes percursos. Mapa de execução atual:

- Destaque: `FeaturedPhoto` e preload em `HomeHeroDirections`; cards de homepage,
  catálogo, favoritos e relacionadas: snippet `vehicleCard` em `DesignEdition`.
  Ambos usam `coverPhotoSizes`; o ciclo foi medido no destaque e nos cards.
- Galeria pública com fotografias: `VehiclePhotoRail` → `publicGalleryPhoto` →
  `publicGallerySession`, sem `coverPhotoSizes`. Principal, miniaturas, slide de
  contacto e fullscreen partilham a sessão. Todos os preloads da ficha usam
  `galleryPhotoSizes`; um upgrade do slide ativo no fullscreen só é pretendido quando
  acrescenta pelo menos 20% de resolução útil. A primeira tentativa teve um seletor
  errado no harness; a retoma por teclado nativo completou os percursos descritos abaixo.
  A ocorrência de `coverPhotoSizes` na principal de `DesignEdition` é apenas o ramo
  alternativo ilustrativo/sem fotos; a detail-band também usa a action.
- Fundos ativos: hero, `DiscoverVehicles`, `ScenePhotograph` na pausa/visita e
  `CabinReveal`. `coverImageSizes` usa ratios explícitos, sem o feedback naturalWidth.
  `/quem-somos` usa duas fotografias picture AVIF/WebP; `/comparar` usa `publicThumbnail`.
  Logos, mapas e avatares têm fontes próprias. A presença de vários elementos não
  demonstra várias transferências; pedidos por largura, versão, cache e uso serão
  distinguidos de upgrades e lazyloads necessários.

Artefactos before/passivo: `hero-performance-node-fixture-{results,compact,network-totals}.json`
e `hero-performance-passive-control-{results,summary}.json` na pasta do executor.
O after está em `hero-performance-passive-after-{results,compact,summary}.json`.
O proprietário esclareceu que pretendia acelerar, não suspender a vistoria, e incluiu
o CRM. A cobertura foi retomada: `image-consumers-keyboard-results.json` e o summary
homónimo registam 15 passos, sem pageerrors. Entrada direta carregou 2560/1600/1600;
troca de foto, abertura/fecho/reabertura do fullscreen e resize não acrescentaram
pedidos nesse percurso. O caso sem hint fez um upgrade útil de 1600 para o master
nativo 2400, acrescentando 50% de resolução, sem ser classificado como desperdício.
A entrada por card reutilizou o 2560 em cache; um 304 da relacionada não transportou
novo corpo. Homepage completa, Quem somos e Comparar usaram AVIF sem duplicação WebP.
Os ficheiros `image-consumers-current-results.json` e `image-consumers-complete-results.json`
preservam tentativas incompletas do harness, não o resultado final. A interceção de
hit-test impediu o clique na fixture; o percurso final usou teclado nativo. Não foi
demonstrado um bug de pointer no produto. O card 1600 low em corrida com o hero 2560
continua uma oportunidade incerta; não se mudou essa política por suposição.

**Junção do livro — correção isolada e verificação pontual**

Em `CabinReveal.svelte`, foi acrescentado apenas `transform-style: preserve-3d` a
`.cabin-panel`; o restante source foi confirmado byte a byte pelo agente responsável.
O executor compilou o source atual em memória, sem usar o build anterior como prova,
e comparou a mesma página retirando/aplicando a propriedade. O primeiro perfil,
desktop 2266 CSS/zoom 1,5/tema claro/DPR 1, confirmou os progressos intermédios.
O executor detetou que o foco nos hotspots ativava `:focus-within` e forçava os três
perfis seguintes a permanecer planos. Corrigiu apenas o harness, limpando esse foco
e verificando o unfold efetivo, e repetiu desktop escuro e mobile 390 CSS/zoom 1 nos
dois temas. Com o primeiro desktop claro válido, os quatro perfis confirmaram 0,9
real, opacidade 0,5 a 0,9995 e 1 no final; geometria, recorte e transforms iguais,
hotspots/teclado/aria/descrição funcionais, reduced-motion plano e zero pageerrors.
As capturas finais não mostram fuga na junção amostrada. O primeiro desktop claro
não foi repetido. O JSON inicial foi sobrescrito pelo harness; não se afirma que
existe um registo JSON original completo. A proveniência está em
`cabin-quick-final-summary.json`; os três controlos corrigidos estão em
`cabin-quick-validated-results.json` e `cabin-quick-validated-*.png`, mantendo as
capturas e stdout iniciais do desktop claro.
É um componente isolado com progresso fixado, não uma prova de scroll real no Brave
ou no perfil pessoal do proprietário. Os artefactos estão na pasta do executor.
Não foi repetido o build global após esta
linha; o build aprovado acima refere-se ao patch das imagens. Todos os runtimes
próprios terminaram. O conjunto permanece apenas na main local, sem stage, commit,
push ou deploy, para validação do proprietário.

**Fecho da vistoria de imagens — website e CRM**

Cobertura dos consumidores ativos, por rastreio de imports/rotas e fixtures
representativas; não significa ensaio de todos os dados, dispositivos ou fornecedores:

| Consumidor | Cobertura efetiva e resultado |
| --- | --- |
| Website: destaque e cards | Cold/warm passivo e correção acima; catálogo/favoritos/relacionadas rastreados ao mesmo snippet e helper. Sem visitas separadas a todas essas rotas. |
| Website: galeria, miniaturas, fullscreen, handoff | 15 passos no Node build local, incluindo entrada direta/card, navegação, reabertura e resize. Reutilização observada; upgrade útil preservado. |
| Website: fundos, Cabin, pausa/visita, fachadas e comparação | Full-scroll homepage/Quem somos/Comparar; AVIF sem cópia WebP adicional. Cabin tem a prova geométrica isolada própria. Logos, mapas e marcas também rastreados no código. |
| CRM: listas/dashboard, galeria, pickers e editores | `VehicleTable`/`StockAgingTable` usam thumb assinada 320 e fallback; `PhotoGallery`, `HomepageHighlightsEditor`, `WebPublicationPanel`, pickers/framing partilham `reusablePhoto`. Fixtures de componentes/helpers em 23 passos confirmaram partilha, fullscreen sem pedido extra e fallback único. |
| CRM: rascunhos/preparação/upload | `VehiclePhotoDraft`/wizard/edição rastreados; preparação serial, limites e worker terminado preservados. Browser local verificou passthrough, falha/recuperação do cover e revogação; abort/races/conversão/HEIC/limites cobertos em testes focados. Não houve upload ou gravação real. |
| CRM: logos, destaques, avatares/reviews | Wordmark descarregou uma vez cada logo 360; troca de tema sem pedidos. Dois slides do destaque carregaram 1600 e next não pediu mais: pré-carga útil no ensaio, mantida. Sidebar/conta partilharam um avatar; review 128 fez um pedido, com mocks e sem Clerk real. Ciclos de preview/revogação foram lidos nos consumidores de conta/reviews/toast. |
| Assets e fronteiras externas | Marcas SVG/PNG locais partilhadas pelas apps; import eager de URLs não significa download de todas as imagens. Login CRM tem Unsplash w1600/q85: apenas leitura de CSS/código, sem medição remota; oportunidade responsive ainda não comprovada, pois o ratio real não foi verificado. URLs assinadas/provider/cache não foram alterados. |

Foram corrigidos dois caminhos comprovados em `reusablePhoto`: fallback iniciado
depois de desmontar o último consumidor e nova tentativa/decode do mesmo master
quando outro candidato falhava no resize. A partilha é por URL dentro do mesmo Photo;
o grupo é descartado ao sair o último consumidor, permitindo recuperação no remount
ou com nova identidade. Retry blob continua limitado a uma repetição. A prova browser
confirmou candidato 800 com 404 → master 200, candidato 1600 com 404 sem segunda
atribuição/decode do master; desmontagem antes da falha não iniciou master; remount
recuperou. Os testes também protegem o consumidor que permanece e fullscreen útil.

O rascunho criava outra URL após a preparação mesmo para bytes iguais. O worker passa
a sinalizar apenas o passthrough validado, permitindo a `preparePhoto` devolver o
File original. O Draft conserva a URL existente nesse caso; conversões, URL ausente
ou cover já falhado continuam a substituí-la. No PNG local 320×200/1416 B, SHA e bytes
permaneceram iguais: URLs 2→1, atribuições src 9→6, chamadas decode 10→6, sem HTTP.
Isto mede chamadas, não descodificações físicas nem cópia de backing storage. A prova
de recuperação revogou a primeira URL e atrasou o worker 350 ms: o cover falhou ainda
sem preparação e recuperou com uma segunda URL; todas as URLs foram revogadas ao
desmontar e não houve pageerrors. Receita, pixels, EXIF/orientação, limites e envio
para o backend permanecem iguais.

Verificação CRM: dois conjuntos focados de 22 testes (35 casos distintos entre ambos),
checks com zero erros/avisos e um build final SSR/client/adapter-node concluído. O
worker emitido tem 3241 B, contém o sinal passthrough e conserva import dinâmico do
decoder; este tamanho de ficheiro não é transferência medida. Não se repetiram as
suites globais anteriores. Logs `crm-photo-lifecycle-*`, `crm-photo-passthrough-*` e
`crm-image-final-build.{stdout,stderr}.log` na pasta deste agente; a validação passthrough
é um resumo identificado do resultado da ferramenta, não um log bruto inventado.

Evidência browser: `crm-image-consumers-{results,summary}.json`, `crm-draft-files.json`
e `crm-draft-final-summary.json` na pasta do executor. Fotos PNG e avatares são fixtures;
não representam o tráfego real, autenticação Clerk, CRUD, uploads ou todos os perfis.
A vistoria dos percursos ativos e helpers está concluída com esta representatividade,
sem promessa de otimização total ou ausência de todos os bugs. Não houve requests de
produção, alteração de masters/qualidade WebP84, restart, stage, commit, push ou deploy.

**Falso estado alterado na edição CRM — C200 / S-Max**

A comparação de exatamente dois registos por leitura, reproduzidos com dados
sanitizados numa fixture offline, isolou uma única diferença: publicDescription do
C200 tinha quatro espaços nas margens do primeiro e último parágrafos. O parser
Tiptap removia esses espaços e setEditable, por omissão, emitia update mesmo com
docChanged:false. DescriptionEditor publicava então o HTML normalizado como input:
Guardar, hasUnsavedForms e beforeunload ficavam ativos sem interação. O S-Max não
tinha essa diferença de espaços e permanecia limpo. Não era TrailingNode, fotografias
ou campos financeiros. O mesmo mecanismo existe no source da release ad704; não
foi introduzido pela auditoria local.

DescriptionEditor passa setEditable(!disabled,false) e preserva whitespace tanto
no parser inicial como em setContent. Baselines, guards e TrailingNode permanecem
iguais. O teste persistente usa texto sintético equivalente no harness existente,
sem incluir registos reais no repositório.

AFTER com os mesmos dois payloads: zero diferenças ao montar, zero updates/inputs
automáticos e os três estados desativados. Em cada um, sete estados verificaram
abertura limpa, edição/reversão do modelo, edição/Undo da descrição e negrito/Undo.
Edições reais ativam Guardar e proteção de saída; reverter/desfazer limpa-os. Undo
restaura o texto original, incluindo os quatro espaços. Paths das fotos e framing
mantiveram-se iguais; não foi repetida uma suite de interação de fotos.

O teste focado persistente passou 2/2, sem falhas; svelte-check CRM deu zero erros
e avisos; build final CRM SSR/client/adapter-node passou. Não se repetiram suites
globais nem medições de memória. Artefactos vehicle-dirty-{before-reproduction,
causal-diff,after-reproduction,after-checks,final-validation}.json na pasta do executor;
logs crm-dirty-final-build.{stdout,stderr}.log na pasta deste agente. A fixture
mascara texto e identificadores, conservando markup, espaços, entidades e comprimento;
sem autenticação real, CRUD, gravações ou pedidos Storage. O AFTER não fez nova
consulta. Todos os runtimes próprios terminaram. Apenas main local, sem stage,
commit, push ou deploy.
