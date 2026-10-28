<script lang="ts">
  /*
    Export button with a CSV/PDF dropdown, replacing the previous Button links
    that pointed directly to ?format=csv. Users now choose a format
    explicitly, with no default export. A small chevron indicates that
    the button opens a menu.

    Each menu item opens {baseHref}?format={csv|pdf}&{extraQuery},
    preserving current page filters supplied through extraQuery
    (typically $page.url.search).
  */
  import { onMount, onDestroy, tick } from 'svelte';
  import { ChevronDown, Download, FileSpreadsheet, FileText } from 'lucide-svelte';

  interface Props {
    /** Export endpoint base URL without a query string. */
    baseHref: string;
    /**
     * Additional query string retaining the current page filters. It may
     * start with ? or &; the prefix is normalized internally.
     */
    extraQuery?: string;
    /**
     * Button height: md matches the previous Button size="md", while
     * sm is intended for denser layouts.
     */
    size?: 'sm' | 'md';
    /** Additional classes applied to the button. */
    class?: string;
  }

  let { baseHref, extraQuery = '', size = 'md', class: className = '' }: Props = $props();

  let isOpen = $state(false);
  let menuEl = $state<HTMLDivElement | null>(null);
  let buttonEl = $state<HTMLButtonElement | null>(null);
  const menuId = $props.id();

  async function toggle() {
    isOpen = !isOpen;
    if (isOpen) {
      await tick();
      menuEl?.querySelector('a')?.focus();
    }
  }
  function close() {
    isOpen = false;
  }

  // Build the final href by adding ?format=... to baseHref and appending
  // caller-provided filters as additional &k=v pairs.
  function buildHref(format: 'csv' | 'pdf'): string {
    const tail = extraQuery.replace(/^[?&]+/, '');
    return tail ? `${baseHref}?format=${format}&${tail}` : `${baseHref}?format=${format}`;
  }

  function onDocClick(e: MouseEvent) {
    if (!isOpen) return;
    const target = e.target as Node;
    if (menuEl?.contains(target) || buttonEl?.contains(target)) return;
    close();
  }

  function onKey(e: KeyboardEvent) {
    if (e.key === 'Escape' && isOpen) {
      e.preventDefault();
      close();
      buttonEl?.focus();
    }
  }
  function onMenuKey(e: KeyboardEvent) {
    if (e.key === 'Tab') {
      close();
      return;
    }
    const links = [...(menuEl?.querySelectorAll('a') ?? [])];
    const index = links.indexOf(document.activeElement as HTMLAnchorElement);
    let next: number;
    if (e.key === 'ArrowDown') next = (index + 1) % links.length;
    else if (e.key === 'ArrowUp') next = (index - 1 + links.length) % links.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = links.length - 1;
    else return;
    e.preventDefault();
    links[next]?.focus();
  }

  onMount(() => {
    document.addEventListener('click', onDocClick);
    document.addEventListener('keydown', onKey);
  });

  onDestroy(() => {
    if (typeof document !== 'undefined') {
      document.removeEventListener('click', onDocClick);
      document.removeEventListener('keydown', onKey);
    }
  });

  // Match the visual styling of Button variant="outline" so the menu
  // fits wherever the previous button appeared.
  const sizeClass = $derived(
    size === 'sm' ? 'h-9 px-3 text-[12px]' : 'h-[38px] px-[18px] text-[13px]',
  );
</script>

<div class="relative inline-block">
  <button
    bind:this={buttonEl}
    type="button"
    onclick={toggle}
    aria-haspopup="menu"
    aria-expanded={isOpen}
    aria-controls={menuId}
    aria-label="Exportar"
    class="inline-flex items-center justify-center gap-2 border border-[var(--color-border)] hover:border-[var(--color-border-strong)] text-[var(--color-text)] font-mono uppercase tracking-[0.12em] text-[11px] transition-colors {sizeClass} {className}"
    style="border-radius: var(--radius-btn);"
  >
    <Download class="h-4 w-4" />
    Exportar
    <ChevronDown
      class="h-3.5 w-3.5 transition-transform"
      style={isOpen ? 'transform: rotate(180deg);' : ''}
    />
  </button>

  {#if isOpen}
    <!-- Anchor the menu to the button. min-w-full prevents it from becoming narrower than the button; right-0 aligns it with the export controls in the page header. -->
    <div
      bind:this={menuEl}
      role="menu"
      id={menuId}
      aria-label="Formato de exportação"
      onkeydown={onMenuKey}
      tabindex="-1"
      class="absolute right-0 top-[calc(100%+6px)] min-w-[180px] border border-[var(--color-border)] shadow-xl z-50 panel-surface overflow-hidden"
      style="border-radius: var(--radius-card);"
    >
      <a
        href={buildHref('csv')}
        role="menuitem"
        onclick={close}
        class="flex items-center gap-2.5 px-4 py-2.5 text-[13px] text-[var(--color-text)] hover:bg-[color-mix(in_oklab,var(--color-red)_6%,transparent)] transition-colors"
      >
        <FileSpreadsheet class="h-4 w-4 text-[var(--color-text-muted)]" />
        <div class="flex flex-col leading-tight">
          <span class="font-display font-semibold text-[13px]">CSV</span>
          <span
            class="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-faint)]"
          >
            Folha de cálculo
          </span>
        </div>
      </a>
      <a
        href={buildHref('pdf')}
        role="menuitem"
        onclick={close}
        class="flex items-center gap-2.5 px-4 py-2.5 text-[13px] text-[var(--color-text)] hover:bg-[color-mix(in_oklab,var(--color-red)_6%,transparent)] transition-colors border-t border-[var(--color-border)]"
      >
        <FileText class="h-4 w-4 text-[var(--color-text-muted)]" />
        <div class="flex flex-col leading-tight">
          <span class="font-display font-semibold text-[13px]">PDF</span>
          <span
            class="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-faint)]"
          >
            Documento imprimível
          </span>
        </div>
      </a>
    </div>
  {/if}
</div>

<style>
  /* Igual ao NotificationBell / Panel — gradient subtil em dark, flat em light. */
  :global([data-theme='dark']) .panel-surface,
  :global(html:not([data-theme='light'])) .panel-surface {
    background: linear-gradient(180deg, #131316 0%, #101012 100%);
  }
  :global([data-theme='light']) .panel-surface {
    background: var(--color-bg-elevated);
    box-shadow: var(--shadow-floating);
  }
</style>
