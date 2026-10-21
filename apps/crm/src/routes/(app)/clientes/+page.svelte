<script lang="ts">
  import ErrorRecovery from '$lib/components/common/ErrorRecovery.svelte';
  import { crmPath } from '$lib/paths';
  import { Plus, Search, Users, X } from 'lucide-svelte';
  import { filterNavigation } from '$lib/filterNavigation';
  import { page } from '$app/stores';
  import ItalicHero from '$lib/components/brand/ItalicHero.svelte';
  import Panel from '$lib/components/common/Panel.svelte';
  import Pagination from '$lib/components/common/Pagination.svelte';
  import EmptyState from '$lib/components/common/EmptyState.svelte';
  import Button from '$lib/components/common/Button.svelte';
  import ExportMenu from '$lib/components/common/ExportMenu.svelte';
  import CustomerTable from '$lib/components/customer/CustomerTable.svelte';
  import CustomerTableSkeleton from '$lib/components/customer/CustomerTableSkeleton.svelte';
  import { formatDateLong } from '$lib/utils/format';
  import type { PageData } from './$types';

  interface Props {
    data: PageData;
  }

  let { data }: Props = $props();
  const navigation = filterNavigation(() => $page.url);
  const today = new Date();

  function setQ(value: string) {
    navigation.set('q', value, true);
  }

  const hasFilters = $derived(Boolean(data.filters.q));
</script>

<svelte:head>
  <title>Clientes · Auto Nunes Martins</title>
</svelte:head>

<section class="list-frame pt-8 pb-12 space-y-6">
  <!-- Page header -->
  <div class="flex flex-col md:flex-row md:items-end md:justify-between gap-4 md:gap-6">
    <div class="min-w-0">
      <ItalicHero text="Clientes" size="lg" />
      <div
        class="mt-2 flex flex-wrap items-center gap-2 font-mono text-[11px] uppercase tracking-[0.25em] text-[var(--color-text-muted)]"
      >
        <span class="h-1.5 w-1.5 rounded-full bg-[var(--color-red)]"></span>
        {formatDateLong(today)}
        {#await data.list then list}
          {#if !list._error}
          <span class="text-[var(--color-text-faint)]">·</span>
          <span class="tabular-nums">{list.total} no registo</span>
          {/if}
        {/await}
      </div>
    </div>
    <div class="flex items-center gap-2 md:flex-shrink-0">
      <!-- Export is desktop-only — rarely the primary action on a phone.
           Menu (sem default) — o utilizador escolhe CSV ou PDF. -->
      <div class="hidden md:inline-flex">
        <ExportMenu baseHref={crmPath('/clientes/export')} extraQuery={$page.url.search} />
      </div>
      <!-- Mobile: icon-only red square (no in-topbar equivalent for "novo
           cliente"). Desktop: full italic CTA. -->
      <a
        href={crmPath('/clientes/novo')}
        class="inline-flex md:hidden items-center justify-center h-11 w-11 text-white bg-[var(--color-red)] hover:bg-[var(--color-red-soft)] transition-colors"
        style="border-radius: var(--radius-btn);"
        aria-label="Novo cliente"
      >
        <Plus class="h-4 w-4" />
      </a>
      <div class="hidden md:inline-flex">
        <Button variant="primary" size="md" href={crmPath('/clientes/novo')}>
          <Plus class="h-4 w-4" />
          Novo Cliente
        </Button>
      </div>
    </div>
  </div>

  <!-- Search (renders immediately, independent of data) -->
  <Panel>
    <div class="p-4 flex flex-wrap items-center gap-3">
      <div
        class="flex-1 relative flex items-center h-11 px-3 border border-[var(--color-border)] bg-[var(--color-bg-1)] focus-within:border-[var(--color-red)] transition-colors"
        style="border-radius: var(--radius-btn);"
      >
        <Search class="h-4 w-4 text-[var(--color-text-faint)]" />
        <input
          type="search"
          aria-label="Pesquisar clientes por nome, NIF, telefone ou email"
          placeholder="Pesquisar por nome, NIF, telefone ou email…"
          value={data.filters.q ?? ''}
          oninput={(e) => setQ(e.currentTarget.value)}
          onkeydown={(e) => {
            if (e.key === 'Enter') navigation.flush();
          }}
          class="min-w-0 flex-1 bg-transparent px-3 text-[13px] outline-none placeholder:text-[var(--color-text-faint)]"
        />
      </div>
      {#if hasFilters}
        <button
          type="button"
          onclick={() => setQ('')}
          class="inline-flex items-center gap-1.5 px-3 h-11 font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--color-text-muted)] hover:text-[var(--color-red)] transition-colors"
        >
          <X class="h-3 w-3" />
          Limpar
        </button>
      {/if}
    </div>
  </Panel>

  <!-- Streamed table -->
  <Panel>
    {#await data.list}
      <CustomerTableSkeleton rows={6} />
    {:then list}
      {#if list._error}
        <div class="p-4 flex items-center gap-3 text-[var(--color-red)] text-[13px]">
          <strong class="font-mono uppercase tracking-[0.2em] text-[10px]">Erro</strong>
          <span>{list._error}</span>
          </div>
          <div class="px-4 pb-4"><ErrorRecovery status={list._status ?? 503} />
        </div>
      {:else if list.items.length === 0}
        <EmptyState
          icon={Users}
          title="Nenhum cliente encontrado"
          description={hasFilters
            ? 'Experimente outro nome, NIF, telefone ou email.'
            : 'Registe o primeiro cliente para começar.'}
        >
          {#snippet actions()}
            {#if hasFilters}<Button variant="outline" size="md" onclick={() => navigation.clear()}
                >Limpar pesquisa</Button
              >{:else}<Button variant="primary" size="md" href={crmPath('/clientes/novo')}>
                <Plus class="h-4 w-4" />
                Registar primeiro cliente
              </Button>{/if}
          {/snippet}
        </EmptyState>
      {:else}
        <CustomerTable items={list.items} />
        <Pagination
          currentPage={list.page}
          totalPages={list.totalPages}
          total={list.total}
          pageSize={list.pageSize}
        />
      {/if}
    {/await}
  </Panel>
</section>
