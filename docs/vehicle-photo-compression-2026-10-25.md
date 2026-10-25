# Compressão das fotografias de viaturas — 25/10/2026

Base: `395bbf4`. A receita das derivadas passou de WebP 90 para **WebP 84, esforço 6,
smartSubsample**, identificada por `encodingVersion: 3`. Não houve alterações ao fundo
do website, imagens decorativas, layout, animações, indexação ou dados oficiais.

## Escolha e qualidade

O inventário real confirmou 43 viaturas, 51 masters associados e 233 derivadas no bucket
privado. Foram lidos diretamente do Storage; não se consultou o website público.
Os masters totalizam 34 433 326 bytes e permanecem intactos.

Dez fontes representativas cobriram carroçarias claras, escuras e vermelhas, reflexos,
faróis, grelhas, jantes/pneus, noite, interior, fotografia vertical, uma origem já WebP
e texto pequeno. A referência foi a derivada 90 realmente guardada. A primeira comparação
usou WebP 86/82 e AVIF 75 com 4:4:4 a 1280 px. O refinamento comparou 86/84/82 em oito
fontes, nas miniaturas de 384 px e no maior tamanho aplicável até 1600 px.

A inspeção própria de recortes a pixels nativos e dos tamanhos apresentados selecionou
84: manteve a nitidez percebida e a leitura dos detalhes nesta amostra. Em 82, a perda
de microtextura é mais evidente; não foi adotado. As métricas de erro apoiaram a inspeção,
sem substituir o julgamento visual. Não se afirma equivalência matemática de pixels.

AVIF 75 reduziu 2 088 614 → 1 559 804 bytes na primeira amostra; WebP 86 já atingia
1 672 742 bytes. Nos casos exigentes, como o Audi Q3, ambos ficaram perto de 281 kB.
O ganho adicional não justificou alterar MIME types do bucket, negociação, fallback
e os URLs privados assinados. O formato WebP foi mantido em todos os clientes.

Também se comparou a normalização dos cinco inputs reais acima de 1,1 MB: esforço 6
com smartSubsample, mantendo qualidade 90, aumentou o conjunto de 1 315 712 para
1 333 928 bytes e consumiu mais CPU. A política do master foi conservada: alvo aproximado
de 1,1 MB, teto de 2 MB, maior lado inicial de 2560 px, qualidades 90/86/82 e esforço 4.
Inputs adequados continuam sem nova compressão de pixels, com filtragem de metadata.

As novas fotografias enviadas pelo CRM passam automaticamente pela receita 84 na
geração das derivadas, antes de o upload ser associado à viatura. O CRM continua a enviar
o original sem compressão no browser. Cada derivada parte do master, nunca de outra derivada.
O original privado mantém a sua função de arquivo e fallback/zoom nativo.

## Aplicação às fotografias existentes

A atualização autorizada processou todas as 51 fotografias e regenerou as 233 derivadas.
Os 51 manifests foram publicados por último. Zero falhas e zero fotografias ignoradas.
As derivadas e manifests anteriores ficaram copiados no cache local privado antes da aplicação.

| Largura | Derivadas | Antes, bytes | Depois, bytes |
| --- | ---: | ---: | ---: |
| 320 | 51 | 1 087 770 | 825 950 |
| 384 | 51 | 1 489 372 | 1 125 990 |
| 800 | 51 | 5 431 998 | 4 096 490 |
| 1280 | 41 | 9 776 922 | 7 293 200 |
| 1600 | 39 | 14 078 388 | 10 415 016 |
| Total | 233 | **31 864 450** | **23 756 646** |

Poupança de **8 107 804 bytes / 25,4%** no conjunto das derivadas. Nenhum master atual
exige uma derivada de 2560 px; a largura continua suportada para fontes adequadas.
Não se inferem destes bytes uma pontuação Lighthouse ou um LCP público.

## Verificação

- As 233 derivadas remotas foram novamente descarregadas e comparadas byte a byte
  com os candidatos locais aprovados. Todas as dimensões coincidiram.
- Os 51 masters foram novamente lidos: hashes iguais aos originais. Os hashes integrais
  dos campos das 43 viaturas e dos registos de dimensões também ficaram iguais,
  incluindo preços, fotos/ordem, estado e aprovações de publicação. Não houve escrita Prisma.
- A reutilização real de uma foto concluída retornou `reused: true`, `created: 0`.
  Testes cobrem atualização das receitas antigas, retry de lotes interrompidos e reuso.
- 379 testes do backend passaram, incluindo metadata, EXIF/orientação, uploads,
  autorização, revogação/ETags, cache e variantes. Tipos e build passaram com cliente
  Prisma gerado para o schema atual numa pasta privada desta worktree, sem modificar
  o cliente partilhado que estava desatualizado.
- 24 pares de renderização no Chrome local cobriram quatro fontes, miniatura/cartão/
  detalhe e DPR 1,5/3. As resoluções selecionadas foram as mesmas; o zoom que seleciona
  o master ficou pixel idêntico. As comparações foram alinhadas na mesma grelha física
  para não confundir subpixels de DPR fracionário com alteração da imagem.

MIME types, caminhos privados, identidade do master, autorização antes de cada leitura,
cache/ETags por conteúdo e cópias locais retidas da galeria foram preservados. Clientes
que já retêm pixels/URLs assinados podem conservar a versão anterior até à renovação normal.

Evidência privada não versionada: `.cache/photo-recipes/`, incluindo inventário, backups,
comparações nativas/browser, geração completa, relatório do backfill e verificação final.
Nenhum master, derivada de ensaio, credencial ou ficheiro de cache faz parte do commit.
