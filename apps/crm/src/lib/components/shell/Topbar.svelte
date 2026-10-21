<script lang="ts">
  import { crmPath } from '$lib/paths';
  import { page } from '$app/stores';
  import { onMount } from 'svelte';
  import { Menu, X } from 'lucide-svelte';
  import BrandPlus from '$lib/components/brand/icons/BrandPlus.svelte';
  import BrandSearch from '$lib/components/brand/icons/BrandSearch.svelte';
  import ThemeToggle from '$lib/components/brand/ThemeToggle.svelte';
  import NotificationBell from '$lib/components/shell/NotificationBell.svelte';
  import GlobalSearch from '$lib/components/shell/GlobalSearch.svelte';
  import type { SearchHit } from './searchNavigation';
  import { mobileDrawer } from '$lib/stores/sidebar';

  interface Props {
    crumbs?: string[];
    showAddVehicle?: boolean;
    hasAlerts?: boolean;
    userKey?: string;
  }

  let { crumbs, showAddVehicle = true, hasAlerts = false, userKey = '' }: Props = $props();

  const resolvedCrumbs = $derived.by<string[]>(() => {
    if (crumbs) return crumbs;
    const path = $page.url.pathname;
    if (path === crmPath('/dashboard')) return ['Painel', 'Dashboard'];
    if (path.startsWith(crmPath('/viaturas'))) return ['Painel', 'Viaturas'];
    if (path.startsWith(crmPath('/clientes'))) return ['Painel', 'Clientes'];
    if (path.startsWith(crmPath('/tarefas'))) return ['Painel', 'Tarefas'];
    if (path.startsWith(crmPath('/vendas'))) return ['Painel', 'Vendas'];
    if (path.startsWith(crmPath('/financeiro'))) return ['Painel', 'Financeiro'];
    if (path.startsWith(crmPath('/atividade'))) return ['Painel', 'Atividade'];
    if (path.startsWith(crmPath('/guia'))) return ['Painel', 'Guia de Fluxo'];
    if (path.startsWith(crmPath('/site'))) return ['Painel', 'Site público', 'Destaques'];
    if (path.startsWith(crmPath('/definicoes'))) return ['Painel', 'Definições'];
    return ['Painel'];
  });

  // The active leaf crumb doubles as the mobile page title since the full
  // breadcrumb trail is hidden below md (path is implied by hamburger nav).
  const pageTitle = $derived(resolvedCrumbs[resolvedCrumbs.length - 1] ?? 'Painel');

  // Mobile search-expansion state. When true, the search takes over the
  // entire topbar row and the other action buttons are hidden. Tap the X
  // to collapse back to the icon.
  let mobileSearchOpen = $state(false);
  let searchHost = $state<HTMLDivElement>();
  onMount(() => {
    const key = (event: KeyboardEvent) => {
      if (
        (event.metaKey || event.ctrlKey) &&
        event.key.toLowerCase() === 'k' &&
        !mobileSearchOpen &&
        searchHost &&
        !searchHost.getClientRects().length
      ) {
        event.preventDefault();
        event.stopImmediatePropagation();
        mobileSearchOpen = true;
      }
    };
    window.addEventListener('keydown', key, true);
    return () => window.removeEventListener('keydown', key, true);
  });
  let recentHits = $state<SearchHit[]>([]);
  $effect(() => {
    userKey;
    recentHits = [];
  });
</script>

<header
  class="topbar relative flex items-center gap-3 md:gap-4 px-4 md:px-6 py-3 md:py-[22px] border-b border-[var(--color-border)]"
>
  {#if !mobileSearchOpen}
    <!-- Hamburger (mobile only) — toggles the sidebar drawer.
         Visibility owned by .tb-icbtn's media query, not `md:hidden`. -->
    <button
      type="button"
      class="tb-icbtn"
      onclick={() => mobileDrawer.toggle()}
      aria-label="Abrir menu"
    >
      <Menu class="h-5 w-5" />
    </button>

    <!-- Breadcrumbs (desktop) -->
    <div class="tb-breadcrumbs items-center gap-2 flex-shrink-0">
      <span class="h-1.5 w-1.5 bg-[var(--color-red)]"></span>
      <div class="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.12em]">
        {#each resolvedCrumbs as crumb, i (i)}
          {#if i > 0}
            <span class="text-[var(--color-text-faint)]">/</span>
          {/if}
          <span
            class={i === resolvedCrumbs.length - 1
              ? 'text-[var(--color-text)] font-semibold'
              : 'text-[var(--color-text-muted)]'}
          >
            {crumb}
          </span>
        {/each}
      </div>
    </div>

    <!-- Mobile page title (replaces breadcrumb trail). Same red-dot prefix
         and mono treatment so it reads as part of the same family. -->
    <div class="tb-page-title items-center gap-2 flex-1 min-w-0">
      <span class="h-1.5 w-1.5 bg-[var(--color-red)] flex-shrink-0"></span>
      <span
        class="font-mono text-[11px] uppercase tracking-[0.12em] text-[var(--color-text)] font-semibold truncate"
      >
        {pageTitle}
      </span>
    </div>
  {/if}

  <!-- Available header width decides whether search is inline or opened
       by its compact trigger, including when the desktop sidebar is visible. -->
  {#if !mobileSearchOpen}<div class="tb-search-inline flex-1 min-w-0" bind:this={searchHost}>
      <GlobalSearch {userKey} bind:recentHits />
    </div>{/if}

  {#if mobileSearchOpen}
    <div class="tb-search-expanded flex flex-1 min-w-0">
      <GlobalSearch {userKey} bind:recentHits autofocus />
    </div>
    <button
      type="button"
      class="tb-icbtn tb-search-close flex-shrink-0"
      onclick={() => (mobileSearchOpen = false)}
      aria-label="Fechar pesquisa"
    >
      <X class="h-5 w-5" />
    </button>
  {/if}

  <!-- Actions row (right). Hidden on mobile while the search overlay is
       expanded so the search input gets the full width. -->
  {#if !mobileSearchOpen}
    <div class="flex items-center gap-2 flex-shrink-0 ml-auto">
      <!-- Mobile-only search icon button (replaces inline search field). -->
      <button
        type="button"
        class="tb-icbtn tb-search-toggle"
        onclick={() => (mobileSearchOpen = true)}
        aria-label="Pesquisar"
      >
        <BrandSearch class="h-4 w-4" />
      </button>

      <!-- Theme toggle: desktop only. Theme lives inside the sidebar drawer
           on mobile via the user-footer (future). O export ficava aqui mas
           foi removido — cada secção tem o seu próprio ExportMenu, o do
           topbar nunca chegou a estar ligado a nenhum endpoint. -->
      <div class="tb-theme">
        <ThemeToggle size={44} />
      </div>

      <NotificationBell />

      {#if showAddVehicle}
        <!-- Desktop: full red CTA with italic uppercase label. Mobile:
             icon-only red square so the brand red still anchors the topbar
             without consuming a label's worth of width. -->
        <a
          href={crmPath('/viaturas/nova')}
          class="tb-add-label inline-flex items-center gap-2 h-11 px-[18px] font-display font-semibold italic uppercase text-[13px] tracking-[0.01em] text-white bg-[var(--color-red)] hover:bg-[var(--color-red-soft)] transition-colors"
          style="border-radius: var(--radius-btn);"
        >
          <BrandPlus class="h-4 w-4" />
          Adicionar Viatura
        </a>
        <a
          href={crmPath('/viaturas/nova')}
          class="tb-add-icon items-center justify-center h-11 w-11 text-white bg-[var(--color-red)] hover:bg-[var(--color-red-soft)] transition-colors"
          style="border-radius: var(--radius-btn);"
          aria-label="Adicionar viatura"
        >
          <BrandPlus class="h-4 w-4" />
        </a>
      {/if}
    </div>
  {/if}
</header>

<style>
  .topbar {
    container-type: inline-size;
  }
  .tb-breadcrumbs,
  .tb-search-inline {
    display: flex;
  }
  .tb-theme {
    display: inline-flex;
  }
  .tb-page-title,
  .tb-add-icon {
    display: none;
  }
  .tb-icbtn.tb-search-close {
    display: inline-flex;
  }
  @container (max-width: 900px) {
    .tb-breadcrumbs,
    .tb-search-inline,
    .tb-add-label {
      display: none;
    }
    .tb-page-title,
    .tb-add-icon {
      display: flex;
    }
    .tb-icbtn.tb-search-toggle {
      display: inline-flex;
    }
  }
  @container (max-width: 520px) {
    .tb-theme {
      display: none;
    }
  }
  /*
    The menu follows the sidebar's mobile breakpoint. Search follows the
    header's available width; its close button remains available while open.

    Visibility is owned here (not via Tailwind's `md:hidden`) because the
    Svelte-scoped `.tb-icbtn.svelte-xxx` selector has higher specificity
    than a flat utility class, so its `display: inline-flex` would beat
    `md:hidden` and the buttons would leak onto desktop.

    44px touch target, matching the shared actions and search field.
  */
  .tb-icbtn {
    display: none;
    align-items: center;
    justify-content: center;
    height: 44px;
    width: 44px;
    border: 1px solid var(--color-border);
    background: transparent;
    color: var(--color-text-muted);
    border-radius: var(--radius-btn);
    flex-shrink: 0;
    transition:
      color 0.12s,
      border-color 0.12s,
      background 0.12s;
  }
  @media (max-width: 767px) {
    .tb-icbtn {
      display: inline-flex;
    }
  }
  .tb-icbtn:hover {
    color: var(--color-text);
    border-color: var(--color-border-strong);
    background: rgba(255, 255, 255, 0.025);
  }
  :global([data-theme='light']) .tb-icbtn:hover {
    background: rgba(0, 0, 0, 0.025);
  }
</style>
