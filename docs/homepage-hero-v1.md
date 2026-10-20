# Hero V1 — composição minimalista

A V1 mostra um ambiente decorativo a toda a largura e um único cartão compacto
para os destaques públicos. Não tem headline visível, tabela de características
ou faixa de miniaturas. Os dados, URLs, preços e fotografias vêm de
`PublicHighlights`; as unidades de demonstração mantêm a indicação de fotografia
ilustrativa e de demonstração. Sem autoplay. As setas, Home/End, seletores e swipe
navegam pelos destaques; os links abrem a ficha real.

## Altura e isolamento

Desktop: `calc(clamp(560px, 76svh, 740px) + 4svh)`. Em mobile, a fórmula anterior
foi copiada para variáveis `--v1-*`, conservando a altura aprovada sem depender
da cascata antiga. Medições antes/depois: 780 px em 1440×1000; 780,953125 px
em 768×1024; 777,296875 px em 390×844; 767,921875 px em 320×760.

Estrutura e estado em `HomeHeroV1.svelte`, fotografias em
`HomeHeroV1Photo.svelte`, estilos em `homeHeroV1.css`. A V2 continua nos seus
componentes independentes. Navbar, faixa de contactos e estatísticas mantêm o
seu desenho. O seletor 1/2 permanece exclusivo do ambiente de desenvolvimento.

## Imagem decorativa gerada

Ferramenta: **imagegen integrada**, em 20 de outubro de 2026. O ambiente é uma
ilustração fotográfica arquitetónica; não representa as instalações reais do stand.
É decorativo e usa texto alternativo vazio. Não inclui veículos, marcas, pessoas
ou texto incorporado.

Master preservado: `apps/website/src/lib/assets/images/hero-v1/ambience-master.png`.
Dimensão nativa verificada com Sharp: **2172 × 724 px**, RGB sem alpha. A resolução
pedida no prompt não foi a resolução devolvida; não se apresenta o ficheiro como
4K e não foi ampliado para criar resolução artificial. Derivados AVIF qualidade
76, crominância 4:4:4, e WebP qualidade 90, a 1280, 1920 e 2172 px. O navegador
escolhe pelas dimensões da imagem efetivamente ampliada antes do recorte; o
mobile mantém o candidato maior porque usa uma pequena parte do panorama.

As fotografias dos carros continuam nos endpoints públicos e usam os derivados
reais de 800/1600 px no cartão. A imagem do destaque tem fallback próprio e
legenda de indisponibilidade, mantendo dados e links utilizáveis.

### Prompt final

> Use case: ads-marketing. Asset type: decorative full-bleed website hero background for a Portuguese car dealership, behind a small featured-car UI card. Primary request: an exceptionally beautiful, very clean, minimalist architectural automotive studio background, photoreal editorial architectural photography, widescreen 3:1 panoramic composition, native high resolution ideally 3840 by 1280. Scene: a serene contemporary empty automotive photography atelier with a pale warm concrete floor, a long curved brushed graphite wall on the left, a broad clean opening revealing soft pale daylight and a faint distant limestone hillside toward the middle, and quiet deep charcoal negative space on the right for a UI card. Lighting: soft natural late-afternoon side light grazing the concrete, a gentle warm highlight along the curved wall; realistic, refined, understated, very high material detail. Palette: warm greige, graphite, muted silver, off-white; one extremely subtle deep red reflection at floor level in the far left, not a neon line. Camera: ultra-wide horizontal architectural photograph, human eye height, straight perspective, carefully composed restrained luxury. The background is an illustrative ambience only, not a depiction of an existing dealership. No cars, no people, no furniture, no showroom signage, no letters, no logos, no UI, no text, no sci-fi, no loud lighting, no floating objects, no dramatic effects, no clutter. Keep the center-left airy and beautiful and the right third quietly dark, not featureless black. The finished result must look like a premium architectural photograph, not a generic CGI template.

## Verificação técnica

Capturas e resultados em `.cache/hero-v1-review/` (ignorados por Git). Matriz
Chrome: 2560, 1440, 1024, 768, 390 e 320 px; temas claro/escuro; largura de fundo
igual à largura útil do documento; ausência de overflow horizontal e de erros
JavaScript; navegação por setas/Home/End; links sincronizados; troca 1/2; mudança
dinâmica de tema; reduced-motion e fallback de fotografia.

Casos adicionais verificados no navegador, sem modificar dados persistidos:
seleção vazia, um único destaque reservado, preço sob consulta, swipe com eventos
de toque reais, ausência de navegação acidental após swipe e carregamento lento
das fotografias. O cartão e os links continuam utilizáveis durante o carregamento.

Esta revisão visual e técnica não constitui aprovação de publicação nem resolve
as pendências legais, de contactos ou de dados oficiais.
