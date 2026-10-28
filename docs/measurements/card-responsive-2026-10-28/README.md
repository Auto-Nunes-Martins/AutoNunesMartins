# Cartões responsivos — medição local de 28/10/2026

Chrome headless, desktop 1440×900 DPR1 e mobile 390×844 DPR2. Comparação controlada com seis cartões iguais em ambos os perfis; todos foram postos no campo visível. Contexto de navegador novo para cada modo/perfil. Depois: navegação efetiva para a primeira ficha, três fotografias carregadas à entrada, seleção de todas, fullscreen, regresso ao catálogo e revisita da ficha.

| Percurso (corpos HTTP, bytes) | 1600 fixo desktop | Responsivo desktop | 1600 fixo mobile | Responsivo mobile |
| --- | ---: | ---: | ---: | ---: |
| Catálogo, cache fria | 2 984 112 | 791 604 | 2 984 112 | 1 989 084 |
| Entrada na ficha, mais três fotos | 805 936 | 1 303 288 | 805 936 | 1 303 288 |
| Catálogo + entrada na ficha | 3 790 048 | 2 094 892 | 3 790 048 | 3 292 372 |
| Percorrer fotos e abrir fullscreen | 0 | 0 | 0 | 0 |
| Regresso ao catálogo com cache HTTP | 0 | 0 | 0 | 0 |
| Revisita da ficha | 0 | 0 | 0 | 0 |

Poupança no catálogo: **73,47% desktop / 33,34% mobile**. No percurso catálogo + ficha: **44,73% / 13,13%**. O navegador escolheu **800 no desktop e 1280 no mobile**, em vez de 1600 para todos. Seis pedidos por catálogo, um por cartão, sem segunda resolução pedida após medição do recorte.

A entrada na ficha aumenta 497 352 bytes: o cartão responsivo ainda não descarregou a versão 1600 da primeira foto. As outras duas fotos custam 805 936 bytes em ambos os modos. Foram seis pedidos ao servidor na entrada, incluindo revalidações: quatro respostas 304 no modo fixo e três no responsivo. A galeria/fullscreen não fez pedidos. O catálogo de regresso fez seis 304. A revisita da ficha teve entre zero e seis pedidos 304 consoante a cópia retida disponível nesse momento; não transferiu novos corpos. Contagens pormenorizadas e URLs em `results.json`.

A verificação automática observou a camada temporária do cartão em todos os perfis, sem `aria-busy` durante a apresentação; confirmou que desapareceu após a versão 1600 descodificar. Testes adicionais verificam rejeição de outra versão/origem/foto, expiração, consumo único e retenção até descodificação. Homepage e carrossel também são abertos em contextos frios separados para verificar os candidatos responsivos, dimensões reais e apresentação visual; esses percursos independentes não integram os totais da tabela.

## Reprodução e limites

Na raiz do repositório, com dependências e Chrome instalados: `node scripts/measure-card-photo-delivery.mjs`. O script cria um backend efémero local e usa o website real através de Vite. O modo de referência altera apenas as chamadas de fontes dos cartões para 1600 sem srcset. Ambos os modos mantêm a mesma política de detalhes e cache. Não instala interceptores Playwright, que desativariam a cache HTTP. Não usa produção, credenciais ou Storage. Executar sem outro build/sync em simultâneo, para evitar HMR a invalidar a sessão medida.

O JSON é guardado neste diretório; screenshots ficam em `apps/website/.svelte-kit/card-photo-measurements/`, fora dos assets e do código publicado. Foram inspecionadas a apresentação mobile da homepage, o carrossel desktop e o fullscreen mobile. Os cartões partilhados e o destaque escolheram 800 no desktop e 1280 no mobile nesta fixture; `results.json` regista `currentSrc`, `sizes`, largura e altura dos elementos. Validação: suite completa de 606 testes aprovada, testes específicos repetidos após o ajuste do destaque, tipos sem erros/avisos e build aprovado.

São seis viaturas sintéticas com as mesmas três imagens fotográficas locais do repositório: estrada Curves, interior Cabin e estrada Forest. Não são seis viaturas reais nem uma amostra de produção. Derivados gerados localmente de WebP já existente, com a receita WebP84 (`quality:84`, `effort:6`, `smartSubsample:true`), sem ampliação. Há uma imagem de origem com largura 1920; larguras superiores mantêm o fallback sem ampliação. Não foi alterada nem regenerada qualquer imagem do Storage. O tamanho absoluto depende destas imagens e a repetição das suas versões favorece a reutilização em memória; não extrapolar estes totais para outras viaturas.

Os bytes são corpos de respostas efetivamente emitidos pelo backend fixture, excluindo cabeçalhos HTTP/TLS, HTML, JS, CSS, fontes e imagens de decoração. Respostas 304 contam como pedidos com zero bytes de corpo. Não são uma medição de velocidade, LCP ou consumo total da página. Os resultados anteriores neste repositório continuam históricos e não são médias de produção.
