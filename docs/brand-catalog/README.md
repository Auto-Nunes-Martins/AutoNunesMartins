# Catálogo de marcas — 29 de outubro de 2026

O catálogo de lançamento contém **232 marcas** e **215 logos locais**. Não reclama exaustividade absoluta. Inclui fabricantes atuais, importações e marcas históricas relevantes para usados; a lista não depende do stock do stand.

Fontes de nomes consultadas em 29/10/2026: [mobile.de, diretório de marcas](https://www.mobile.de/auto/) (inclui a lista Top/Weitere Marken), [Standvirtual, marcas disponíveis](https://www.standvirtual.com/carros) (a página pública expõe sobretudo as marcas principais, não uma exportação completa), catálogo existente do seed e fontes automóveis adicionais. As identidades adicionais podem ser consultadas no manifesto da [coleção VehicleSpecs](https://github.com/vehiclespecs/brand-logos). Não foram copiados assets dos portais Standvirtual/mobile.de. Submarcas e marcas anteriores são distintas (por exemplo Cupra/SEAT e SsangYong/KG Mobility); não se converte uma noutra. VW, Mercedes, DS, KGM e outros aliases inequívocos estão explícitos no JSON versionado; acentos, case e separadores são normalizados. Sem 'Outros'.

## Comportamento e persistência

`shared/types/src/brands.json` é o catálogo versionado de instalação. `VehicleBrand` persiste nomes, aliases e referências de assets. Vehicle.brand e TradeIn.brand mantêm strings canónicas por compatibilidade, agora com chaves estrangeiras para VehicleBrand.name. O backend valida criação, edição simples/unificada e retomas com o mesmo contrato; o banco também recusa novas marcas desconhecidas/inativas via trigger. O combobox só grava uma seleção; escrever pesquisa por substring ou uma diferença de letra, sem criar marcas nem remapear erros automaticamente.

A migration `20261029090000_vehicle_brand_catalog` contém o INSERT do catálogo completo, numa transação, e não precisa de seed manual. Docker → container-start → migrateBeforeStart → `prisma migrate deploy` aplica a migração antes do serviço arrancar. A configuração automática de deploy no push é externa ao repositório. O seed separado `yarn workspace @anm/backend prisma:seed` usa upserts do mesmo catálogo, não apaga dados nem cria atividade demo por omissão. SEED_DEMO=1 é explícito e recusa bases com viaturas/clientes/vendas.

## Dados existentes e revisão

A migração copia os valores originais para legacyBrand, normaliza apenas correspondências inequívocas e associa as marcas conhecidas. Uma Nissan antiga, mesmo com case/espaços diferentes, passa a referenciar Nissan e o logo local. Outros dados e IDs mantêm-se; não há eliminação de viaturas, retomas, vendas ou despesas. Nomes desconhecidos/ambíguos ficam preservados em linhas inativas do catálogo e não são oferecidos como novas escolhas. Uma edição que envia a marca exige selecionar uma marca canónica; outras atualizações SQL da mesma linha podem preservar o nome antigo até ser revisto.

Consulta pós-migração, apenas de leitura, para inventário sem dados pessoais:

```sql
SELECT b.name, (SELECT count(*) FROM "Vehicle" v WHERE v.brand=b.name) AS vehicles,
  (SELECT count(*) FROM "TradeIn" t WHERE t.brand=b.name) AS trade_ins
FROM "VehicleBrand" b WHERE NOT b.active ORDER BY b.name;
```

## Logos e limites

Os 14 SVG do site foram reutilizados sem alteração de bytes. Outros assets são de Simple Icons 11.15.0, VehicleSpecs, car-logos-dataset e vehicle-logotypes, com origem e hash por ficheiro em `logo-inventory.json`. As licenças das coleções estão nesta pasta; não são uma autorização das marcas para usos promocionais. Em particular VehicleSpecs declara expressamente que a licença MIT da coleção **não abrange as imagens dos logos**, disponibilizadas para identificação/referência. O manifesto conserva esta distinção. Mantêm-se os direitos das marcas. Assets não são carregados de CDNs em runtime. O CRM aplica dimensões contidas e tratamento monocromático, preservando o sistema do site; bitmaps adicionais podem ter relevo/detalhes diferentes dos SVG originais.

17 marcas têm fallback textual/iniciais: Casalini, Chatenet, DR, Ebro, Elaris, Firefly, Forthing, Grecav, Matra, Micro, NSU, Renault Trucks, Silence, Skywell, TYN-e, XEV e Zhidou. Firefly tem fonte Wikimedia verificada, mas o download devolveu HTTP429 e não foi contornado; as restantes não tinham correspondência de asset verificada nas coleções examinadas. O fallback também é usado quando uma imagem falha. O nome permanece sempre visível e acessível. Logo em detalhe/listagens usa lookup canónico pelo nome; não requer introduzir de novo a viatura.

## Verificação

Testes isolados cobrem instalação vazia, aliases/acentos/case, Nissan legada, desconhecidos/ambíguos preservados, FK/trigger em inserts/updates, seed real repetido via adaptador PostgreSQL em memória, API HTTP e seleção desktop/mobile. Capturas `desktop-390.png` e `desktop-1366.png` usam o formulário real com fixtures, não dados ou sessão de produção. A verificação de build não encerra pendências legais/de publicação em `docs/publication-readiness.md`.

## Aplicação à base de teste — 29/10/2026

Após confirmar o alvo configurado no backend principal como TESTE com o proprietário, a inspeção de leitura encontrou apenas esta migração pendente e nenhuma falhada. Foi guardado snapshot local ignorado dos registos afetados antes de aplicar `migrate deploy`. A aplicação da migração concluiu com sucesso. A comparação posterior verificou todos os 45 registos Vehicle e 2 TradeIn e todos os seus campos originais: apenas a normalização prevista de marca mudou (audi → Audi). Quatro valores desconhecidos, em seis registos, ficaram preservados inativos para revisão; nenhuma correspondência foi inventada. Não houve reset ou exclusão de dados. A base de produção não foi alterada por comando direto; recebe a migração no arranque do deploy Docker autorizado.

## Logos no website público — correção de 29/10/2026

O mapa público anterior continha apenas 14 marcas; a primeira integração tinha atualizado apenas o CRM. O site agora usa `shared/vehicleBrandLogos.ts`, o mesmo resolver e assets do CRM, para diretório, filtro e ícone da ficha pública. O nome legado é resolvido na apresentação; não é necessário editar/recriar a viatura ou alterar a DB. O detalhe usa imagem real em vez de máscara alpha para também suportar os PNG verificados sem os transformar em retângulos opacos. Falha de imagem preserva o nome e usa o fallback existente.

`apps/website/test/public-brand-logos.browser.mjs` verifica o website compilado com um servidor de API pública fictício: Nissan e texto legado `  nIsSaN  `, HTML SSR, asset HTTP200/MIME/bytes reais, decode da imagem, desktop/mobile, BYD adicional e fallback XEV/falha de imagem. Todos os pedidos da fixture são GET, sem DB ou emails. Em mobile o diretório Explorar por marca continua oculto por design anterior; verificam-se o filtro de marca e a ficha. Capturas reais da fixture compilada: [diretório desktop](public-brands-1366.png) e [detalhe mobile](public-detail-390.png). O deploy publicado ainda precisa de confirmação externa; estas capturas não são de produção.

## Capturas locais geradas

Os PNG nesta pasta são artefactos gerados de QA e estão ignorados pelo Git; permanecem no disco quando são retirados do índice. Os links de capturas deste documento referem saídas locais após geração. Markdown, catálogo JSON, inventário de origem/hashes e licenças continuam versionados. Para regenerar as capturas do formulário CRM, executar `node --test apps/crm/test/brand-catalog.browser.mjs` na raiz. Para as capturas públicas, construir o website e executar `node test/public-brand-logos.browser.mjs` em `apps/website`; as saídas por omissão ficam em `.svelte-kit/public-brand-logos-review/`, também ignorado. `SCREENSHOT_DIR` permite escolher uma pasta local de QA. Nenhum destes testes envia emails ou altera dados de negócio.
