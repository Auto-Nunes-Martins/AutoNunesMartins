<script lang="ts">
  import { sessionFetch } from '$lib/auth/session';
  import { crmPath } from '$lib/paths';
  import { goto } from '$app/navigation';
  import { onMount, onDestroy } from 'svelte';
  import { X } from 'lucide-svelte';
  import BrandSearch from '$lib/components/brand/icons/BrandSearch.svelte';
  import { searchShortcuts, safeSearchHit, rememberSearchHit, type SearchHit } from './searchNavigation';
  let { userKey = '', autofocus = false, recentHits = $bindable<SearchHit[]>([]) }: { userKey?: string; autofocus?: boolean; recentHits?: SearchHit[] } = $props();
  type Payload = { vehicles: SearchHit[]; customers: SearchHit[]; tasks: SearchHit[]; total: number };
  let query = $state(''), open = $state(false), loading = $state(false), error = $state('');
  let results = $state<Payload | null>(null), activeIndex = $state(-1);
  let loadedUserKey: string | undefined;
  let inputEl: HTMLInputElement, containerEl: HTMLDivElement;
  let listEl = $state<HTMLDivElement>(undefined!);
  const uid = $props.id(), listId = uid + '-results';
  const cache = new Map<string, Payload>();
  let debounce: ReturnType<typeof setTimeout> | undefined, controller: AbortController | undefined, generation = 0;
  const needle = $derived(query.trim());
  const groups = $derived(needle ? results ? [
    { label: 'Viaturas', hits: results.vehicles }, { label: 'Clientes', hits: results.customers }, { label: 'Tarefas', hits: results.tasks },
  ].filter(group => group.hits.length) : [] : [
    ...(recentHits.length ? [{ label: 'Recentes nesta sessão', hits: recentHits }] : []), { label: 'Acesso rápido', hits: searchShortcuts },
  ]);
  const flat = $derived(groups.flatMap(group => group.hits));
  function cancelRequest() { clearTimeout(debounce); controller?.abort(); generation += 1; loading = false; }
  function close() { open = false; cancelRequest(); activeIndex = -1; }
  function clear() { cancelRequest(); query = ''; results = null; error = ''; activeIndex = -1; open = true; inputEl?.focus(); }
  async function search(value: string) {
    const current = ++generation;
    controller?.abort(); controller = new AbortController(); const signal = controller.signal;
    const cached = cache.get(value); results = cached ?? null; loading = true; error = '';
    try {
      const response = await sessionFetch(crmPath(`/api/search?q=${encodeURIComponent(value)}&limit=5`), { signal, headers: { accept: 'application/json' } });
      if (!response.ok) throw new Error('Pesquisa indisponível. Tente novamente.');
      const data = await response.json() as Payload;
      if (signal.aborted || current !== generation || value !== query.trim()) return;
      if (![data.vehicles, data.customers, data.tasks].every(Array.isArray)) throw new Error('Resposta de pesquisa inválida.');
      results = { ...data, vehicles: data.vehicles.filter(safeSearchHit), customers: data.customers.filter(safeSearchHit), tasks: data.tasks.filter(safeSearchHit) };
      cache.delete(value); cache.set(value, results); if (cache.size > 50) cache.delete(cache.keys().next().value!);
      activeIndex = -1;
    } catch (failure) {
      if (signal.aborted || current !== generation) return;
      results = null; error = failure instanceof Error ? failure.message : 'Pesquisa indisponível.';
    } finally { if (current === generation) loading = false; }
  }
  function onInput(event?: Event) {
    if (event?.currentTarget instanceof HTMLInputElement) query = event.currentTarget.value;
    cancelRequest(); activeIndex = -1; results = null; error = ''; open = true;
    const value = query.trim();
    if (value) { loading = true; debounce = setTimeout(() => { void search(value); }, 180); }
  }
  async function pick(hit: SearchHit) {
    if (!safeSearchHit(hit)) return;
    close();
    try { await goto(crmPath(hit.href)); const target = new URL(crmPath(hit.href), location.origin); if (location.pathname + location.search === target.pathname + target.search) { if (hit.id !== 'query') recentHits = rememberSearchHit(recentHits, hit); query = ''; results = null; } }
    catch { /* The unsaved-changes guard can cancel navigation; keep the typed query. */ }
  }
  function keydown(event: KeyboardEvent) {
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(); return; }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault(); open = true;
      activeIndex = event.key === 'ArrowDown' ? Math.min(flat.length - 1, activeIndex + 1) : activeIndex < 0 ? flat.length - 1 : Math.max(0, activeIndex - 1);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (open && flat[activeIndex]) void pick(flat[activeIndex]!);
      else if (needle) void pick({ id: 'query', primary: needle, secondary: 'Pesquisa no stock', href: `/viaturas?q=${encodeURIComponent(needle)}` });
    }
  }
  $effect(() => { const nextUser = userKey; if (loadedUserKey !== undefined && loadedUserKey !== nextUser) recentHits = []; loadedUserKey = nextUser; cancelRequest(); cache.clear(); query = ''; results = null; error = ''; open = false; });
  $effect(() => { if (activeIndex >= 0) listEl?.querySelector<HTMLElement>(`[data-search-idx="${activeIndex}"]`)?.scrollIntoView({ block: 'nearest' }); });
  onMount(() => {
    if (autofocus) inputEl?.focus();
    const outside = (event: PointerEvent) => { if (!containerEl.contains(event.target as Node)) close(); };
    const shortcut = (event: KeyboardEvent) => {
      if (!inputEl?.getClientRects().length) return;
      const target = document.activeElement;
      if (((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') || (event.key === '/' && !(target instanceof HTMLElement && target.closest('input,textarea,select,[contenteditable="true"]')))) {
        event.preventDefault(); inputEl.focus(); inputEl.select(); open = true;
      }
    };
    document.addEventListener('pointerdown', outside); window.addEventListener('keydown', shortcut);
    return () => { document.removeEventListener('pointerdown', outside); window.removeEventListener('keydown', shortcut); };
  });
  onDestroy(cancelRequest);
</script>
<div bind:this={containerEl} class="gs-root relative flex-1 min-w-0 max-w-[540px] mx-2" onfocusout={event => { if (event.relatedTarget instanceof Node && !containerEl.contains(event.relatedTarget)) close(); }}>
  <div class="gs-input-shell border rounded-xs" class:is-open={open}>
    <BrandSearch class="h-4 w-4 text-[var(--color-text-faint)] flex-shrink-0" />
    <input bind:this={inputEl} bind:value={query} oninput={onInput} onclick={() => open = true} onfocus={() => { open = true; if (needle) void search(needle); }} onkeydown={keydown}
      type="search" role="combobox" aria-autocomplete="list" aria-haspopup="listbox" aria-expanded={open} aria-controls={open ? listId : undefined}
      aria-activedescendant={open && activeIndex >= 0 && flat[activeIndex] ? `${uid}-option-${activeIndex}` : undefined}
      placeholder="Pesquisar viaturas, clientes, tarefas…" class="flex-1 min-w-0 bg-transparent px-3 text-[13px] outline-none placeholder:text-[var(--color-text-faint)]"
      autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" aria-label="Pesquisar" />
    {#if loading}<span class="gs-spinner" aria-hidden="true"></span>{/if}
    {#if query}<button type="button" onclick={clear} class="gs-clear" aria-label="Limpar pesquisa"><X size={16} aria-hidden="true" /></button>{:else}<kbd class="gs-kbd-hint">⌘K</kbd>{/if}
  </div>
  {#if open}
    <div class="gs-dropdown" style="border-radius:var(--radius-card)">
      {#if !needle && recentHits.length}<div class="gs-recent-tools"><span>Histórico apenas desta sessão</span><button type="button" onclick={() => { recentHits = []; activeIndex = -1; inputEl.focus(); }}>Limpar recentes</button></div>{/if}
      <div role="status" class="gs-search-status">{error || (loading ? 'A pesquisar…' : needle && !flat.length ? 'Sem resultados para esta pesquisa.' : !needle ? 'Escolha um acesso rápido ou escreva para pesquisar.' : `${flat.length} resultado(s).`)}</div>
      <div id={listId} role="listbox" aria-label={needle ? 'Resultados da pesquisa' : 'Recentes e acesso rápido'} bind:this={listEl} class="gs-scroll">
        {#each groups as group, groupIndex (group.label)}
          <div class="gs-group" role="group" aria-label={group.label}>
            <div class="gs-group-header" aria-hidden="true">{group.label}</div>
            {#each group.hits as hit, localIndex (hit.href)}
              {@const index = groups.slice(0, groupIndex).reduce((count, item) => count + item.hits.length, 0) + localIndex}
              <button type="button" role="option" tabindex="-1" id={`${uid}-option-${index}`} data-search-idx={index} aria-selected={index === activeIndex}
                onmouseenter={() => activeIndex = index} onclick={() => void pick(hit)} class="gs-item" class:is-active={index === activeIndex}>
                <BrandSearch class="gs-item-icon h-4 w-4" /><span class="gs-item-body"><span class="gs-item-title">{hit.primary}</span>{#if hit.secondary}<span class="gs-item-sub">{hit.secondary}</span>{/if}</span><span aria-hidden="true">↗</span>
              </button>
            {/each}
          </div>
        {/each}
      </div>
      {#if error}<button type="button" class="gs-retry" onclick={() => void search(needle)}>Tentar novamente</button>{/if}
    </div>
  {/if}
</div>
<style>
  .gs-search-status,.gs-recent-tools {font-size:12px;padding:10px 14px;color:var(--color-text-muted);}
  .gs-recent-tools {display:flex;justify-content:space-between;gap:8px;} .gs-recent-tools button,.gs-retry {min-height:36px;text-decoration:underline;text-underline-offset:3px;} .gs-retry {margin:8px 14px;}

  /* ─── Input shell ───────────────────────────────────────────────────── */
  .gs-input-shell {
    position: relative;
    display: flex;
    align-items: center;
    height: 44px;
    padding: 0 12px;
    border: 1px solid var(--color-border);
    background: rgba(255, 255, 255, 0.02);
    transition: border-color 0.12s;
  }
  .gs-root {
    min-width: 0;
  }
  .gs-clear {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: 0 0 44px;
    min-height: 44px;
    padding: 0;
    margin-right: -8px;
  }
  .gs-input-shell:hover,
  .gs-input-shell.is-open {
    border-color: var(--color-border-strong);
  }

  /* Hide the browser's built-in clear button on type="search" — we render
     our own X chip below so the native one would just duplicate it. */
  .gs-input-shell input::-webkit-search-cancel-button,
  .gs-input-shell input::-webkit-search-decoration {
    -webkit-appearance: none;
    appearance: none;
  }
  .gs-input-shell input {
    appearance: textfield;
    -moz-appearance: textfield;
  }
  @media (pointer: coarse) {
    .gs-input-shell input {
      font-size: 16px;
    }
  }

  .gs-spinner {
    width: 12px;
    height: 12px;
    border: 1.5px solid color-mix(in oklab, var(--color-red) 40%, transparent);
    border-top-color: var(--color-red);
    border-radius: 50%;
    animation: gs-spin 0.7s linear infinite;
    margin-right: 6px;
  }
  @keyframes gs-spin {
    to {
      transform: rotate(360deg);
    }
  }

  .gs-kbd-hint {
    display: none;
    align-items: center;
    padding: 2px 6px;
    border: 1px solid var(--color-border);
    border-radius: 3px;
    color: var(--color-text-faint);
    font-family: 'JetBrains Mono', monospace;
    font-size: 10px;
    text-transform: uppercase;
    user-select: none;
  }
  @media (min-width: 640px) {
    .gs-kbd-hint {
      display: inline-flex;
    }
  }

  /* ─── Dropdown ──────────────────────────────────────────────────────── */
  /* Same surface treatment as the input shell — translucent white-tint
     over the page bg, same border, same radius — so the dropdown reads
     as a continuation of the search field. */
  .gs-dropdown {
    position: absolute;
    left: 0;
    right: 0;
    top: calc(100% + 6px);
    z-index: 30;
    background:
      linear-gradient(
        180deg,
        rgba(255, 255, 255, 0.03) 0%,
        rgba(255, 255, 255, 0.02) 100%
      ),
      var(--color-bg-0);
    border: 1px solid var(--color-border);
    box-shadow: 0 8px 16px -8px rgba(0, 0, 0, 0.5);
    overflow: hidden;
  }
  :global([data-theme='light']) .gs-dropdown {
    background:
      linear-gradient(180deg, rgba(0, 0, 0, 0.015) 0%, rgba(0, 0, 0, 0.02) 100%),
      var(--color-bg-elevated);
  }

  .gs-scroll {
    max-height: 56vh;
    overflow-y: auto;
  }

  /* ─── Group headers ─────────────────────────────────────────────────── */
  .gs-group:not(:first-child) {
    border-top: 1px solid var(--color-border);
    margin-top: 4px;
    padding-top: 4px;
  }
  .gs-group-header {
    padding: 10px 14px 4px;
    font-family: 'JetBrains Mono', monospace;
    font-size: 10px;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--color-text-faint);
  }

  /* ─── Items ─────────────────────────────────────────────────────────── */
  .gs-item {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    padding: 8px 14px;
    text-align: left;
    color: var(--color-text);
    background: transparent;
    border: 0;
    cursor: pointer;
  }
  .gs-item:hover,
  .gs-item.is-active {
    background: rgba(255, 255, 255, 0.04);
  }
  .gs-item :global(.gs-item-icon) {
    flex-shrink: 0;
    color: var(--color-text-muted);
  }
  .gs-item-body {
    display: flex;
    flex-direction: column;
    min-width: 0;
    flex: 1;
  }
  .gs-item-title {
    font-size: 13.5px;
    line-height: 1.25;
    color: var(--color-text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .gs-item-sub {
    font-size: 11.5px;
    color: var(--color-text-faint);
    margin-top: 2px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* ─── Empty / loading state ─────────────────────────────────────────── */

  /* ─── Footer ────────────────────────────────────────────────────────── */
</style>
