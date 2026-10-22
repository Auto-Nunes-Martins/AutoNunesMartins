# Integração das sete versões do header

**Integrada no projeto original em 22 de outubro de 2026**, após autorização
explícita do utilizador: `C:/Users/Goncalo/Desktop/AI/AutoNunesMartins`.
A worktree e o preview separado foram preservados.

## Âmbito do patch e estado observado antes da integração

| Ficheiro                                                                                                                            | Situação no original na comparação                                                                                                | Sobreposição                                                                                                                                        |
| ----------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/website/src/lib/components/stand-concepts/DesignEdition.svelte`                                                               | Tem alterações locais anteriores à tarefa (36 linhas acrescentadas / 13 retiradas). Conteúdo igual à cópia recebida inicialmente. | Mesmo ficheiro partilhado com ajustes de detalhe/galeria, mas os quatro blocos deste patch limitam-se a imports, estado e montagem/seletor do hero. |
| `apps/website/src/lib/components/stand-concepts/homeHeroPhoto.css`                                                                  | Sem alterações locais; igual à base inicial.                                                                                      | Ajuste do seletor numérico; nenhum conflito observado.                                                                                              |
| `docs/homepage-hero-versions.md`                                                                                                    | Sem alterações locais; igual à base inicial.                                                                                      | Documentação substituída para refletir as sete versões.                                                                                             |
| `HomeHeroDirections.svelte`, `homeHeroDirections.css`, `homeHeroDirections.ts` em `apps/website/src/lib/components/stand-concepts/` | Novos ficheiros, ausentes no original.                                                                                            | Nenhum conflito de nome observado.                                                                                                                  |
| `apps/website/src/lib/assets/images/hero-directions/coast-640.webp` e `coast-1086.webp`                                             | Novos ficheiros, ausentes no original.                                                                                            | Nenhum conflito de nome observado.                                                                                                                  |
| `scripts/check-home-hero-directions.mjs`                                                                                            | Novo ficheiro, ausente no original.                                                                                               | Verificação read-only através do Chrome/Playwright já usado pelos scripts do projeto.                                                               |
| `docs/homepage-hero-integration.md`                                                                                                 | Novo ficheiro, ausente no original.                                                                                               | Esta nota de integração.                                                                                                                            |

Não foram detetadas alterações posteriores à base inicial nos três ficheiros
existentes afetados. Isto descreve o estado observado; outro chat pode continuar
a alterá-lo. Deve repetir-se a verificação imediatamente antes de integrar.

## Evidência e risco

O patch de integração de `DesignEdition.svelte` foi produzido comparando a cópia
inicial da worktree com a versão final. Só esses quatro blocos são incluídos no
commit, preservando fora dele as alterações de detalhe/galeria que já existiam.
Os ficheiros próprios da V2 não foram alterados. As diferenças de bytes entre
checkouts nesses ficheiros resultam dos finais de linha; o conteúdo normalizado
é idêntico.

`git apply --check` passou para o patch completo dos dez ficheiros no original,
com código de saída 0, em modo somente de leitura.
A aplicação posterior foi autorizada expressamente pelo utilizador. Os patches
incrementais dos headers e de `OrbitEditorialPause.svelte` foram aplicados sem
conflitos. Não se substituiu `DesignEdition.svelte` inteiro: os ajustes locais de
detalhe/galeria foram preservados.

O risco concreto é substituir o ficheiro `DesignEdition.svelte` inteiro e perder
os ajustes locais partilhados, ou integrar depois de novas alterações ao mesmo
bloco do hero. Usar o patch delimitado e confirmar que o check continua a passar;
não copiar o ficheiro inteiro nem usar checkout/reset sobre alterações locais.
Os novos recursos, CSS e componentes pertencem apenas a esta tarefa.

## Preview

**Website habitual: http://localhost:5173/** — seletor inferior 1–7.

Estado final escolhido pelo utilizador:
- **http://localhost:5173/#proximo-passo** mantém exatamente o efeito aceite,
  com alcance de 8vh por lado e sem atraso/spring.
- **http://localhost:5173/#contactos** (“Venha conhecer-nos”) tem fundo estático:
  fotografia e sombra acompanham a secção normalmente, sem timeline de scroll.

Fotografia e sobreposição escura estão dentro de um único plano. Na primeira
secção, este é animado por uma timeline de scroll nativa em CSS e composto com
`will-change: transform`; na segunda é estático. A faixa
recorta esse plano comum. Isto mantém a cobertura até às margens fracionárias,
eliminando o filete claro que se via na margem inferior quando a imagem era fixa
e a sombra tinha uma geometria separada. O perfil do Chrome confirma uma camada
com transform animado na primeira secção, em vez de duas; a segunda já não tem
camadas com animação de scroll.

Não há listeners JavaScript de scroll ou temporizadores de amortecimento.
Funciona sem JavaScript; movimento reduzido ou falta de suporte a scroll timelines
mantêm o fundo estático. Texto, mapa, formulário, botões e layout foram preservados.

Preview separado preservado: **http://127.0.0.1:5183/**.

Ligações diretas: `http://127.0.0.1:5183/?hero=1` a
`http://127.0.0.1:5183/?hero=7`. A versão 2 está disponível no mesmo seletor.
O backend público local na porta 4000 é necessário para os destaques reais.
O preview separado corre nesta worktree. O servidor habitual foi reutilizado,
sem interromper o CRM na porta 5174 nem o backend na porta 4000.

## Resultado da validação

- Svelte/TypeScript: zero erros e zero avisos.
- Testes do website: 48 ficheiros, 438 testes aprovados.
- Build de produção com adapter-node: concluído.
- Browser: 70 combinações (sete versões × cinco larguras × dois temas), sem
  overflow ou erros de runtime; fotografia, ligações, teclado e scroll verificados.
- Preferência de movimento reduzido, acesso por URL direta e falha de fotografia:
  verificados.
- V2: teste existente de isolamento aprovado em seis combinações de largura/tema,
  além de movimento reduzido e mudança dinâmica de tema. Os quatro ficheiros
  próprios permanecem sem diferenças face a HEAD.

Relatórios e capturas: `.cache/hero-directions/` e `.cache/hero-v2-isolation/`.

Depois da integração, as sete versões e fotografias foram novamente verificadas
no servidor original, em desktop (1440px) e mobile (390px), sem erros de runtime.
Os quatro ficheiros próprios da V2 mantêm conteúdo idêntico. A paralaxe no original
foi verificada em 1440, 390 e 320px, com layout estável, margens cobertas,
movimento reduzido dinâmico e ausência de JavaScript. A ronda final de intensidade
e composição verificou as duas secções em 1440 e 390px: scroll contínuo lento,
rápido, inversão e paragem sem arrasto; fotografia/sombra sincronizadas num plano;
capturas das margens sem o filete claro; movimento reduzido; zero erros de runtime.
As proporções medidas de deslocamento do fundo foram 0,885 na primeira faixa e
0,907/0,938 em “Venha conhecer-nos” (desktop/mobile). Relatório:
`.cache/hero-directions/final-windows-report.json`. O typecheck final passou com
zero erros e zero avisos. As versões do header não foram alteradas nesta afinação.

Após a decisão de deixar “Venha conhecer-nos” estática, confirmou-se novamente no
website habitual (1440 e 390px) que a fotografia se desloca exatamente com a
secção, sem animação, e a sombra cobre a imagem. O hash do ficheiro de “O próximo
passo começa aqui” permaneceu idêntico antes/depois desta última alteração.
