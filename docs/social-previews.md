# Previews de links públicos

Implementação e verificação local: 14 de outubro de 2026. Não constitui aprovação de publicação.

## Cobertura

`SocialMetadata.svelte` fornece um único conjunto de Open Graph e Twitter Cards no HTML SSR, com título, descrição, URL canonical, imagem absoluta, texto alternativo, idioma `pt_PT`, nome do site e tipo `website`. Não são inventados identificadores sociais, contactos ou domínio. A origem vem do pedido, como nas canonicals e no JSON-LD existentes; validar domínio final, aliases, HTTPS e redirecionamentos no alojamento escolhido.

- Início, Quem Somos, catálogo, filtros e paginação: imagem de marca.
- Fichas públicas: primeira fotografia da projeção pública aprovada, através de `/viaturas/{slug}/photos/0`. O endereço é estável, no mesmo website e sem token assinado. O endpoint existente continua a consultar a API pública, a validar MIME e a impedir acesso a fotografias não publicadas. Não foi alterada a allowlist de dados.
- Fichas sem fotografia: imagem de marca. O JSON-LD continua sem fotografia de produto nestes casos: um logótipo não representa a viatura.
- Favoritos, comparação, informação legal e privacidade: metadados e imagem de marca, mantendo `noindex`. A seleção local de favoritos/comparação não é partilhada pelo URL.
- Demos do DesignEdition: imagem de marca e `noindex` existentes; nenhum veículo ilustrativo passa a ser stock aprovado. O laboratório Porsche mantém a sua política de demonstração.

## Imagem

`apps/website/static/images/social/auto-nunes-martins-v1.png`: PNG opaco, 1200 × 630 px, 131425 bytes. Reutiliza o logótipo branco/vermelho existente, centrado num fundo escuro; não contém fotografia fictícia, domínio ou contacto. Dimensões e MIME só são declarados para este asset conhecido. Nas fotografias de viaturas, a projeção atual não fornece dimensões nem MIME; não são inventados valores.

Uma fotografia pública pode ter proporção/tamanho diferentes e ser recortada pela plataforma. O proxy existente admite JPEG, PNG e WebP até 10 MiB; essa validação técnica não garante que qualquer fotografia cumpra todos os limites particulares de cada plataforma. Verificar os uploads reais e a imagem final no domínio público.

## Verificação reproduzível

`npm run test:social --workspace @anm/website` inicia um Vite local e uma API pública fictícia em portas livres, consulta HTML SSR como crawlers e termina ambos os processos. Não usa CRM, storage, segredos reais ou envio de mensagens.

Foram verificadas 12 rotas: início, Quem Somos, catálogo, marca, filtro combinado, favoritos, comparação, legal, privacidade, duas fichas (com/sem foto) e uma demo. Verifica títulos/descrições, ausência de tags duplicadas, URLs absolutas e coerência canonical/JSON-LD, alt, ficheiro PNG servido com 200/MIME/dimensões/bytes, preservação do `noindex` e remoção de um campo privado deliberadamente presente na fixture. User agents: Discordbot, Twitterbot, facebookexternalhit e WhatsApp. A fotografia da fixture é um PNG local; esta prova não confirma fotografias reais ou acesso externo.

Suite existente: 337 testes aprovados; Svelte check: 0 erros, 0 avisos. As alterações foram aplicadas ao projeto principal preservando os formulários e outras alterações existentes. Não houve push, deploy ou mensagens nas plataformas.

Build local: cliente e servidor compilaram; o adapter Vercel voltou a falhar com `EPERM` ao criar o symlink `index.func` no Windows. O build de publicação continua pendente; não foi alterada a configuração do adapter para esconder esta limitação.

## Plataformas e validação externa pendente

A implementação segue o [Open Graph](https://ogp.me/) e inclui `twitter:card=summary_large_image`. A documentação de Cards de X redirecionou para a documentação geral nesta consulta; a página de webmasters da Meta devolveu limite de pedidos. Não se presume validação externa a partir desses acessos.

[Discord descreve a leitura de metadados pelo seu crawler](https://support.discord.com/hc/en-us/articles/42500550752919-About-Discord-Link-Previews-and-the-Discordbot). [WhatsApp permite desativar previews](https://faq.whatsapp.com/445453537819972/?cms_platform=iphone). Facebook e X podem guardar resultados em cache. Os metadados são preparados para estes consumidores, mas apresentação, recorte, atualização e decisão de mostrar uma preview pertencem às plataformas. No Instagram, só haverá preview nos contextos em que a aplicação a suporte; não se promete preview em legendas, Stories, bio ou mensagens, nem renderização idêntica.

Depois de existir domínio público autorizado, confirmar respostas 200 do HTML e imagens por HTTPS sem autenticação, desafios anti-bot ou firewall a bloquear os crawlers; inspeção dos bytes das fotos reais, alt e recorte; canonical e redirecionamentos; comportamento de cache e eventual nova leitura através das ferramentas oficiais disponíveis. O `robots.txt` permite crawlers. Vercel preview e `SITE_NOINDEX=true` mantêm o cabeçalho de exclusão dos motores, sem bloquear pedidos de imagens; alojamentos com proteção de acesso podem impedir previews externas.

As pendências de identidade, contactos, privacidade, conteúdo, domínio e publicação permanecem em `publication-readiness.md` e `publicationReadiness.json`; nenhum item foi marcado `verified`.
