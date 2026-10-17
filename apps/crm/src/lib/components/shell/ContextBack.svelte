<script lang="ts">
  import { afterNavigate } from '$app/navigation';
  import { page } from '$app/stores';
  import { crmPath, crmRoute } from '$lib/paths';
  import { contextualParent, listContext } from '$lib/navigationContext';
  let { userKey }: { userKey: string } = $props();
  let lists = $state<Record<string, string>>({});
  $effect(() => { userKey; lists = {}; });
  afterNavigate(({ from }) => {
    const previous = from && listContext(crmRoute(from.url.pathname), from.url.search);
    if (previous) lists = { ...lists, [previous.section]: previous.href };
    const context = listContext(crmRoute($page.url.pathname), $page.url.search);
    if (context) lists = { ...lists, [context.section]: context.href };
  });
  const parent = $derived(contextualParent(crmRoute($page.url.pathname)));
  const href = $derived(parent && /^\/[a-z]+$/.test(parent.href) ? lists[parent.href.slice(1)] ?? parent.href : parent?.href);
</script>
{#if parent && href}<a class="context-back" href={crmPath(href)}>← {parent.label}</a>{/if}
<style>.context-back { display:inline-flex; align-items:center; min-height:44px; gap:8px; font-size:13px; color:var(--color-text-muted); text-decoration:none; margin-top:16px; } .context-back:hover {color:var(--color-text);} .context-back:focus-visible {outline:2px solid var(--color-red);outline-offset:3px;}</style>
