# Arquivo público mínimo de viaturas

Uma publicação aprovada guarda um registo independente com marca, modelo, ano e, quando existe, uma única fotografia explicitamente aprovada. Enquanto a ficha está publicada, o visitante recebe o anúncio normal. Depois de venda, despublicação ou exclusão física no CRM, o mesmo endereço responde com **HTTP 404**, identificação mínima permitida, indicação inequívoca de indisponibilidade e ligação ao catálogo. Não há preço, dados internos, contactos de compra, galeria, sugestões de outras viaturas ou dados estruturados de oferta nesse erro.

Endereços desconhecidos e viaturas nunca publicadas recebem o erro genérico. Uma falha real do serviço continua a produzir HTTP 503. Não existe prazo de expiração nem tarefa de limpeza por idade. Isto não altera os requisitos legais ou a aprovação de publicação do site.

## Evidência e armazenamento

O snapshot é gravado na mesma transação de uma publicação que foi validada com sucesso. Um slug isolado não constitui evidência. A chave de origem impede que outra viatura herde um endereço arquivado. O FK para a ficha usa `ON DELETE SET NULL`, conservando o snapshot permitido após exclusão física.

A fotografia é uma derivação WebP de até 800 px e 800 000 bytes, sem metadados do original, preparada fora da transação a partir de um caminho que pertence à viatura e foi explicitamente aprovado. A transação volta a verificar a aprovação. Os bytes ficam na tabela privada `PublicVehicleArchive`, com RLS ativa e sem políticas públicas. Isso acrescenta no máximo 800 KB por registo com foto à base de dados; deve ser considerado nos backups e capacidade. Não se criam buckets nem se alteram permissões ou originais do Storage. A derivação permite conservar o mínimo aprovado depois da eliminação do original. Não há reconstrução de imagens eliminadas ou utilização de fotografias privadas como substituição.

Fichas publicadas sem foto aprovada geram apenas identificação. A rota pública de imagem verifica a autorização em cada pedido, também contra a aprovação e existência na ficha enquanto esta existe. Os DTO públicos usam listas explícitas de campos. Caminhos privados, bytes, identificadores de CRM e a chave de origem não são devolvidos. Página e fotografia usam `no-store`; o arquivo não entra no catálogo, sitemap ou comparação.

## Retirada pelo proprietário

No CRM, **Site → Arquivo público** permite pesquisar os endereços, incluindo os de fichas já eliminadas. Retirar a identificação esconde todo o arquivo e apaga os bytes da fotografia. Retirar apenas a fotografia conserva a identificação e apaga os bytes. Remover a foto da ficha ou retirar a sua aprovação pública também revoga a cópia arquivada na mesma transação, pelo caminho imutável, independentemente da posição na galeria.

Estas retiradas são persistentes: voltar a publicar não as anula. Uma nova autorização explícita só é possível a partir de uma ficha atualmente publicada, com uma fotografia que continue aprovada; não recupera bytes anteriormente apagados. Uma despublicação normal ou venda conserva o arquivo permitido. Pedidos já concluídos e cópias que terceiros tenham guardado não podem ser apagados pelo serviço.

## Migração e preenchimento inicial

Aplicar **apenas** `20261018230000_minimal_public_vehicle_archive` antes de servir o código novo. A migração cria a tabela, índices, limite de tamanho, FK e RLS; não altera publicações, valores ou aprovações existentes. Validar numa base isolada e ensaiar a DDL exata numa transação com rollback. Não aplicar outras migrações pendentes por arrasto. Se aplicada isoladamente por SQL, registar essa mesma migração com `prisma migrate resolve --applied 20261018230000_minimal_public_vehicle_archive` usando o schema correto.

`backend/scripts/backfill-public-archives.ts` começa em modo de inspeção. `--apply` captura em série apenas fichas **atualmente publicadas, disponíveis/reservadas e sem venda**, volta a validar na transação e respeita retiradas existentes. Aceita `--report <caminho>` e verifica que o estado das fichas não mudou. Usa o instante atual como evidência; não inventa uma data histórica. Não escreve no Storage nem altera a ficha.

Fichas anteriormente despublicadas, vendidas ou eliminadas sem snapshot verificável não são reconstruídas a partir de slugs ou logs ambíguos. Continuam no 404 genérico. Publicações futuras passam a criar o arquivo automaticamente.
