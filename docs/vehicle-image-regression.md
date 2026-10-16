# Placeholder de viaturas — regressão de 16/10/2026

O commit `a65575a` mudou o placeholder de `/catalog-placeholder.svg` para uma importação versionada pelo Vite. O SVG continua igual ao original, incluindo a silhueta e a legenda; não faltava o ficheiro.

Na compilação de produção, o servidor usa `/_app/immutable/assets/catalog-placeholder.<hash>.svg`, enquanto o módulo do navegador usa `new URL('../assets/catalog-placeholder.<hash>.svg', import.meta.url).href`. A função `photo()` em `data.ts` e `porscheLabData.ts` só preservava valores começados por `/`. Um URL absoluto passou, por isso, a ser interpretado como identificador do Unsplash.

Ao repetir o teste de navegador com a regra antiga, a navegação interna gerou pedidos deste formato:

```text
https://images.unsplash.com/http://127.0.0.1:<porta>/_app/immutable/assets/catalog-placeholder.<hash>.svg?auto=format&fit=crop&w=1100&q=85
```

Isto explica por que o caminho fixo anterior funcionava e por que uma abertura direta, renderizada pelo servidor, podia funcionar enquanto a navegação interna falhava. A otimização WebP/AVIF em curso não alterou o SVG. Não foi comparada a revisão atualmente instalada em produção.

A função partilhada transforma agora apenas identificadores `photo-...`. Os restantes URLs mantêm-se intactos. A ação `vehiclePhoto` usa o mesmo placeholder quando uma fotografia falha, remove candidatos `srcset` em falha e recupera quando muda a fonte. Aplica-se aos cartões partilhados por catálogo, favoritos e relacionados, à comparação, ficha, miniaturas, galeria e destaque. As falhas de dados/API continuam com os estados e respostas existentes.

Validação no worktree, com backend fictício e Chrome:

- 374 testes Vitest aprovados, incluindo URLs importados, ausência de foto, erro anterior à hidratação, fallback e recuperação.
- Svelte: zero erros e zero avisos; compilação Node/Vite aprovada.
- `scripts/check-vehicle-images.mjs`: abertura direta e navegação interna, catálogo, favoritos, comparação, relacionados, ficha sem foto, foto falhada, troca para foto válida e regresso à falha, galeria e destaque. Verifica descodificação, SVG HTTP 200/MIME correto, ausência de pedidos malformados e de exceções no navegador. A regra antiga falha a verificação de navegação interna.

Para repetir após compilar o website, executar `node scripts/check-vehicle-images.mjs` com Chromium do Playwright instalado, ou definir `PLAYWRIGHT_CHANNEL=chrome` para usar Chrome instalado. O script requer Playwright, já incluído nas dependências de desenvolvimento do backend. Não acede a Supabase, não altera fotografias reais e não publica o website.
