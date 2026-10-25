# Dimensões persistidas das fotografias públicas

A tabela aditiva `VehiclePhotoDimensions` associa a versão SHA-256 do caminho imutável da fotografia à largura/altura normalizadas pelo manifest dos derivados. O upload guarda as dimensões já calculadas; não transforma a imagem novamente. O hash da origem permanece privado.

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

O comando é read-only por omissão. Só lê sidecars das fotografias atualmente aprovadas de viaturas públicas; nunca descarrega originais nem gera/substitui derivados. Os limites máximos são 1000 viaturas, 50 por lote e quatro leituras concorrentes. Revalida publicação e aprovação antes de inserir; ignora versões existentes. O relatório inclui contagens e cursor, sem caminhos privados. Repetir a aplicação não deve inserir duplicados. Em falhas, o cursor conserva o início do lote que deve ser repetido. Para continuar uma população superior ao limite, usar `--after=<nextCursor>`; manifests ausentes mantêm fallback e podem ser recuperados numa execução posterior desde o início.

## Recuperação

O código anterior funciona com a tabela adicional. Reverter a aplicação pode deixar a tabela e os registos derivados sem utilização; não é necessário apagar dados em produção. A migração foi aplicada e revertida numa base PostgreSQL local descartável, incluindo constraints e cascade. Isto não constitui um backup da base remota.
