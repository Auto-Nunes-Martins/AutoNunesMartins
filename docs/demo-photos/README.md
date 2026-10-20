# Fotografias do catálogo fictício

## Fontes e apresentação de demonstração

O proprietário pediu a remoção dos componentes públicos de créditos durante
a revisão visual. A ficha e a informação legal já não apresentam esses blocos.
As fontes, os autores e as licenças continuam preservados em `sources.json`
e nas descrições dos registos de demonstração. Antes de uma publicação real,
continua pendente rever este conteúdo fictício e assegurar a atribuição exigida
pelas licenças ou substituir as imagens por fotografias próprias adequadas.

## Histórico de preparação

Em 20 de outubro de 2026, o proprietário autorizou procurar imagens online
reutilizáveis para preencher as 12 viaturas de demonstração publicadas que não
tinham fotografias. Inicialmente foram usadas nove imagens do Wikimedia Commons: Q5, Série 3
Touring G21, A3 Sportback 8Y, Q3, 508 SW, Golf VIII, Clio V, Model 3 e Clio II.
Numa correção posteriormente pedida pelo proprietário, as três capas repetidas
foram substituídas por fontes realmente diferentes. A auditoria completa revelou
também fotografias antigas de outros modelos e conteúdo sem relação com as
viaturas. As seis galerias antigas receberam imagens dos modelos corretos.
Nessa ronda ficaram 18 capas distintas e 20 fotografias públicas. Depois, a pedido
do proprietário, o Jogger foi ampliado para **12 imagens distintas**, mantendo
as três anteriores: o resultado atual é **18 capas e 29 fotografias públicas**.
Não foram criadas falsas diferenças por
espelhamento, recorte ou compressão da mesma imagem.

Estas imagens **não representam os exemplares anunciados**. A descrição pública
identifica-as como ilustrações de demonstração e inclui autor, fonte, licença e
alterações. Cor, equipamento e motorização podem diferir dos dados fictícios.
Nenhuma imagem foi gerada por IA ou retirada de anúncios sem licença de utilização.

## Fontes e direitos

[sources.json](sources.json) regista os 29 ficheiros, páginas de origem,
autores, licenças verificadas nos metadados do Commons, URLs de descarga,
dimensões e SHA-256 dos bytes revistos visualmente. Seis imagens usam CC0,
21 usam CC BY-SA 4.0, o A3 usa CC BY-SA 3.0 Alemanha e o interior do Jogger usa
CC BY 4.0.
As fotografias e os seus derivados mantêm as licenças indicadas. Essas licenças
não se estendem automaticamente ao código nem às outras fotografias do site.

As únicas alterações às imagens são os thumbnails do Commons e o pipeline
existente de redimensionamento/compressão. Os masters mantêm 1920 píxeis de largura;
cada um tem variantes WebP de 320, 800 e 1600. Não há montagens nem alterações
generativas. A seleção visual verificou modelo, carroçaria e geração plausíveis;
não constitui confirmação de uma ficha técnica ou de um exemplar real.

## Execução e reversão

A ferramenta não corre em seed, startup ou deploy. Sem opções faz apenas preview:

```powershell
node --env-file=backend/.env --import tsx backend/scripts/populate-demo-photos.mjs
```

A aplicação efetuada usou:

```powershell
node --env-file=backend/.env --import tsx backend/scripts/populate-demo-photos.mjs --apply --backup .cache/demo-photo-backup-20261020.json --report .cache/demo-photo-applied-20261020.json
```

O backup ignorado pelo Git foi escrito antes dos uploads e da transação. Regista
os valores anteriores e posteriores de `photos`, `publicPhotoPaths` e
`publicDescription`, bem como a identidade do destino e os caminhos criados.
A ferramenta verifica o hash da fonte, recusa substituir fotos privadas
existentes e verifica concorrência e campos protegidos dentro da transação.
IDs, slugs, publicação, disponibilidade, vendas, clientes, despesas e arquivos
não foram alterados. Na primeira aplicação, as seis viaturas que já tinham fotos
conservaram-nas. Na correção posterior, todos esses originais e associações
privadas foram preservados; apenas as aprovações públicas foram substituídas.

Reversão das associações e descrições, recusando sobrepor alterações posteriores:

```powershell
node --env-file=backend/.env --import tsx backend/scripts/populate-demo-photos.mjs --revert .cache/demo-photo-backup-20261020.json --report .cache/demo-photo-reverted-20261020.json
```

A reversão mantém os ficheiros no armazenamento privado para recuperação; deixam
de estar disponíveis na API pública ao perderem as associações aprovadas.
O backup é específico destes três campos, não substitui um backup integral da DB.

A reaplicação depois de concluído encontra zero viaturas sem fotografia e faz
zero escritas. Foram verificadas as 12 fichas públicas e as variantes 320/800.
Estes dados e imagens fictícios não resolvem pendências de informação oficial nem
constituem aprovação de lançamento do website.

## Correção de repetições e galerias antigas

As correções tiveram backups independentes e as mesmas verificações de
concorrência, campos protegidos e integridade dentro da transação:

```powershell
node --env-file=backend/.env --import tsx backend/scripts/populate-demo-photos.mjs --replace-repeated --apply --backup .cache/demo-photo-distinct-backup-20261020.json --report .cache/demo-photo-distinct-applied-20261020.json
node --env-file=backend/.env --import tsx backend/scripts/populate-demo-photos.mjs --correct-existing --apply --backup .cache/demo-photo-correct-existing-backup-20261020.json --report .cache/demo-photo-correct-existing-applied-20261020.json
```

O primeiro modo corrigiu as segundas viaturas Q5, Série 3 Touring e Golf. O
segundo corrigiu 911, Model S, 320d Touring, Classe C, A6 Avant e Jogger. Os
originais antigos continuam no armazenamento privado e em `Vehicle.photos`.
Jogos, sapatilhas, screenshots, mota e modelos incorretos deixaram de estar
aprovados para o site. A galeria pública do Jogger tem três imagens distintas;
são ilustrativas e podem mostrar cores diferentes, como a descrição esclarece.

A auditoria final descarregou as 20 fotografias pela API pública e comparou
SHA-256 dos bytes, SHA-256 dos píxeis normalizados e proximidade visual
(difference hash e erro nos píxeis). Não encontrou pares repetidos, incluindo
dentro da mesma galeria. As 18 capas têm hashes diferentes e foram também
inspecionadas numa montagem visual. Variantes 320/800/1600 da mesma fotografia
são deliberadamente tratadas como derivados, não como fotografias diferentes.

Os dois modos, repetidos sem `--apply`, encontram zero alterações. Para reverter,
usar `--revert` com o backup correspondente; a ferramenta recusa sobrepor edições
posteriores. Numa reversão completa, começar pelas correções mais recentes e só
depois reverter a primeira aplicação. Os backups anteriores permanecem intactos.

## Jogger com 12 fotografias e destaques da homepage

O pedido seguinte acrescentou nove imagens de origem distintas à galeria do
Jogger, mantendo a capa e as três fotografias públicas anteriores. As 12 têm
créditos individuais na descrição (dentro do limite de 6000 caracteres), incluindo
um interior. São imagens ilustrativas de diferentes exemplares da mesma geração.
A auditoria global confirmou 29 imagens públicas sem pares repetidos e 18 capas
distintas. As variantes de cada imagem continuam a ser derivados da mesma fonte.

```powershell
node --env-file=backend/.env --import tsx backend/scripts/populate-demo-photos.mjs --expand-jogger --apply --backup .cache/demo-jogger-twelve-backup-20261020.json --report .cache/demo-jogger-twelve-applied-20261020.json
```

O CRM permite no máximo 20 referências em `Vehicle.photos`. O Jogger tinha
13 originais de teste antigos e três novos. Para permitir 12 públicos sem impedir
a edição no CRM, foram retiradas apenas cinco associações antigas de screenshots
e jogos, revistas visualmente; os cinco ficheiros continuam no armazenamento
privado. Ficaram oito referências antigas privadas e 12 públicas. O backup acima
guarda **todas** as associações anteriores e posteriores e permite repor exatamente
a galeria anterior com `--revert`, sem descarregar nem recriar os originais.
Nenhum ficheiro foi apagado. Os outros 38 veículos não foram alterados.

A configuração `AppSetting.homepageHighlights` apontava para cinco fotos antigas
que já não estavam aprovadas, pelo que não existiam destaques públicos válidos.
Foi reparada através de `saveHighlights`, com três escolhas disponíveis e fotos
aprovadas: Jogger, Q5 e 911. A chamada registou a atividade normal de auditoria.
Não alterou dados de viaturas, publicação, disponibilidade ou informação financeira.

```powershell
node --env-file=backend/.env --import tsx backend/scripts/configure-demo-highlights.mjs --apply --backup .cache/demo-highlights-backup-20261020.json --report .cache/demo-highlights-applied-20261020.json
```

O modo sem `--apply` é preview. Uma seleção já válida com pelo menos três
viaturas é preservada. A reversão específica da configuração é:

```powershell
node --env-file=backend/.env --import tsx backend/scripts/configure-demo-highlights.mjs --revert .cache/demo-highlights-backup-20261020.json
```

A reversão recusa substituir uma configuração modificada posteriormente. O backup
contém a configuração anterior completa, incluindo a revisão. Foram confirmados
os três destaques na API pública, no HTML servido pelo website e na navegação do
carrossel. A galeria de 12 foi testada em 1440, 390 e 320 píxeis, em claro e escuro,
incluindo seleção da última miniatura, créditos e ausência de overflow da página.
