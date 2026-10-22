# CRM: carregamento e navegação

Investigação local em 21 de outubro de 2026.

## Causas confirmadas e alterações

- O detalhe aguardava viatura, galeria e destaques em sequência. Agora só a viatura bloqueia a resposta; galeria e destaque são pedidos em paralelo e enviados por streaming, com estado de carregamento e erros visíveis. Falhas de autorização continuam a ser erros, não listas vazias.
- A lista lia manifestos em ondas de quatro e assinava miniaturas e originais separadamente. Lista e stock antigo da dashboard usam agora uma assinatura em lote para miniaturas e originais de fallback. A galeria também assina todas as fotografias e variantes numa chamada.
- Manifestos de masters imutáveis eram reutilizados apenas durante 60 segundos. Passam a 40 minutos, com partilha de pedidos concorrentes e invalidação explícita na geração/eliminação. Ausências 404 são reutilizadas por 60 segundos; falhas transitórias mantêm 5 segundos. A leitura em lote tem até oito trabalhadores e elimina caminhos repetidos.
- O diálogo fechado da galeria incluía uma imagem com o original. A imagem só entra no DOM ao abrir o visualizador; a pré-visualização continua a usar variantes responsivas.
- O layout comum aguardava `/api/me` antes dos dois contadores. Os três pedidos autenticados passam a arrancar em paralelo; uma falha temporária de um contador não apaga o outro.
- O detalhe voltava a consultar o total de despesas que já estavam incluídas na consulta da viatura. Soma agora essas linhas com Decimal, preservando os cálculos financeiros e evitando uma consulta redundante.

## Medições reais

Amostra de 25 viaturas, 15 capas, todas com variantes WebP. Leitura sem alterações à base de dados/storage e sem imprimir dados das viaturas, URLs assinados ou credenciais.

Comparação de preparação de capas/assinaturas com caches locais vazias, alternando a ordem das duas estratégias:

| Ronda | Anterior: ondas de 4 e duas assinaturas | Atual: até 8 trabalhadores e uma assinatura |
| --- | ---: | ---: |
| 1 | 1108 ms | 475 ms |
| 2 | 1155 ms | 483 ms |
| 3 | 899 ms | 531 ms |

Medianas: 1108 → 483 ms (cerca de 56% menos tempo **nesta etapa**). A comparação anterior é reproduzida pelo script sobre os mesmos caminhos e ligações, sem alterar o processo dos servidores. A rede varia: uma execução isolada da implementação atual chegou a 2152 ms; a última marcou 811 ms. Não são tempos de abertura completa no browser.

A leitura do detalhe na base de dados marcou 774–778 ms antes de remover a agregação redundante e 525 ms depois, numa amostra com duas fotografias. Leituras de URLs com cache quente ficaram abaixo de 1 ms. Estes resultados não eliminam a latência da base de dados remota nem a compilação inicial do Vite em desenvolvimento.

## Verificação e limites

- Suite CRM: 190 testes; suite backend: 296 testes no primeiro ciclo completo. Os testes adicionais de TTL, endpoint da galeria e soma de despesas foram executados depois das últimas alterações.
- Verificação de tipos do backend e CRM, compilação de produção do CRM e teste do HTML compilado da galeria.
- Testes de regressão cobrem resposta do detalhe com galeria pendente, erros 401/403, pedidos do layout em paralelo, assinatura em lote, fallback legado, validade/invalidação da cache e cálculos financeiros.
- O browser acessível nesta conversa estava sem sessão. Não se mediram navegação autenticada, bytes realmente transferidos pelo browser nem tempo visual de abertura. O teste SSR verifica que o diálogo fechado não contém uma imagem e que a pré-visualização permanece disponível.

Para repetir no checkout com configuração local:

```powershell
node --env-file=backend/.env --import tsx scripts/measure-crm-reads.mts --compare
# Depois de compilar apps/crm:
node scripts/check-crm-gallery-ssr.mjs
```

As correções são locais. Não implicam publicação externa nem aprovação de lançamento do website.

## Integração local

Os 18 ficheiros alterados/adicionados foram copiados para o checkout dos servidores em `C:\Users\Goncalo\Desktop\AI\AutoNunesMartins`, depois de confirmar a mesma revisão Git e verificar o conteúdo de cada destino para preservar alterações existentes. Ficaram como alterações locais, sem commit ou publicação. Backend `/health` e CRM em `localhost:5174` responderam 200; a API privada respondeu 401 sem sessão.

Um atraso de cerca de dois segundos observado com `Invoke-WebRequest` motivou uma comparação adicional. Com o cliente HTTP do Node, o backend respondeu em 45 ms na primeira ligação a `localhost` e 1–3 ms nas seguintes, incluindo IPv4 explícito. Não se confirmou um atraso de dois segundos na ligação usada pelo CRM, pelo que não se alterou a configuração de rede.

## Navegação geral: segunda investigação

O `DATABASE_URL` local limitava o Prisma a uma ligação, serializando consultas de pedidos concorrentes. A configuração local dos dois checkouts passou de `connection_limit=1` para `4`, mantendo o pool limitado e sem alterar credenciais. O exemplo de configuração acompanha este valor. O `/health` de desenvolvimento confirmou quatro ligações; em produção não expõe este diagnóstico.

Uma comparação só de leitura, sem dados pessoais, alternou três rondas de oito `SELECT 1` concorrentes, depois de aquecer ambos os clientes:

| Ronda | Pool 1 | Pool 4 |
| --- | ---: | ---: |
| 1 | 1880 ms | 487 ms |
| 2 | 1880 ms | 481 ms |
| 3 | 1881 ms | 482 ms |

É uma redução de cerca de 74% nesse lote controlado, não uma medição do tempo completo de navegação. Antes desta correção, pedidos autenticados reais registaram cerca de 2498 ms até aos cabeçalhos da dashboard, 1432 ms até à lista de viaturas e 876–1711 ms até à lista de vendas. Ainda não existe uma amostra autenticada comparável depois das alterações.

Outras alterações comuns:

- Verificações normais de sessão depois de inatividade reutilizam o token válido do SDK e deixam de invalidar todo o layout. Sessão rejeitada ou identidade diferente mantém renovação forçada e invalidação completa. Ao retomar o foco, só as páginas de resumo são atualizadas, preservando editores.
- Leituras simultâneas do mesmo utilizador partilham apenas a consulta em curso; o pedido seguinte volta a consultar permissões. A tentativa de completar o avatar tem um intervalo de cinco minutos, evitando pedidos externos repetidos para perfis sem fotografia.
- As listas de viaturas, vendas e clientes mantêm `no-store` no browser. No backend, cada pedido verifica um resumo das versões atuais das linhas PostgreSQL antes de reutilizar o resultado. Inserções, edições e eliminações invalidam a revisão, incluindo alterações de outra sessão/processo. Vendas incluem dependências de viatura, cliente, despesas e retoma; clientes incluem vendas. Filtros, página, utilizador e papel fazem parte da chave. Stock antigo e exportações grandes ficam fora desta cache. A memória está limitada a 64 entradas por lista e 60 segundos; esse prazo não substitui a verificação de atualidade. Se a revisão falhar, consulta os dados de novo.
- Diagnóstico só em desenvolvimento regista tempos de sessão, API e base de dados, com rotas normalizadas e sem identificadores, parâmetros, tokens, SQL ou conteúdo. O ficheiro local é `apps/crm/.cache/crm-navigation.ndjson`. Os tempos de base de dados são a soma das durações Prisma, podendo sobrepor-se em consultas paralelas.

Os testes adicionais cobrem renovação normal/expirada, mudança de identidade, navegações concorrentes, falhas da revisão, isolamento de chaves e alterações reais de versões de linhas em PostgreSQL de teste. CRM: 197 testes; backend: 312 testes; verificação de tipos de ambos sem erros. O indicador vermelho de navegação não foi alterado nesta investigação.

Integração desta segunda investigação: 26 ficheiros comparados e copiados com verificação de hashes para o checkout local dos servidores, preservando alterações existentes; backup em `%TEMP%\anm-navigation-20261021-214346`. A compilação de produção do CRM passou. No fim, os três servidores estavam parados e foram repostos em processos ocultos; backend `/health` respondeu 200 com pool 4, API privada respondeu 401 sem sessão e CRM respondeu 200. Não houve migrações, commit ou publicação externa.

## Revisitas imediatas: preferência posterior do proprietário

O proprietário autorizou expressamente mostrar a última lista enquanto uma leitura atual decorre em segundo plano, substituindo a restrição anterior de nunca mostrar dados antigos por instantes. Implementado em Viaturas (incluindo rascunhos), Vendas e Clientes. Não se estende à dashboard, tarefas, financeiro, atividade ou páginas de detalhe.

Estas três páginas usam agora `+page.ts` universal, sem `+page.server.ts` de lista. A navegação devolve a vista em memória sem esperar pelo pedido de dados. O layout autenticado já montado é reutilizado; a primeira entrada na aplicação continua a exigir autenticação e o carregamento inicial do layout. As leituras passam por `/listas/vehicles`, `/listas/sales` e `/listas/customers`, protegidos pelo hook CRM e pela autenticação/permissões atuais do backend. O indicador vermelho não foi alterado.

Comportamento:

- Primeira visita: skeleton existente. Revisita: linhas, totais e paginação anteriores ficam visíveis imediatamente. Uma resposta bem-sucedida substitui os dados. As labels informativas dos estados normais foram depois removidas a pedido do proprietário; os avisos de falha e repetição mantêm-se.
- Falha de rede/servidor: preserva a última lista, a hora da leitura anterior e uma indicação de falha com repetição. Nunca grava uma falha como uma lista vazia bem-sucedida. Rejeições 401/403 retiram os dados guardados.
- Cache apenas em memória do separador, sem localStorage, IndexedDB ou armazenamento duradouro. Máximo de 30 entradas, idade máxima de 30 minutos. Chave por tipo de lista, filtros completos normalizados (incluindo pesquisa, página, ordenação), utilizador e papel. SSR usa instâncias isoladas.
- Logout/troca de sessão/conta limpa a cache e as vistas montadas; a identidade é observada pelo SDK mesmo sem navegação. Gravações bem-sucedidas feitas por `sessionFetch` e ações enhanced (incluindo redirects) limpam todas as listas antes dos callbacks de navegação. Leituras pendentes de uma geração anterior não podem repovoar a cache depois dessa limpeza. Respostas mais antigas da mesma chave não substituem uma resposta mais recente na cache.
- Uma gravação própria pode fazer a primeira revisita seguinte usar skeleton para evitar ressuscitar dados anteriores à gravação. As ações continuam a ser verificadas pelo backend; dados guardados não autorizam operações.

219 testes CRM passaram, incluindo 22 testes novos de cache, universal load e invalidação por sessão/mutações; tipos sem erros e compilação de produção concluída. Pré-visualização no browser com componentes reais, CSS real e dados fictícios confirmou primeira visita pendente, revisita com linhas imediatamente visíveis, falha mantendo linhas e invalidação após gravação. Não constitui uma medição autenticada completa de produção. A captura `crm-cached-revisit.png` mostra a tabela com a leitura atual ainda pendente.

Integração: 29 ficheiros copiados/substituídos com hashes verificados, incluindo a remoção dos três antigos `+page.server.ts` após guardar cópias em `%TEMP%\anm-client-cache-20261021-221206`. As verificações de tipos também passaram no checkout dos servidores. O watcher do SvelteKit terminou durante a substituição desses ficheiros; o CRM foi reiniciado com as rotas finais. O backend mantém pool 4. Sem commit nem publicação externa.

## Preços neutros no CRM

Retirado o vermelho do PVP nas versões desktop/mobile de `VehicleTable` e no preço do detalhe da viatura. A revisão de dashboard, formulários, pré-visualização de publicação, vendas, clientes, retomas e resumos confirmou que os outros valores de preço já usam cores neutras. Valores negativos de lucro, erros, validação e ações destrutivas mantêm o seu significado visual. O website público não foi alterado nesta correção. No browser, o PVP calculado usa `rgb(244, 244, 242)` no tema escuro e `rgb(15, 15, 17)` no claro.

## Correção de refresh completo

Reproduzida com dados fictícios e o transporte de sessão real: o universal load começa antes de o componente raiz ligar a sessão durante hidratação. O pedido saía com o provider ainda nulo; quando a resposta HTTP 200 chegava, a proteção contra troca de conta via um novo provider e rejeitava-a, produzindo o falso erro 503. Não era uma resposta vazia legítima nem um erro do endpoint.

`sessionFetch` aguarda agora a primeira ligação do provider antes de enviar o pedido. O skeleton continua disponível porque o load não espera pela lista. Depois da ligação, mantêm-se a espera do SDK/token, os controlos de identidade e a rejeição de respostas de outra conta. A espera é limitada a 12 segundos e respeita cancelamento; sessões já ligadas seguem o caminho anterior. Quatro testes de regressão cobrem a resposta 200 durante montagem e o arranque direto de Clientes, Viaturas e Vendas com filtros/página; dois adicionais cobrem timeout e cancelamento. 225 testes CRM passaram.

A validação final, incluindo o novo bloco compacto de tarefas, soma 226 testes CRM. A dashboard deixou de pedir a lista de utilizadores usada apenas pelo filtro retirado desse bloco. O browser disponível ao agente não tinha sessão CRM; a abertura direta com um filtro de teste encaminhou para login. Por isso, a correção de refresh foi comprovada pelos testes que reproduzem a ordem real de hidratação com o transporte de sessão sem mock, sem afirmar validação visual autenticada.
