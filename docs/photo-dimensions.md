# Dimensões persistidas das fotografias públicas

A tabela aditiva `VehiclePhotoDimensions` associa a versão SHA-256 do caminho imutável da fotografia à largura/altura normalizadas pelo manifest dos derivados. O upload guarda as dimensões já calculadas; não transforma a imagem novamente. O hash da origem permanece privado.

Os fluxos de publicação e edição preparam também dimensões em falta de fotografias existentes que pertencem à viatura, antes de abrir a transação. Não geram nem substituem imagens. A transação continua a validar a seleção/aprovação atual. Versões já conhecidas não voltam a ler manifests; uma falha temporária ou manifest legado ausente mantém fallback e é tentada novamente numa gravação posterior.

As listas públicas fazem uma consulta indexada em lote para as capas que o DTO já autorizou. Só `{version,width,height}` é exposto. Reordenar a capa seleciona a versão correta; retirar aprovação elimina a fotografia da projeção independentemente de haver metadata residual. A remoção de fotografias tenta também limpar as dimensões. A relação elimina metadata quando a viatura é eliminada.

O website só aceita dimensões da versão atual e calcula o `sizes` mobile inicial considerando `object-fit: cover`. Mantém o observador e os fallbacks para versões antigas, metadata ausente e alterações da caixa. Não há consulta de storage no render do catálogo. Ausência da tabela ou falha da consulta opcional conserva a resposta autorizada sem dimensões.

## Migração e preenchimento

Confirmar projeto, histórico e lista completa das migrações pendentes antes de executar. A migração `20261025040000_photo_dimensions` cria apenas a nova tabela, índice e constraints; não altera fotografias, viaturas ou aprovações. A migração seguinte, `20261025040100_photo_dimensions_rls`, ativa explicitamente RLS na nova tabela privada, sem políticas públicas; o backend proprietário é responsável pela projeção autorizada.

No diretório `backend`, com o ambiente configurado:

```powershell
node --env-file=.env ../node_modules/prisma/build/index.js migrate deploy --schema prisma/schema.prisma
node --env-file=.env --import tsx scripts/backfill-photo-dimensions.ts --dry-run --limit=1000 --batch-size=25 --concurrency=2
node --env-file=.env --import tsx scripts/backfill-photo-dimensions.ts --apply --limit=1000 --batch-size=25 --concurrency=2
```

O comando é read-only por omissão. Por defeito, só lê sidecars das fotografias atualmente aprovadas de viaturas públicas. A opção explícita `--include-private` inclui também fotografias privadas com caminhos válidos e ainda associados à respetiva viatura; não altera publicação nem aprovação e os novos registos continuam protegidos por RLS. Aplicar primeiro `--dry-run --include-private` e depois, quando autorizado, `--apply --include-private` com os mesmos limites.

Nunca descarrega originais nem gera/substitui derivados. Os limites máximos são 1000 viaturas, 50 por lote e quatro leituras concorrentes. Revalida associação e, no âmbito público, publicação/aprovação antes de inserir; ignora versões existentes. O relatório inclui contagens e cursor, sem caminhos privados. Repetir a aplicação não deve inserir duplicados. Em falhas, o cursor conserva o início do lote que deve ser repetido. Para continuar uma população superior ao limite, usar `--after=<nextCursor>`; manifests ausentes mantêm fallback e podem ser recuperados numa execução posterior desde o início. Esta extensão usa a tabela existente e não precisa de nova migração.

## Recuperação

Validação de 25/10/2026: o dry-run incluiu 51 fotografias de 43 viaturas, 28 dimensões existentes e 23 disponíveis em falta. A aplicação autorizada criou apenas essas 23 linhas; a repetição encontrou 51 existentes e criou zero. Zero manifests ausentes/falhas. O hash de todos os dados das 43 viaturas permaneceu igual; RLS ativo e zero linhas visíveis ao papel `anon`. Fotografias privadas não passaram a públicas. Não houve nova migração nem escrita de imagens.

O código anterior funciona com a tabela adicional. Reverter a aplicação pode deixar a tabela e os registos derivados sem utilização; não é necessário apagar dados em produção. A migração foi aplicada e revertida numa base PostgreSQL local descartável, incluindo constraints e cascade. Isto não constitui um backup da base remota.
