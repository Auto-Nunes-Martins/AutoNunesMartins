# Investigação de memória nativa das fotografias — 30/10/2026

Investigação separada da entrega responsiva. Não foi aplicado um fix ao processamento, alterado o allocator de produção, reiniciado Render ou instalada virtualização. Só os logs fornecidos pelo proprietário representam produção; não há acesso de profiling ao serviço.

## Evidência disponível

MB = 1000000 bytes. Horas dos logs fornecidos. Não somar RSS de processos como uso total do contentor, nem heap/external/arrayBuffers a RSS.

| Momento | Total cgroup | RSS backend | heapUsed backend | Contexto |
| --- | ---: | ---: | ---: | --- |
| 20:14:06 | 166,68 MB | 137,49 MB | 31,30 MB | Antes do lote, instância antiga |
| 20:15:36 | 394,43 MB | 353,89 MB | 27,59 MB | Upload ativo, 5 iniciados/4 concluídos |
| 20:16:06 | 467,57 MB | 418,78 MB | 27,74 MB | Upload ativo, 8/7 |
| 20:17:03 | 317,64 MB | 311,51 MB | 25,80 MB | Novo boot, já com 1 upload ativo |
| 20:21:03 | 400,49 MB | 368,34 MB | 27,79 MB | Idle, 2/2 na nova instância |
| 21:46:03 | 440,79 MB | 375,03 MB | 31,94 MB | Mesma instância, continuam 2/2 |

No último ponto, external = 7,19 MB e arrayBuffers = 3,39 MB; arrayBuffers está incluído em external. Em 85 min o backend cresceu cerca de 6,69 MB e o total 40,30 MB. O CRM passou de 89,86 para 114,89 MB RSS, o site de 91,61 para 97,24 MB e o gateway de 78,07 para 78,60 MB. Há crescimento fora do backend também; estes deltas RSS não decompõem exatamente o delta cgroup.

O limite observado foi 536870912 bytes = 536,87 MB. Ao último ponto restavam 96,08 MB pela leitura direta; o pico anterior de 467,57 MB deixava 69,30 MB. O novo boot não confirma OOM: faltam Events/exit status e o pico pode ter passado entre amostras. Também não confirma uma fuga de heap JS. Esperar não fez o backend regressar ao consumo anterior, mas a baseline de arranque da nova instância foi capturada já durante trabalho.

## O que o código permite concluir

- `photoOptimization.ts` já desliga a cache Sharp e limita `sharp.concurrency(1)`. A admissão cobre leitura, processamento e Storage, sem fila de corpos. `finally` remove os listeners e liberta a admissão. O diagnóstico só conserva números/UUIDs.
- `buildPhotoVariants` descodifica/redimensiona/codifica sequencialmente, com nova verificação de integridade dos derivados. Conserva os buffers comprimidos em `files[]` até `ensurePhotoVariants` terminar as publicações. Esse conjunto aumenta o pico vivo; não encontrei uma referência global aos rasters ou a esse array depois da operação.
- `PhotoByteCache` tem orçamento de 12 × 1048576 bytes = 12,58 MB. Mapas de manifests guardam metadata, e leituras pendentes são removidas ao concluir. Isto não explica sozinho centenas de MB com external baixo. A revisão não prova ausência de uma retenção em native code.
- Metadata sanitizada termina em `Buffer.concat`, não numa subarray persistente de um input grande. Input/master/derivados permanecem temporariamente vivos durante a operação; a receita e a validação não foram mudadas.
- O Dockerfile declara `node:22-bookworm-slim`. Isso aponta para o cenário glibc; não comprova a libc/allocator carregados no deployment observado.

## Hipóteses e como distingui-las

1. **Fragmentação/reserva do allocator nativo: prioridade alta, ainda não confirmada.** É compatível com o padrão RSS alto, heap e external pequenos depois do trabalho. A [documentação Node 22](https://nodejs.org/docs/latest-v22.x/api/process.html#processmemoryusage) descreve esse padrão em glibc. Não se calcula o tamanho da fragmentação subtraindo heapUsed de RSS.
2. **Memória ainda ocupada por libvips/codecs/pools/finalizadores: prioridade alta a média.** Desligar a cache de operações não obriga o allocator a devolver páginas ao sistema. Os contadores de [cache e concorrência Sharp](https://sharp.pixelplumbing.com/api-utility/) não medem toda a memória nativa; concorrência é por imagem. A [documentação libvips](https://github.com/libvips/libvips/blob/master/doc/libvips-memory.md) distingue alocações rastreadas de memória obtida por bibliotecas externas. Precisamos de perfil nativo ou estatísticas do allocator para separar bytes ocupados de páginas livres reservadas.
3. **Buffers/objetos JS ainda referenciados: prioridade menor com estes sinais, não excluída.** Comparar GC de teste, heapTotal, external e arrayBuffers com private anonymous RSS. Um exemplo de 24 MP ocupa 72 MB em RGB ou 96 MB em RGBA, antes de trabalho adicional; isto é dimensão teórica, não contagem medida de superfícies simultâneas.
4. **Aquecimento/retenção dos outros serviços e custos cgroup: investigação própria.** O aumento do CRM precisa de observação por rota/atividade; não atribuir esses 25 MB às fotos sem correlação. `memory.stat` e smaps ajudam a distinguir file/cache/anon/kernel, sem atribuir cada byte a uma função.

A [instalação Sharp](https://sharp.pixelplumbing.com/install/#linux-memory-allocator) reconhece o risco de fragmentação em glibc e recomenda avaliar outro allocator. A página de [performance](https://sharp.pixelplumbing.com/performance/#parallelism-and-concurrency) descreve a experiência com menos arenas. São candidatos a A/B num ambiente isolado, não uma autorização para ativar jemalloc ou `MALLOC_ARENA_MAX` em produção por suposição.

## Ensaio preparado e limites

`backend/scripts/native-memory-probe.mjs` usa fixtures sintéticas de 1976×1476, 3505×1948 e 2788×1830. Um processo separado gera os JPEG e termina antes da baseline do ensaio. O worker usa o optimizer/derivados reais, cache desligada e concorrência 1; não chama DB/Storage. O ambiente do filho tem uma whitelist sem credenciais e o fetch é bloqueado. Os ficheiros sintéticos ficam numa pasta ignorada própria; não há cleanup automático.

Compara 1 processo persistente com 1 processo exclusivo por imagem, estritamente em série. O pai não importa Sharp nem recebe buffers/pixels por IPC. Retém só até 3 hashes para comparar o resultado comprimido entre modos. Cada worker tem deadline; não se inicia outro antes do seu exit. O sampler conserva picos numéricos por fase, e regista heap/RSS/external, smaps do próprio PID, contadores Sharp, GC **só de teste** e cgroup. Os picos são separados por modo e não incluem a preparação das fixtures. Counters de memória Sharp são aproximados e convertidos para MB decimais; não representam todo o native heap.

Executar apenas numa cópia Linux descartável, sem `.env`/credenciais, com dependências já instaladas e quota representativa. Não executar no serviço real:

Requisito mínimo pendente: 1 ambiente Linux já disponível com Node 22 e as dependências deste lockfile para Linux (Sharp e tsx), uma cópia gravável do repositório sem segredos e nenhum serviço real ligado. Para comparar capacidade, aplicar ao ambiente de teste a quota observada de 536870912 bytes; um teste sem quota só investiga o comportamento do processamento. Não é necessário DB, bucket, conta de alojamento ou acesso a Render. As variantes de allocator usam apenas configurações do filho descartável. O ciclo de 11 imagens com idle de 30 s demora vários minutos por modo.

```sh
node backend/scripts/native-memory-probe.mjs --count=11 --idle=30000 > native-system.jsonl
node backend/scripts/native-memory-probe.mjs --count=11 --idle=30000 --arenas=2 > native-arenas2.jsonl
# Só se essa biblioteca já existir na cópia de teste:
node backend/scripts/native-memory-probe.mjs --count=11 --idle=30000 --jemalloc=/usr/lib/x86_64-linux-gnu/libjemalloc.so.2 > native-jemalloc.jsonl
```

Não há Docker disponível neste sistema e `wsl --status` informou que WSL não está instalado. Nada foi instalado ou reconfigurado. O mecanismo foi ensaiado em Windows com 3 imagens por modo, hashes iguais e todos os filhos terminados; isso **não mede glibc, quota Linux nem capacidade Render**. O ensaio Linux e o perfil de alocações nativas continuam por executar. RSS/smaps + GC e A/B do allocator podem sustentar uma hipótese, mas não substituem `malloc_info`/`mallinfo2`, estatísticas jemalloc ou um perfil de alocações no ambiente isolado quando for preciso provar ocupado versus reservado.

## Correção candidata, depois da medição

Se A/B mostrar que arenas/jemalloc reduzem de forma estável o private anonymous RSS sem regressão de pico, hashes, erros e latência, avaliar essa alteração mínima com os resultados. Se a retenção sobreviver ou a margem continuar curta, um processo por imagem oferece um limite de vida explícito para as alocações nativas.

Esse desenho precisa de ser medido antes de integrar: manter a admissão antes de ler o corpo; transmitir para um job privado e limitado, em vez de copiar o upload inteiro no pai e no filho; só 1 worker ativo e nenhuma fila de imagens; timeout/abort aguarda exit antes de libertar a admissão. Uma opção é o filho produzir master/derivados em ficheiros privados e terminar **antes** de o pai publicar 1 ficheiro de cada vez. Isso evita sobrepor o pico de codificação com buffers de todas as publicações no processo HTTP. Exige limites de disco, permissões, recuperação de falhas e uma política validada para esses ficheiros; não foi implementada em produção.

Manter checks atuais de acesso, hashes, staging/idempotência, manifesto por último e escrita atómica das referências. Medir o pico **total cgroup** pai+filho+CRM+site, sem somar RSS. `worker_threads` não fornece a mesma fronteira de libertação de um processo separado. O exit elimina os mappings privados do filho, mas o total pode conservar cache de ficheiros e memória dos outros serviços. Nenhuma destas propostas baixa qualidade, masters ou variantes para esconder o problema.
