# Segunda ronda de performance mobile

Candidato local de 25 de outubro de 2026, sobre `25f40c484c460b7386b293f42836096ada75d190`. Sem commit, push ou publicação nesta ronda. A proposta desktop está a ser desenvolvida separadamente; estes números não incluem a sua integração.

## Alterações e limites

- O fundo mobile usa recortes horizontais centrados de 1200 ou 1440 pixels da fonte portrait de 1920 × 2560. As margens removidas ficam fora do enquadramento nos perfis validados. As variantes mantêm a densidade da fonte anterior: largura e `sizes` são multiplicados pela mesma fração. AVIF continua em qualidade 55, esforço 5, 4:2:0; WebP em qualidade 88, esforço 6, smartSubsample. Não se alteraram CSS, keyframes, tempos, zoom ou fotografias das viaturas.
- Os recortes têm condições de media partilhadas pelo preload e pelo picture. Ecrãs acima de 540 px, movimento reduzido e a ausência de destaques mantêm o portrait completo. Desktop mantém os assets anteriores. O gerador é `scripts/optimize-mobile-hero.mjs`; os 28 assets e o módulo gerado estão separados dos ficheiros da ronda desktop.
- O startup público mantém a execução clássica no head, mas é inserido no HTML pelo hook do servidor. Elimina um pedido bloqueante na primeira visita. Em contrapartida, estes cerca de 9,8 KB de código antes de compressão passam a viajar no HTML de cada navegação completa, em vez de terem cache separado; não foi medido um ganho em visitas repetidas.
- O startup agrupa as leituras de geometria das cenas antes de aplicar as respetivas propriedades. A classe `motion-on` continua a preceder as medições, e as fórmulas de posição foram preservadas. A posição inicial da navbar evita uma leitura cujo resultado é conhecido abaixo de 100 px de scroll. O cálculo inicial de layout necessário ao browser continua a existir; não se promete eliminar todo o forced reflow.

## Medições

Lighthouse 13.4.1, Chrome headless, três execuções por configuração, navegador novo. Viewport 412 × 823, DPR 1,75, CPU 4×, RTT 150 ms e 1638,4 Kbit/s simulados. Website compilado em 5180 e snapshot das mesmas respostas/imagens em 4180/4181, com dimensões de capa ativas em ambas as configurações. Não se executaram builds ou encoders próprios durante as medições.

| Mediana | Base | Candidato |
| --- | ---: | ---: |
| Performance | 65 (58–66) | 69 (69–70) |
| LCP simulado | 12 163 ms | 11 044 ms |
| FCP simulado | 2804 ms | 2709 ms |
| TBT | 262,5 ms | 146 ms |
| Transferência total | 2 614 462 bytes | 2 386 380 bytes |
| CLS | 0 | 0 |
| Acessibilidade / boas práticas / SEO | 97 / 100 / 69 | 97 / 100 / 69 |

O fundo selecionado passou de 827 426 para 587 452 bytes: menos 239 974 bytes (29,0%). A transferência total caiu 228 082 bytes (8,7%); o aumento de HTML/srcsets explica parte da diferença. O LCP simulado caiu 1119 ms (9,2%), mas continua acima do objetivo. O TBT varia com a carga da máquina: estes resultados não isolam causalmente o efeito de cada alteração.

Estes valores não são pontuações de produção: o servidor local entrega HTML sem compressão, o backend é um snapshot e a latência da infraestrutura real foi retirada. Não foi feita nesta ronda uma comparação A/B com throttling real no browser; o LCP acima é explicitamente simulado. Os relatórios anteriores de produção (70/75) não são diretamente comparáveis com esta série local.

## Verificação

- Build de produção do website concluído; 515 testes passaram; Svelte check terminou com zero erros e zero avisos, usando a configuração pública do build local.
- 24 pares de screenshots nos temas claro/escuro, incluindo 320, 390, 412, 430, 450, 540, 700, 701 e 1440 px; movimento reduzido; fases de animação 0, 1200 e 4800 ms no perfil principal. Em todos: geometria, estilos de posicionamento e keyframes iguais, um só pedido do fundo e ausência de overflow horizontal. Inspeção visual adicional dos pares 320, 412 e 450 px. A nova codificação não é byte/pixel idêntica à anterior.
- Smoke de runtime em `/`, `/viaturas`, `/quem-somos` e `/favoritos`, em ambos os temas: sem erros JavaScript; tema correto; startup disponível sem pedido externo; scroll preservado após reload; sem overflow horizontal.
- Smoke de cache através do gateway, com builds locais de website e CRM: 170 assets versionados com bytes intactos; GET, HEAD e 304 corretos; referências SSR válidas e startup inline presente; respostas privadas/frescas preservadas.
- As condições do recorte excluem o estado sem destaques. Os screenshots usam os destaques reais do snapshot; não representam todos os comprimentos de conteúdo possíveis.

Evidência local não versionada em `.cache/mobile/`: `round2-before-{1,2,3}.json`, `round2-after-{1,2,3}.json`, `round2-visual-comparison.json`, `round2-runtime.json`, logs de build/test/check e screenshots `round2-*`. O relatório anterior permanece em `mobile-homepage-performance.md` para preservar o histórico.

Não há mudanças a dados oficiais, placeholders, regras de indexação, APIs, autenticação, cache de fotografias, galeria ou partilha. Este trabalho técnico não constitui aprovação de publicação.
