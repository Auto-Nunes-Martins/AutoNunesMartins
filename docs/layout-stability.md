# Estabilidade de layout e navegação

Verificação local em 21 de outubro de 2026.

## Alterações

- O detalhe CRM usa a própria `PhotoGallery` nos estados pendente e de erro: cabeçalho, instruções, imagem, indicador de publicação e faixa de miniaturas reservam espaço antes da resposta. A fotografia fica dentro da geometria do contentor, sem depender das dimensões intrínsecas. A seleção da capa também é aplicada no HTML inicial.
- O destaque da dashboard fica montado antes de chegarem os agregados. O indicador de destaque na ficha tem espaço reservado.
- No website, a imagem principal ocupa uma área reservada. Favoritos e comparação apresentam estruturas de cartões/tabela durante consultas frescas, em vez de um parágrafo que depois se expande.
- O breadcrumb do CRM tem uma coluna de largura estável. Nomes longos ficam acessíveis pelo título do elemento e não deslocam a pesquisa. Em mobile mantém-se a pesquisa compacta com expansão acessível.
- `VehicleSpecGlyph.svelte` partilha os desenhos usados nas características públicas com o CRM. Por preferência final do proprietário, marca, modelo, VIN e matrícula ficam sem ícones no CRM. Os restantes ícones de características e ações mantêm-se. No formulário, os quatro rótulos reservam 20 px; a matrícula tem espaço para a indicação «opcional» sem desalinhamento.
- O bloco de tarefas foi novamente refeito após rejeição do desenho com grupos e filtros: lista neutra com até quatro tarefas, ordenadas por atraso/hoje/prioridade, prazo e responsável compactos e conclusão discreta de tarefas próprias/gerais. A gestão completa fica em «Ver todas». Mantém skeleton, erro com repetição e estado vazio; a conclusão só retira a tarefa depois da confirmação do servidor.
- As sugestões públicas deixaram de bloquear o detalhe: começam em paralelo e são enviadas por streaming. Website e CRM têm feedback de navegação sem alterar a geometria da página.

## Cache e consistência

O inventário e a seleção de tarefas usam `no-store`. Removeram-se os cabeçalhos que permitiam mostrar listas antigas com `stale-while-revalidate`. No website só se pré-carrega código, sem antecipar dados de stock no hover. Mantêm-se a cache de fotografias/URLs e os agregados da dashboard; mesmo numa resposta com agregados em cache, a lista de tarefas é consultada novamente.

Por preferência posterior explícita do proprietário, as revisitas às listas CRM de viaturas, vendas e clientes mostram imediatamente a última lista em memória. A resposta atual substitui-a em segundo plano; em caso de falha, mantém os dados anteriores com aviso e repetição. A primeira visita apresenta o skeleton. As labels dos estados normais foram depois retiradas a pedido do proprietário; os avisos de falha mantêm-se. Cada entrada/atualização continua a pedir dados ao servidor; a revisão da cache backend mantém-se. Ver `crm-performance.md` para limites, isolamento de sessão e invalidação após gravações. Uma página que permanece aberta não recebe automaticamente alterações feitas noutra sessão; não foi acrescentada uma infraestrutura de eventos em tempo real.

## Evidência

Proxy de diagnóstico: `node scripts/audit-layout-local.mjs`, depois abrir `http://127.0.0.1:5178`. Só aceita leituras locais. Atraso adicional de 12 s nas imagens e 1,5 s nas fontes; observa CLS por janelas de sessão e caixas DOM durante 20 s. As medições são de desenvolvimento local, não de utilizadores reais.

| Página | Largura real | CLS observado | Geometria |
| --- | ---: | ---: | --- |
| Homepage | 1270 px | 0 | imagens chegaram sem deslocações observadas |
| Catálogo | 1270 px | 0 | imagens chegaram sem deslocações observadas |
| Dacia Jogger, detalhe | 1270 px | 0 | galeria 843,84 × 602,74 px antes/depois |
| Dacia Jogger, detalhe | 380 px | 0 | galeria 380 × 292,30 px antes/depois |

Os componentes CRM foram montados numa pré-visualização isolada com os componentes reais, CSS real, dados fictícios e serviços simulados. Verificaram-se tarefas preenchidas, vazias, pendentes, falha de consulta e conclusão; formulários em mobile sem overflow e ícones de 20 × 20 px. A pesquisa manteve a caixa exatamente igual entre rótulos curtos/longos: x=337,16 px em desktop; o botão mobile manteve x=234,75 px e largura=44 px. A pesquisa expandida continuou utilizável.

No servidor público já integrado, três pedidos ao detalhe registaram primeiro byte em 1,186 / 0,770 / 0,765 s. Antes desta alteração, uma sequência comparável registou 0,855 / 0,786 / 0,782 s. Não há evidência de uma redução global consistente nesta amostra; o teste automatizado comprova que sugestões pendentes já não bloqueiam a resposta da viatura. A leitura do detalhe CRM na base de dados remota marcou 541 / 536 / 540 ms, sem medir autenticação ou abertura completa no browser.

## Verificações e limites

- Website: 438 testes; CRM: 192 testes; backend: 20 testes selecionados de tarefas, cache e transições.
- Tipos dos dois frontends e backend; compilações de produção dos dois frontends; teste do HTML compilado da galeria; `git diff --check`.
- Não havia sessão CRM disponível. A pré-visualização com dados fictícios não substitui uma medição autenticada de clique até ao detalhe. Uma comparação adicional com dados de clientes foi bloqueada pela revisão automática; não foi repetida.
- Não se afirma CLS zero para todas as páginas/estados. Conteúdo de comprimento desconhecido pode alterar a altura; não se impuseram alturas que cortem informação.

## Integração local

Alterações copiadas para `C:\Users\Goncalo\Desktop\AI\AutoNunesMartins`, verificando revisão, divergências e hashes, com backups em `%TEMP%\anm-layout-backup-20261021-182408` e `%TEMP%\anm-layout-final-20261021-184535`. As alterações de desempenho preexistentes foram preservadas. Ficheiros ficaram como alterações locais, sem publicação externa.

## Segunda proposta do bloco de tarefas

Na mesma pré-visualização com dados fictícios e largura de 450 px, a versão anterior media 849,375 px de altura; a proposta compacta mede 294,25 px (cerca de 65% menos). A 348 px de largura, mantém 294,25 px e não apresenta overflow horizontal. Quatro linhas de 60 px substituem grupos, resumo, contadores, filtro e nota de rodapé. O prazo em atraso é o único texto operacional vermelho; prioridade e responsável usam tons neutros.

Carregamento, vazio e erro também mediram 294,25 px. Verificaram-se no browser atualização falhada, repetição e conclusão confirmada de uma tarefa fictícia; o botão de conclusão não aparece para outro responsável. O pedido de utilizadores que alimentava apenas o filtro removido deixou de bloquear o load da dashboard. 226 testes CRM passaram; verificação de tipos e compilação de produção fazem parte da validação final.
