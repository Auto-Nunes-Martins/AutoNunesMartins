<script lang="ts">
  import { page } from '$app/stores';
  import { crmPath } from '$lib/paths';
  import ItalicHero from '$lib/components/brand/ItalicHero.svelte';
  import { Star, MessageSquare, Tag } from 'lucide-svelte';
  import type { Snippet } from 'svelte';
  let { children }: { children: Snippet } = $props();
  const reviews = $derived($page.route.id?.startsWith('/(app)/site/reviews'));
  const campaigns = $derived($page.route.id === '/(app)/site/campanhas');
</script>

<section class="site-workspace">
  <header>
    <p>MONTRA ONLINE · GESTÃO DE CONTEÚDO</p>
    <ItalicHero text="Site público" size="lg" />
  </header>
  <nav aria-label="Secções do site público">
    <a href={crmPath('/site/destaques')} aria-current={!reviews && !campaigns ? 'page' : undefined}
      ><Star size={17} aria-hidden="true" />Destaques da homepage</a
    >
    <a href={crmPath('/site/campanhas')} aria-current={campaigns ? 'page' : undefined}
      ><Tag size={17} aria-hidden="true" />Campanhas</a
    >
    <a href={crmPath('/site/reviews')} aria-current={reviews ? 'page' : undefined}
      ><MessageSquare size={17} aria-hidden="true" />Reviews</a
    >
  </nav>
  {@render children()}
</section>

<style>
  .site-workspace {
    padding: 32px 0 48px;
    min-width: 0;
  }
  header {
    margin-bottom: 26px;
  }
  header p {
    font: 10px var(--font-mono);
    letter-spacing: 0.12em;
    color: var(--color-text-muted);
    margin-bottom: 12px;
  }
  nav {
    display: flex;
    flex-wrap: wrap;
    gap: 24px;
    border-bottom: 1px solid var(--color-border-strong);
    margin-bottom: 28px;
  }
  nav a {
    display: inline-flex;
    align-items: center;
    gap: 9px;
    min-height: 48px;
    padding: 0 2px 12px;
    border-bottom: 2px solid transparent;
    margin-bottom: -1px;
    color: var(--color-text-muted);
    font-size: 13px;
    font-weight: 600;
  }
  nav a[aria-current='page'] {
    border-bottom-color: var(--color-red);
    color: var(--color-text);
  }
  nav a:hover {
    color: var(--color-text);
  }
  nav a:focus-visible {
    outline: 2px solid var(--color-red);
    outline-offset: 3px;
    border-radius: 3px;
  }
  @media (max-width: 600px) {
    nav {
      gap: 18px;
    }
    nav a {
      font-size: 12px;
      gap: 7px;
    }
    header p {
      font-size: 9px;
    }
  }
</style>
