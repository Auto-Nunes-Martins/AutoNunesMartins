<script lang="ts">
  import { crmPath } from '$lib/paths';
  import { linkedRow } from '$lib/linkedRow';
  import { ArrowRight, Car, Plus, Tag } from 'lucide-svelte';
  import { page } from '$app/stores';
  import ItalicHero from '$lib/components/brand/ItalicHero.svelte';
  import Panel from '$lib/components/common/Panel.svelte';
  import PanelHeader from '$lib/components/brand/PanelHeader.svelte';
  import Pagination from '$lib/components/common/Pagination.svelte';
  import EmptyState from '$lib/components/common/EmptyState.svelte';
  import Button from '$lib/components/common/Button.svelte';
  import ExportMenu from '$lib/components/common/ExportMenu.svelte';
  import VehicleFilters from '$lib/components/vehicle/VehicleFilters.svelte';
  import VehicleTable from '$lib/components/vehicle/VehicleTable.svelte';
  import VehicleTableSkeleton from '$lib/components/vehicle/VehicleTableSkeleton.svelte';
  import { formatDate, formatDateLong, formatInt } from '$lib/utils/format';
  import type { PageData } from './$types';

  interface Props {
    data: PageData;
  }

  let { data }: Props = $props();
  const filtered = $derived(
    Boolean(
      data.filters.q ||
      data.filters.status ||
      data.filters.fuel ||
      data.filters.brand ||
      data.filters.model ||
      data.filters.agedStock ||
      data.filters.yearMin ||
      data.filters.yearMax ||
      data.filters.mileageMin ||
      data.filters.mileageMax,
    ),
  );
  const today = new Date();

  // Conta dias desde a aquisição (para o utilizador ver há quanto tempo
  // o carro está em rascunho — quanto mais tempo, mais urgente publicar).
  function daysSince(iso: string): number {
    const ms = Date.now() - new Date(iso).getTime();
    return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)));
  }
</script>

<svelte:head>
  <title>Viaturas · Auto Nunes Martins</title>
</svelte:head>

<section class="list-frame pt-8 pb-12 space-y-6">
  <!-- Page header -->
  <div class="flex flex-col md:flex-row md:items-end md:justify-between gap-4 md:gap-6">
    <div class="min-w-0">
      <ItalicHero text="Viaturas" size="lg" />
      <div
        class="mt-2 flex flex-wrap items-center gap-2 font-mono text-[11px] uppercase tracking-[0.25em] text-[var(--color-text-muted)]"
      >
        <span class="h-1.5 w-1.5 rounded-full bg-[var(--color-red)]"></span>
        {formatDateLong(today)}
        {#await data.list then list}
          <span class="text-[var(--color-text-faint)]">·</span>
          <span class="tabular-nums">{list.total} no inventário</span>
        {/await}
      </div>
    </div>
    <!-- Desktop-only action buttons — mobile has the icon CTA in the topbar. -->
    <div class="hidden md:flex items-center gap-2">
      <ExportMenu baseHref={crmPath('/viaturas/export')} extraQuery={$page.url.search} />
      <Button variant="primary" size="md" href={crmPath('/viaturas/nova')}>
        <Plus class="h-4 w-4" />
        Adicionar Viatura
      </Button>
    </div>
  </div>

  <!-- Filters render immediately (independent of data) -->
  <Panel>
    <div class="p-4">
      <VehicleFilters filters={data.filters} />
    </div>
  </Panel>

  <!--
    Rascunhos. Usa o `Panel` standard (fundo neutro consistente com o
    resto da app); o laranja é só ACENTO: stripe vertical à esquerda
    (4px), ícone do header e botão CTA. Idade > 5 dias fica laranja
    como sinal de urgência subtil. Só renderiza quando há rascunhos —
    sem rascunhos, página fica limpa.
  -->
  {#await data.drafts then drafts}
    {#if !drafts._error && drafts.items.length > 0}
      <Panel class="border-l-4 !border-l-[var(--color-warning)]">
        <PanelHeader
          icon={Tag}
          iconClass="text-[var(--color-warning)]"
          title="Rascunhos"
          meta={`${drafts.items.length} POR COMPLETAR`}
        />
        <div
          class="px-5 py-2.5 text-[12px] text-[var(--color-text-muted)] border-b border-[var(--color-border)] bg-[var(--color-bg-2)]"
        >
          Complete a ficha para disponibilizar a viatura em stock. A publicação no site é uma ação
          separada.
        </div>
        <ul class="divide-y divide-[var(--color-border)]">
          {#each drafts.items as v (v.id)}
            {@const age = daysSince(v.acquisitionDate)}
            {@const isUrgent = age > 5}
            <li
              use:linkedRow
              class="linked-row flex items-center gap-4 px-5 py-3 hover:bg-[color-mix(in_oklab,var(--color-red)_5%,transparent)] transition-colors"
            >
              <a
                href={crmPath(`/viaturas/${v.id}`)}
                class="row-link flex-1 min-w-0 flex items-center gap-3 group/link"
              >
                <div
                  class="h-10 w-10 flex items-center justify-center bg-[var(--color-bg-2)] border border-[var(--color-border)] flex-shrink-0"
                  style="border-radius: 3px;"
                >
                  <Car class="h-4 w-4 text-[var(--color-text-muted)]" />
                </div>
                <div class="min-w-0">
                  <div
                    class="font-display font-semibold text-[14px] truncate group-hover/link:text-[var(--color-red)] transition-colors"
                  >
                    {v.brand}
                    {v.model}
                    <span
                      class="font-mono font-normal text-[11px] text-[var(--color-text-muted)] ml-1"
                    >
                      · {v.year}
                    </span>
                  </div>
                  <div
                    class="font-mono text-[10.5px] tracking-[0.04em] text-[var(--color-text-faint)] mt-0.5 flex items-center gap-2 flex-wrap"
                  >
                    {#if v.licensePlate}
                      <span class="tracking-[0.18em] text-[var(--color-text-muted)]">
                        {v.licensePlate}
                      </span>
                      <span>·</span>
                    {/if}
                    <span>{formatInt(v.mileage)} km</span>
                    <span>·</span>
                    <!-- Idade ganha cor laranja a partir de 5 dias como
                         sinal subtil de urgência: "isto está parado há
                         tempo". Caso contrário fica neutro como o resto. -->
                    <span
                      title={`Adicionada em ${formatDate(v.acquisitionDate)}`}
                      class={isUrgent ? 'text-[var(--color-warning)] font-semibold' : ''}
                    >
                      {#if age === 0}
                        hoje
                      {:else if age === 1}
                        há 1 dia
                      {:else}
                        há {age} dias
                      {/if}
                    </span>
                  </div>
                </div>
              </a>
              <a
                href={crmPath(`/viaturas/${v.id}/publicar`)}
                class="crm-action inline-flex items-center gap-1.5 px-3 h-9 border font-mono uppercase tracking-[0.12em] text-[11px] text-[var(--color-warning)] transition-colors flex-shrink-0"
                style="background: color-mix(in srgb, var(--color-warning) 10%, transparent); border-color: color-mix(in srgb, var(--color-warning) 40%, transparent); border-radius: var(--radius-btn);"
              >
                Completar ficha
                <ArrowRight class="h-3.5 w-3.5" />
              </a>
            </li>
          {/each}
        </ul>
      </Panel>
    {/if}
  {/await}

  <!-- Streamed table: skeleton first, then data flows in -->
  <Panel>
    {#await data.list}
      <VehicleTableSkeleton rows={6} />
    {:then list}
      {#if list._error}
        <div class="p-4 flex items-center gap-3 text-[var(--color-red)] text-[13px]">
          <strong class="font-mono uppercase tracking-[0.2em] text-[10px]">Erro</strong>
          <span>{list._error}</span>
        </div>
      {:else if list.items.length === 0}
        <EmptyState
          icon={Car}
          title="Nenhuma viatura encontrada"
          description={filtered
            ? 'Ajuste os filtros para encontrar a viatura.'
            : 'Adicione uma viatura para começar a organizar o stock.'}
        >
          {#snippet actions()}
            {#if filtered}<Button variant="outline" size="md" href={crmPath('/viaturas')}
                >Limpar filtros</Button
              >{:else}<Button variant="primary" size="md" href={crmPath('/viaturas/nova')}>
                <Plus class="h-4 w-4" />
                Adicionar primeira viatura
              </Button>{/if}
          {/snippet}
        </EmptyState>
      {:else}
        <VehicleTable items={list.items} />
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
