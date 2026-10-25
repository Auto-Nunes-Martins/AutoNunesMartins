# Performance mobile e dimensões das fotografias

Verificação de 25 de outubro de 2026 sobre a base desktop `a808081f4bd74169f4ef2f145ad4f6d463e483a5`. Este relatório separa entrega técnica e aprovação de publicação: dados oficiais, contactos, revisão jurídica e indexação continuam pendentes.

## Alterações

O fundo portrait tinha variantes 640, 1080, 1280 e 1920. No perfil 412 × 823 / DPR 1,75, o recorte e zoom requerem cerca de 1446 pixels físicos, levando o navegador a escolher 1920. Foram acrescentados **1440, 1600 e 1792**, em AVIF e WebP, a partir da mesma fonte, mantendo recorte e parâmetros de codificação: AVIF 55/esforço 5/4:2:0; WebP 88/esforço 6/smartSubsample. Os ficheiros existentes permanecem byte a byte iguais.

| Viewport / DPR | Antes | Agora |
| --- | ---: | ---: |
| 320 × 568 / 1,75 | 1920 | 1440 |
| 390 × 844 / 2 | 1920 | 1792 |
| 412 × 823 / 1,75 | 1920 | 1600 |
| 430 × 932 / 2 | 1920 | 1792 |
| 700 × 900 / 2 | 1920 | 1920 |
| 701 × 900 / 2 | wide 2880 | wide 2880 |
| 1440 × 900 / 1 | wide 1920 | wide 1920 |

O AVIF 1920 pesa 1 368 213 bytes; 1600 pesa 827 426: menos **540 787 bytes (39,5%)**. Preload e picture partilham o conjunto atualizado e continuam a originar um único pedido do fundo. Não se alteraram CSS, keyframes, tempos, zoom, cores, conteúdo ou interações.

As fotografias dos cartões tinham outro problema: o HTML inicial conhecia a largura do cartão, mas só depois do primeiro download conhecia a proporção necessária ao `object-fit: cover`. Uma caixa de 371 × 325 CSS px pede cerca de 627–680 CSS px de origem nas capas A3/A6/Q5. A DPR 1,75, o download inicial 800 era substituído por 1280; no Q3, 800 já basta.

Agora o upload persiste as dimensões normalizadas já produzidas pelo manifest, associadas à versão imutável da fotografia. O catálogo consulta essa metadata numa única consulta DB indexada e só expõe `{version,width,height}` da capa autorizada. **Não lê sidecars/storage no render.** O website calcula o primeiro `sizes` mobile com a proporção correta, incluindo a grelha de duas colunas do catálogo entre 541 e 700 px. Conserva o observador, as regras desktop e fallback para fotografias sem metadata. Não há proporções por slug nem novas compressões/variantes das viaturas.

No navegador, A3/A6/Q5 passaram a pedir diretamente 1280; Q3 continua em 800. A fotografia final, recorte e nitidez permanecem iguais. Reordenação, substituição e remoção de aprovação não reutilizam dimensões de outra versão. Ver [procedimento de migração e backfill](photo-dimensions.md).

## Medições controladas

Lighthouse 13.4.1, HeadlessChrome 155, viewport efetiva 412 × 823 / DPR 1,75, mobile/touch, CPU 4×, RTT 150 ms e 1638,4 Kbit/s simulados. Três execuções por configuração, navegador novo. Website Node compilado em 5180; snapshot local das mesmas respostas/fotografias em 4180, com cabeçalhos de versão, e projeção opcional de metadata em 4181. Os dados e bytes das imagens são iguais; a latência variável do backend remoto foi retirada. Não são medições de produção.

| Mediana de três execuções | Base desktop | Só variantes do fundo | Fundo + dimensões |
| --- | ---: | ---: | ---: |
| Performance | 64 (61–65) | 67 (66–69) | 67 (66–67) |
| LCP simulado | 13 363 ms | 10 738 ms | 12 236 ms |
| FCP | 2901 ms | 2880 ms | 2874 ms |
| TBT | 287 ms | 200 ms | 209 ms |
| Transferência | 3 574 489 bytes | 3 034 269 bytes | 2 614 462 bytes |
| CLS | 0 | 0 | 0 |
| Acessibilidade / boas práticas / SEO | 97 / 100 / 69 | 97 / 100 / 69 | 97 / 100 / 69 |

A entrega final transfere **960 027 bytes a menos (26,9%)** que a base. Uma comparação adicional no mesmo build final, ligando/desligando apenas metadata, deu 3 034 807 → 2 614 462 bytes: menos **420 345 bytes (13,9%)**, incluindo quatro primeiros downloads de 800 evitados. Performance 66 → 67; TBT 225 → 209 ms.

**A diferença de LCP do simulador não foi descartada:** nessa comparação adicional, metadata aumentou a estimativa de 10 738 para 12 236 ms. Os pedidos finais maiores começam mais cedo, com concorrência diferente na simulação. O fundo permaneceu High e os cartões Low. Não se afirma que esta etapa melhore o LCP simulado.

Foi por isso feita uma comparação dirigida com limitação efetiva de rede no Chrome/CDP, 150 ms, 1638,4 Kbit/s e CPU 4×, em dois pares alternados. Aqui o `PerformanceObserver` mediu o LCP real da execução:

| Par | Sem dimensões | Com dimensões |
| --- | ---: | ---: |
| 1 | 10 028 ms | 9276 ms |
| 2 | 10 032 ms | 9300 ms |

O primeiro cartão começou em y=1538 CSS px, fora da viewport de 823 px. Com rede limitada, o navegador antecipou apenas dois cartões: A3/A6 fizeram 800 → 1280 sem metadata e apenas 1280 com metadata. Ambos mantiveram prioridade Low e terminaram mais cedo; a resposta do fundo terminou cerca de 0,76 s mais cedo. O lazy loading depende das condições de rede, pelo que o grafo observado difere do grafo recolhido sem limitação e depois simulado pelo Lighthouse. Esta evidência sustenta manter a metadata, sem adicionar atrasos artificiais, ocultar conteúdo ou alterar animações. Duas repetições locais não garantem comportamento em todas as redes; a divergência do simulador permanece registada.

O relatório público fornecido pelo utilizador (01:05:15 UTC) tinha performance 70, LCP 10 826 ms, 3 527 994 bytes e CLS zero. É outro ambiente: não comparar diretamente os 67 locais com os 70 públicos, nem prometer um valor final de produção.

## Validação

- Website: 515 testes passaram; Svelte sem erros/avisos; build Node concluído. Backend: 163 testes dirigidos passaram, incluindo upload, autorização pública, derivados, idempotência, limites, cursor de repetição e migrações; compilação TypeScript concluída.
- Migrações testadas numa base PostgreSQL local descartável: constraints, FK/cascade, remoção da tabela derivada e RLS sem políticas públicas.
- Catorze pares de capturas do hero: sete tamanhos × dois temas. Geometria, estilos e animações mobile iguais; sem overflow; um pedido do fundo. Desktop conserva a fonte; diferenças de fase idle inferiores a 0,12 CSS px. Variantes de resolução diferente não são pixel-identical, mas composição/recorte/nitidez percebida foram inspecionados.
- Vinte pares adicionais de cartões: homepage e catálogo, larguras 320/412/600/700/1440, claro/escuro. Todos conservaram fonte final, dimensões, object-fit/position, sem erros JavaScript ou overflow. Onze pares coincidiram também em pixels; não se declara igualdade integral nas restantes capturas. Os pares a 412 px coincidiram em pixels.
- Não se alterou a galeria/fullscreen, retenção local de imagens, partilha, scroll cue ou formulário de contactos. Os testes passaram; isto não representa uma nova auditoria manual completa dessas interações.
- Lint dirigido encontrou um erro preexistente em `publicVehicles.ts` (`import()` numa anotação de tipo, presente na base); não se apresenta o lint global como aprovado. `git diff --check` passou.

## Aplicação dos dados existentes

O projeto Supabase configurado foi confirmado por correspondência das ligações DB/storage e pelas 17 versões de capas da API pública. O histórico não tinha migrações falhadas nem diferenças substanciais; 16 checksums antigos diferiam apenas por CRLF/LF. Foram aplicadas apenas as duas migrações desta funcionalidade: criação da tabela e proteção RLS explícita. A segunda preserva a proteção que o alvo já ativava automaticamente e garante o mesmo comportamento noutras instalações.

Backfill autorizado: **18 viaturas públicas, 28 fotografias aprovadas, 28 dimensões criadas, zero ausentes/falhas**. Segunda execução: 28 existentes e zero criadas. As 28 linhas foram comparadas com os manifests. Um hash do conjunto completo das 43 viaturas confirmou que todos os seus dados, fotografias e aprovações ficaram inalterados. Sem uploads, reencodes, alterações de storage ou envio de formulários.

A tabela tem RLS ativo, sem políticas de leitura pública; consultas sob os papéis `anon` e `authenticated` devolveram zero linhas. Só o backend projeta dimensões de capas autorizadas. A existência dos registos não substitui o deploy do código consumidor; não foi realizado deploy manual de hosting.

## Limites e evidência

LCP e avisos de CPU/CSS/contraste continuam a merecer trabalho futuro. `SITE_NOINDEX=true` foi mantido nas comparações. `docs/publication-readiness.md` e `apps/website/src/lib/publicationReadiness.json` foram consultados e permanecem inalterados. Dados oficiais e aprovação de publicação continuam pendentes.

Evidência local ignorada pelo Git: `.cache/mobile/baseline-{1,2,3}.json`, `after-{1,2,3}.json`, `dimensions-before-*`, `dimensions-after-*`, `observed-network-comparison.json`, `card-visual-comparison.json`, capturas, auditorias e harnesses. Ensaios preliminares com fixtures incompletas foram descartados. O Git inclui os seis derivados do fundo, código, migrações, testes e documentação necessários à entrega.
