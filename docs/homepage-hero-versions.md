# Home: versões independentes do hero

A versão 2 continua utilizável pelo seletor **1 / 2 em desenvolvimento**. Não é
um backup inativo. A versão inicial continua a ser a 1 e o seletor continua ausente
em produção. Navbar, catálogo, CRM e dados não foram alterados nesta extração.

## Onde alterar cada versão

| Área                         | Versão 1                                                                   | Versão 2 preservada                             |
| ---------------------------- | -------------------------------------------------------------------------- | ----------------------------------------------- |
| Estrutura e destaques        | `HomeHeroV1.svelte`, montado no ramo V1 de `DesignEdition.svelte`          | `HomeHeroV2.svelte`                             |
| Fotografia                   | `HomeHeroV1Photo.svelte` e ambiente decorativo em `assets/images/hero-v1/` | fotografias públicas dos destaques              |
| Estilos do hero              | `homeHeroV1.css`, classes `.hero-v1` / `.v1-*`, variáveis `--v1-*`         | `homeHeroV2.css`, classes `.v2-*` / `.hero-v2*` |
| Ambiente, linha e iluminação | fundo fotográfico próprio, sem efeitos de pointer                          | `HomeHeroV2Backdrop.svelte`                     |
| Scroll e pointer             | altura anterior preservada, sem pinning ou animação ligada ao scroll       | `homeHeroV2Motion.ts`                           |

Para remodelar a versão 1, editar a coluna V1. Não é necessário alterar os ficheiros
da V2. A V2 tem índice de destaques próprio; cada montagem começa no primeiro
destaque. Alterar o carrossel ou o markup V1 não modifica o carrossel V2.

A V1 atual usa apenas um fundo decorativo e um cartão compacto de destaques.
O título da página continua acessível, sem headline visual. As dimensões verticais
anteriores são preservadas em CSS privado, incluindo a fórmula mobile. O antigo
afinador de fachadas deixou de fazer parte da V1; os ficheiros e fotografias de
origem permanecem no repositório. A navegação comum reconhece `.hero-v1` como
limite do hero sem alterar o seu desenho. Os seletores CSS órfãos da composição
antiga foram retirados de `DesignEdition.svelte`.

Proveniência da imagem gerada, dimensões reais e verificação da composição atual:
[`homepage-hero-v1.md`](./homepage-hero-v1.md).

## Limites de isolamento

- A estrutura V2 está num componente efetivamente montado quando se escolhe 2.
- As classes e IDs V2 são próprios; não reutiliza `.orbit-intro`, `.orbit-title`,
  `.orbit-object`, `#orbit-featured` nem outras ligações visuais específicas V1.
- Geometria, estado de iluminação e motion usam variáveis `--v2-*`, incluindo
  frame, dimensões, progresso e pointer. As regras V1 já não as fornecem.
- `homeHeroV2.css` contém apenas as regras de origem pertinentes à composição
  preservada, com os breakpoints e a ordem da cascata revistos. Não consulta CSSOM
  ou estilos calculados durante a execução. Classes privadas repetidas preservam
  a especificidade original, sem depender de hashes de compilação Svelte.
- O backdrop e o ponto vermelho V2 são próprios. As fórmulas de scroll V2 foram
  preservadas no seu módulo, sem importar o motion nem as fórmulas V1.
- V2 não expõe `data-scene`, `data-scroll-hero` ou `data-hero-stage`. O bootstrap
  `orbit-startup.js` e o observador de cenas V1 não a tratam como cena V1.
- A ação V2 gere e limpa os seus próprios listeners, `ResizeObserver` e frames.
  Respeita reduced-motion, estado do documento e scroll nativo, sem pinning.

Continuam partilhados os dados públicos dos destaques, fontes, tokens de cor,
logótipos, funções genéricas de imagens/números, ícones e o tema do website.
Mudanças deliberadas à identidade global podem, portanto, afetar ambas as versões.
A navbar é comum e permanece fora desta separação. O booleano `hasAddress` apenas
informa a composição preservada sobre a presença da faixa de contactos.

## Validação da extração

Foram comparados 20 casos antes/depois: larguras 1440, 1024, 768, 390 e 320,
claro/escuro, topo e 220 píxeis de scroll. Caixas, tipografia, opacidade e posição
coincidiram; a maior diferença geométrica foi aproximadamente 0,027 píxeis no
objeto, decorrente do amortecimento do pointer. Na área visível do hero, a maior
diferença média por canal de imagem foi inferior a 0,235 numa escala de 255.

As capturas e medidas desta ronda estão em `.cache/hero-v2-before/` e
`.cache/hero-v2-after/`, ignoradas pelo Git. Não são dependências da aplicação.

Verificação reproduzível com website e backend locais ligados:

```powershell
node scripts/check-home-hero-isolation.mjs
```

O teste cobre seis combinações de viewport/tema, teclado dos destaques, troca
1/2, reduced-motion e mudança dinâmica de tema. Injeta alterações agressivas em
classes e variáveis V1 e verifica que não alteram a V2. As capturas deste teste
ficam em `.cache/hero-v2-isolation/`. Os destaques públicos precisam de conter
pelo menos duas viaturas disponíveis para testar navegação.

`homeHeroV2Motion.test.ts` verifica as poses e limites das fórmulas próprias.
Depois de alterar uma versão, executar os testes adequados e os checks/builds do
website. Esta separação não constitui aprovação de publicação nem altera
pendências de dados oficiais ou de privacidade.
