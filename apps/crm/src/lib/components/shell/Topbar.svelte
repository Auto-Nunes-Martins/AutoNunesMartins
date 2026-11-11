<script lang="ts">
  import { crmPath } from '$lib/paths';
  import { page } from '$app/stores';
  import { flushSync, onMount } from 'svelte';
  import { afterNavigate } from '$app/navigation';
  import { Menu, X } from 'lucide-svelte';
  import BrandPlus from '$lib/components/brand/icons/BrandPlus.svelte';
  import BrandSearch from '$lib/components/brand/icons/BrandSearch.svelte';
  import ThemeToggle from '$lib/components/brand/ThemeToggle.svelte';
  import NotificationBell from '$lib/components/shell/NotificationBell.svelte';
  import GlobalSearch from '$lib/components/shell/GlobalSearch.svelte';
  import type { SearchHit } from './searchNavigation';
  import { mobileDrawer } from '$lib/stores/sidebar';
  import { quickTask } from '$lib/stores/quickTask';

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
    if (path.startsWith(crmPath('/site/reviews'))) return ['Painel', 'Site público', 'Reviews'];
    if (path.startsWith(crmPath('/site')))
      return ['Painel', 'Site público', 'Destaques da homepage'];
    if (path.startsWith(crmPath('/definicoes'))) return ['Painel', 'Definições'];
    return ['Painel'];
  });

  // The active leaf crumb doubles as the mobile page title since the full
  // breadcrumb trail is hidden below md (path is implied by hamburger nav).
  const pageTitle = $derived(resolvedCrumbs[resolvedCrumbs.length - 1] ?? 'Painel');

  // Mobile search-expansion state. When true, the search takes over the
  // entire topbar row and the other action buttons are hidden.
  let mobileSearchOpen = $state(false);
  let notificationsOpen = $state(false);
  let scrollHidden = $state(false);
  let searchToggle: HTMLButtonElement;
  let searchHost = $state<HTMLDivElement>();
  let searchLayer: HTMLDivElement;
  let compactSearch: ReturnType<typeof GlobalSearch>;
  let header: HTMLElement;
  let scrollAnchor = 0;
  let ignoreScrollUntil = 0;
  let searchScroll: { x: number; y: number; until: number } | undefined;
  const pinned = $derived(mobileSearchOpen || $mobileDrawer || notificationsOpen);

  function syncSearchTrigger() {
    const trigger = searchToggle.getBoundingClientRect();
    if (!trigger.width) return;
    const layer = searchLayer.getBoundingClientRect();
    searchLayer.style.setProperty('--search-trigger-left', `${trigger.left - layer.left}px`);
    searchLayer.style.setProperty('--search-trigger-width', `${trigger.width}px`);
  }

  function openSearch() {
    if ($mobileDrawer) return;
    searchScroll = undefined;
    quickTask.close();
    notificationsOpen = false;
    scrollHidden = false;
    syncSearchTrigger();
    // Focus within the activating click, while iOS can still open the keyboard.
    flushSync(() => (mobileSearchOpen = true));
    compactSearch?.focus();
  }

  function closeSearch(restoreFocus = true) {
    const { scrollX: x, scrollY: y } = window;
    scrollAnchor = Math.max(0, y);
    ignoreScrollUntil = performance.now() + 260;
    searchScroll = { x, y, until: performance.now() + 550 };
    if (
      document.activeElement instanceof HTMLElement &&
      searchLayer.contains(document.activeElement)
    ) {
      document.activeElement.blur();
    }
    flushSync(() => (mobileSearchOpen = false));
    if (restoreFocus) searchToggle?.focus({ preventScroll: true });
    restoreSearchScroll();
    requestAnimationFrame(restoreSearchScroll);
  }

  function restoreSearchScroll() {
    if (!searchScroll || performance.now() > searchScroll.until) return;
    const { x, y } = searchScroll;
    if (window.scrollX !== x || window.scrollY !== y) {
      window.scrollTo({ left: x, top: y, behavior: 'instant' });
    }
  }

  afterNavigate(() => {
    searchScroll = undefined;
    scrollAnchor = Math.max(0, window.scrollY);
    scrollHidden = false;
    mobileSearchOpen = false;
  });

  $effect(() => {
    if ($quickTask || $mobileDrawer) mobileSearchOpen = false;
  });
  $effect(() => {
    if (!mobileSearchOpen) compactSearch?.reset();
  });

  onMount(() => {
    const mobile = window.matchMedia('(max-width: 767px)');
    const searchResize = new ResizeObserver(syncSearchTrigger);
    searchResize.observe(header);
    searchResize.observe(searchToggle);
    syncSearchTrigger();
    function onScroll() {
      const y = Math.max(0, window.scrollY);
      if (!mobile.matches || pinned || y <= 0 || performance.now() < ignoreScrollUntil) {
        scrollHidden = false;
      } else if (Math.abs(y - scrollAnchor) < 5) {
        return;
      } else {
        scrollHidden = y > scrollAnchor;
      }
      scrollAnchor = y;
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    mobile.addEventListener('change', onScroll);
    const viewport = window.visualViewport;
    const syncViewport = () => {
      if (!viewport || viewport.scale !== 1) return;
      header.style.setProperty('--tb-visible-height', `${viewport.height}px`);
      header.style.setProperty('--tb-visible-top', `${Math.max(0, viewport.offsetTop)}px`);
    };
    syncViewport();
    const resizeViewport = () => {
      syncViewport();
      restoreSearchScroll();
    };
    viewport?.addEventListener('resize', resizeViewport);
    viewport?.addEventListener('scroll', syncViewport);
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
        openSearch();
      }
    };
    const dismissOutside = (event: PointerEvent) => {
      searchScroll = undefined;
      if (mobileSearchOpen && !searchLayer.contains(event.target as Node)) closeSearch(false);
    };
    const cancelScrollRestore = () => (searchScroll = undefined);
    const dismissEscape = (event: KeyboardEvent) => {
      if (mobileSearchOpen && event.key === 'Escape' && !event.defaultPrevented) {
        event.preventDefault();
        closeSearch();
      }
    };
    document.addEventListener('pointerdown', dismissOutside, true);
    window.addEventListener('wheel', cancelScrollRestore, { passive: true });
    window.addEventListener('keydown', key, true);
    window.addEventListener('keydown', dismissEscape);
    return () => {
      searchResize.disconnect();
      document.removeEventListener('pointerdown', dismissOutside, true);
      window.removeEventListener('wheel', cancelScrollRestore);
      window.removeEventListener('keydown', key, true);
      window.removeEventListener('keydown', dismissEscape);
      window.removeEventListener('scroll', onScroll);
      mobile.removeEventListener('change', onScroll);
      viewport?.removeEventListener('resize', resizeViewport);
      viewport?.removeEventListener('scroll', syncViewport);
    };
  });
  let recentHits = $state<SearchHit[]>([]);
  $effect(() => {
    userKey;
    recentHits = [];
  });
</script>

<div class="topbar-slot" class:scroll-hidden={scrollHidden && !pinned}>
  <header
    class="topbar relative px-4 md:px-6 py-3 md:py-[22px] border-b border-[var(--color-border)]"
    class:searching={mobileSearchOpen}
    bind:this={header}
  >
    <div
      class="tb-normal flex items-center gap-3 md:gap-4"
      class:search-open={mobileSearchOpen}
      inert={mobileSearchOpen}
    >
      <!-- Hamburger (mobile only) — toggles the sidebar drawer.
         Visibility owned by .tb-icbtn's media query, not `md:hidden`. -->
      <button
        id="crm-drawer-trigger"
        type="button"
        class="tb-icbtn"
        onclick={() => mobileDrawer.toggle()}
        aria-label="Abrir menu"
        aria-expanded={$mobileDrawer}
        aria-controls="crm-sidebar"
      >
        <Menu class="h-5 w-5" />
      </button>

      <!-- Breadcrumbs (desktop) -->
      <div class="tb-breadcrumbs items-center gap-2" title={resolvedCrumbs.join(' / ')}>
        <span class="h-1.5 w-1.5 bg-[var(--color-red)]"></span>
        <div
          class="crumb-trail flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.12em]"
        >
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
      <!-- Available header width decides whether search is inline or opened
       by its compact trigger, including when the desktop sidebar is visible. -->
      <div class="tb-search-inline flex-1 min-w-0" bind:this={searchHost}>
        <GlobalSearch {userKey} bind:recentHits />
      </div>

      <div class="tb-actions flex items-center gap-2 flex-shrink-0 ml-auto">
        <!-- Mobile-only search icon button (replaces inline search field). -->
        <button
          type="button"
          class="tb-icbtn tb-search-toggle"
          bind:this={searchToggle}
          onclick={openSearch}
          aria-label="Pesquisar"
          aria-expanded={mobileSearchOpen}
        >
          <BrandSearch class="h-4 w-4" />
        </button>

        <!-- Show the theme toggle on desktop; mobile uses the sidebar drawer. Export actions belong to each section rather than the topbar, whose former control was never connected to an endpoint. -->
        <div class="tb-theme">
          <ThemeToggle size={44} round />
        </div>

        <NotificationBell bind:isOpen={notificationsOpen} />

        {#if showAddVehicle}
          <!-- Desktop: full red CTA with italic uppercase label. Mobile:
             icon-only red square so the brand red still anchors the topbar
             without consuming a label's worth of width. -->
          <a
            href={crmPath('/viaturas/nova')}
            class="tb-add-label inline-flex items-center gap-2 h-[44px] px-[18px] font-display font-semibold italic uppercase text-[13px] tracking-[0.01em] text-white bg-[var(--color-red)] hover:bg-[var(--color-red-soft)] transition-colors"
            style="border-radius: var(--radius-btn);"
          >
            <BrandPlus class="h-4 w-4" />
            Adicionar Viatura
          </a>
          <a
            href={crmPath('/viaturas/nova')}
            class="tb-add-icon items-center justify-center h-[44px] w-[44px] text-white bg-[var(--color-red)] hover:bg-[var(--color-red-soft)] transition-colors"
            style="border-radius: var(--radius-btn);"
            aria-label="Adicionar viatura"
          >
            <BrandPlus class="h-4 w-4" />
          </a>
        {/if}
      </div>
    </div>
    <div
      class="tb-search-expanded flex items-center gap-2"
      bind:this={searchLayer}
      inert={!mobileSearchOpen}
    >
      <GlobalSearch {userKey} bind:recentHits bind:this={compactSearch} onDismiss={closeSearch} />
      <button
        type="button"
        class="tb-icbtn tb-search-close"
        onclick={() => closeSearch()}
        aria-label="Fechar pesquisa"
      >
        <X class="h-5 w-5" />
      </button>
    </div>
  </header>
</div>

<style>
  .topbar {
    container-type: inline-size;
  }
  .tb-normal > :not(.tb-actions),
  .tb-actions > :global(*) {
    transition:
      opacity 125ms ease 90ms,
      translate 240ms var(--ease-brand);
  }
  .search-open > :not(.tb-actions),
  .search-open .tb-actions > :global(*) {
    opacity: 0;
    transition:
      opacity 135ms ease,
      translate 240ms var(--ease-brand);
  }
  .search-open > :not(.tb-actions) {
    translate: -8px 0;
  }
  .search-open .tb-actions > :global(:not(.tb-search-toggle)) {
    translate: 8px 0;
  }
  .search-open .tb-actions > .tb-search-toggle {
    transition: opacity 65ms ease;
  }
  .tb-search-expanded {
    position: absolute;
    inset: 0 16px;
    opacity: 0;
    transition: opacity 130ms ease 100ms;
  }
  .searching .tb-search-expanded {
    opacity: 1;
    transition: opacity 65ms ease;
  }
  .tb-search-expanded > :global(.gs-root) {
    max-width: none;
    margin-inline: 0;
  }
  .tb-search-expanded :global(.gs-input-shell) {
    --search-start: var(--search-trigger-left, 0px);
    --search-width: var(--search-trigger-width, 44px);
    margin-left: var(--search-start);
    margin-right: calc(100% - var(--search-start) - var(--search-width));
    border-radius: 22px;
    overflow: hidden;
    transition:
      margin 240ms var(--ease-brand),
      border-radius 240ms var(--ease-brand),
      border-color 120ms ease;
  }
  .searching .tb-search-expanded :global(.gs-input-shell) {
    margin-inline: 0;
    border-radius: 10px;
  }
  .tb-search-expanded :global(.gs-input-shell input),
  .tb-search-expanded :global(.gs-input-shell kbd) {
    opacity: 0;
    transition: opacity 85ms ease;
  }
  .searching .tb-search-expanded :global(.gs-input-shell input),
  .searching .tb-search-expanded :global(.gs-input-shell kbd) {
    opacity: 1;
    transition: opacity 130ms ease 60ms;
  }
  .tb-icbtn.tb-search-close {
    opacity: 0;
    transition: opacity 90ms ease;
  }
  .searching .tb-icbtn.tb-search-close {
    opacity: 1;
    transition: opacity 130ms ease 95ms;
  }
  .tb-search-expanded :global(.gs-scroll) {
    max-height: min(56dvh, max(64px, calc(var(--tb-visible-height, 100dvh) - 150px)));
  }
  @media (min-width: 768px) {
    .tb-search-expanded {
      inset-inline: 24px;
    }
  }
  @media (max-width: 767px) {
    .topbar-slot {
      height: 69px;
    }
    .topbar {
      position: fixed;
      top: 0;
      inset-inline: 0;
      z-index: 25;
      background: var(--color-bg-0);
      transition:
        transform 200ms ease,
        visibility 200ms;
    }
    .topbar.searching {
      top: var(--tb-visible-top, 0px);
    }
    .scroll-hidden .topbar {
      transform: translateY(-100%);
      visibility: hidden;
      pointer-events: none;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .topbar,
    .topbar .tb-normal > :not(.tb-actions),
    .topbar .tb-actions > :global(*),
    .topbar .search-open .tb-actions > .tb-search-toggle,
    .topbar .tb-search-expanded,
    .topbar .tb-search-expanded :global(.gs-input-shell),
    .topbar .tb-search-expanded :global(.gs-input-shell input),
    .topbar .tb-search-expanded :global(.gs-input-shell kbd),
    .topbar .tb-icbtn.tb-search-close {
      transition: none;
    }
  }
  /* Reserve one label column across routes; text length cannot move search. */
  .tb-breadcrumbs {
    flex: 0 0 clamp(180px, 22cqw, 280px);
    min-width: 0;
  }
  .crumb-trail {
    min-width: 0;
    overflow: hidden;
    white-space: nowrap;
  }
  .crumb-trail > span {
    flex-shrink: 0;
  }
  .crumb-trail > span:last-child {
    min-width: 0;
    flex-shrink: 1;
    overflow: hidden;
    text-overflow: ellipsis;
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
  .tb-icbtn:is(.tb-search-toggle, .tb-search-close) {
    border-radius: 50%;
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
