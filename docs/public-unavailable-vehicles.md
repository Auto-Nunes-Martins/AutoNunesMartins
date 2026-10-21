# Viaturas indisponíveis

O arquivo público e as autorizações separadas foram removidos a pedido do proprietário.

Um anúncio ativo continua com a publicação e a seleção de fotografias normais. Ao ficar indisponível, o endereço público consulta diretamente a ficha existente e responde HTTP 404 com marca, modelo, ano e a primeira fotografia existente da própria viatura. A imagem é apresentada atenuada e a página não contém preço, VIN, dados financeiros, oferta ou ações de compra.

Não existe snapshot, cópia de fotografia na base de dados, autorização adicional, backfill ou conservação após eliminação da ficha. Uma ficha inexistente ou um endereço nunca atribuído recebem «Viatura não encontrada». Se não houver fotografia, a página mostra a identificação sem imagem. Falhas reais de serviço continuam a responder HTTP 503.

A página usa no-store e não entra no catálogo, sitemap ou comparação. A fotografia permite armazenamento privado no navegador, com revalidação obrigatória e ETag: se não mudou, responde 304 sem repetir os bytes da imagem. A rota confirma em cada pedido que a ficha ainda existe e está indisponível, e apenas lê um caminho pertencente à própria viatura; respostas de erro continuam com no-store. Não são criados buckets nem modificados os originais.

A migração de remoção elimina apenas a tabela antiga. Não altera viaturas, fotografias, vendas ou despesas. As migrações anteriores mantêm-se como histórico.
