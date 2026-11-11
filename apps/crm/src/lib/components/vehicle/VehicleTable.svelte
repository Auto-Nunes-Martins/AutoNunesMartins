<script lang="ts">
  import { photoFallback } from '$lib/vehicleImage';
  import { crmPath } from '$lib/paths';
  import { linkedRow } from '$lib/linkedRow';
  import { Car, FileText, Check, Tag, Trash2 } from 'lucide-svelte';
  import type { ComponentProps } from 'svelte';
  import BrandLogo from './BrandLogo.svelte';
  import VehicleDeleteDialog from './VehicleDeleteDialog.svelte';
  import RowActions from '$lib/components/common/RowActions.svelte';
  import WebsiteStatus from './WebsiteStatus.svelte';
  import StatusBadge from '$lib/components/brand/StatusBadge.svelte';
  import { formatDate, formatEUR, formatInt } from '$lib/utils/format';
  import type { VehicleListItem } from '$lib/server/vehicles';

  interface Props {
    items: VehicleListItem[];
  }

  let { items }: Props = $props();
  let deleteTarget = $state<VehicleListItem | null>(null);
  let deleteOpen = $state(false);
  let deleteOpener: HTMLButtonElement | null = null;

  function destination(vehicle: VehicleListItem) {
    return crmPath(
      vehicle.status === 'DRAFT'
        ? `/viaturas/nova?viatura=${vehicle.id}`
        : `/viaturas/${vehicle.id}`,
    );
  }

  function actionsFor(vehicle: VehicleListItem) {
    const actions: ComponentProps<typeof RowActions>['actions'] =
      vehicle.status === 'DRAFT'
        ? [{ label: 'Completar ficha', href: destination(vehicle), icon: Tag }]
        : [
            { label: 'Ver ficha', href: destination(vehicle), icon: FileText },
            ...(['AVAILABLE', 'RESERVED', 'DOCS_PENDING'].includes(vehicle.status)
              ? [
                  {
                    label: 'Registar venda',
                    href: crmPath(`/viaturas/${vehicle.id}/vender`),
                    icon: Check,
                  },
                ]
              : []),
          ];
    actions.push({
      label: vehicle.status === 'DRAFT' ? 'Eliminar rascunho' : 'Eliminar viatura',
      icon: Trash2,
      danger: true,
      disabled: !!vehicle.sale,
      title: vehicle.sale ? 'Esta viatura tem uma venda associada.' : undefined,
      onselect: (trigger) => {
        deleteOpener = trigger;
        deleteTarget = vehicle;
        deleteOpen = true;
      },
    });
    return actions;
  }
</script>

{#snippet rowActions(v: VehicleListItem, compact = false)}
  <RowActions
    label={`${v.brand} ${v.model}${v.licensePlate ? ` · ${v.licensePlate}` : ''}`}
    editHref={v.status === 'DRAFT' ? destination(v) : crmPath(`/viaturas/${v.id}/editar`)}
    actions={actionsFor(v)}
    {compact}
  />
{/snippet}

<div class="md:hidden divide-y divide-[var(--color-border)]">
  {#each items as v (v.id)}
    <article use:linkedRow class="linked-row flex items-center gap-2 px-3">
      <a
        href={destination(v)}
        class="row-link mobile-vehicle-link grid min-w-0 flex-1 items-center gap-x-3 gap-y-2 py-3 group"
      >
        <div
          class="mobile-vehicle-photo shrink-0 flex items-center justify-center overflow-hidden rounded-xs bg-[var(--color-bg-2)]"
        >
          {#if v.thumbnailUrl}
            <img
              src={v.thumbnailUrl}
              use:photoFallback={v.thumbnailOriginalUrl ?? v.thumbnailUrl}
              alt=""
              class="h-full w-full object-cover"
              loading="lazy"
            />
          {:else}
            <Car class="h-6 w-6 text-[var(--color-red)]" />
          {/if}
        </div>
        <div class="min-w-0 flex-1 space-y-1">
          <span
            class="line-clamp-2 wrap-break-word text-[14px] leading-snug font-semibold group-hover:text-[var(--color-red)]"
            title={v.brand + ' ' + v.model}
          >
            {v.brand}
            {v.model}
          </span>
          <span
            class="block wrap-break-word text-[11px] leading-snug text-[var(--color-text-muted)]"
            title={v.licensePlate ?? v.vin ?? undefined}
          >
            {#if v.licensePlate || v.vin}{v.licensePlate ?? v.vin} ·
            {/if}{v.year}{#if v.mileage != null}
              · {formatInt(v.mileage)} km{/if}
          </span>
        </div>
        <div class="col-span-2 flex flex-wrap items-center gap-x-2 gap-y-1">
          <div class="mobile-vehicle-tags flex items-center gap-1.5">
            <StatusBadge status={v.status} /><WebsiteStatus vehicle={v} compact liveOnly />
          </div>
          {#if v.salePrice}
            <span class="num-value ml-auto whitespace-nowrap text-[12px]" title="PVP">
              {formatEUR(v.salePrice)}
            </span>
          {/if}
        </div>
      </a>
      {@render rowActions(v, true)}
    </article>
  {/each}
</div>

<!--
  Desktop (md+): the original wide table. Wrapped so it never renders on
  mobile (saves the layout from horizontal-scrolling its way off-screen).
-->
<!-- Native horizontal scrolling by keyboard. -->
<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<div
  class="hidden md:block overflow-x-auto"
  tabindex="0"
  role="region"
  aria-label="Viaturas — tabela com deslocamento horizontal"
>
  <table class="crm-table w-full text-[13px]">
    <thead>
      <tr class="border-b border-[var(--color-border)]">
        <th
          class="text-left px-4 py-3 font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--color-text-faint)]"
        >
          Viatura
        </th>
        <th
          class="text-left px-4 py-3 font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--color-text-faint)]"
        >
          Ano
        </th>
        <th
          class="text-right px-4 py-3 font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--color-text-faint)]"
        >
          Km
        </th>
        <th
          class="text-right px-4 py-3 font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--color-text-faint)]"
        >
          Aquisição
        </th>
        <th
          class="text-right px-4 py-3 font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--color-text-faint)]"
        >
          PVP
        </th>
        <th
          class="text-left px-4 py-3 font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--color-text-faint)]"
        >
          Estado
        </th>
        <th
          class="w-36 px-4 py-3 text-right font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--color-text-faint)]"
          >Ações</th
        >
      </tr>
    </thead>
    <tbody>
      {#each items as v (v.id)}
        <tr
          use:linkedRow
          class="linked-row border-b border-[var(--color-border)] hover:bg-[color-mix(in_oklab,var(--color-red)_5%,transparent)] transition-colors group"
        >
          <td class="px-4 py-3">
            <a href={destination(v)} class="row-link flex items-center gap-3">
              <div
                class="h-[72px] w-24 flex items-center justify-center bg-[var(--color-bg-2)] border border-[var(--color-border)] flex-shrink-0 overflow-hidden"
                style="border-radius: 3px;"
              >
                {#if v.thumbnailUrl}
                  <img
                    src={v.thumbnailUrl}
                    use:photoFallback={v.thumbnailOriginalUrl ?? v.thumbnailUrl}
                    alt={`${v.brand} ${v.model}`}
                    class="h-full w-full object-cover"
                    loading="lazy"
                  />
                {:else}
                  <Car class="h-5 w-5 text-[var(--color-red)]" />
                {/if}
              </div>
              <div class="min-w-0">
                <div
                  class="vehicle-name font-display font-semibold text-[14px] group-hover:text-[var(--color-red)] transition-colors"
                >
                  <BrandLogo name={v.brand} size={16} /><span class="min-w-0 truncate"
                    >{v.brand} {v.model}</span
                  >
                </div>
                <div
                  class="font-mono text-[10.5px] tracking-[0.04em] text-[var(--color-text-faint)] truncate"
                >
                  {#if v.licensePlate}
                    <span class="tracking-[0.18em] text-[var(--color-text-muted)]"
                      >{v.licensePlate}</span
                    >
                    <span class="mx-1">·</span>{v.vin}
                  {:else}
                    {v.vin}
                  {/if}
                </div>
              </div>
            </a>
          </td>
          <td class="px-4 py-3 num-value text-[13px]">{v.year}</td>
          <td class="px-4 py-3 num-value text-[13px] text-right">
            {v.mileage == null ? '' : formatInt(v.mileage)}
          </td>
          <td class="px-4 py-3 num-value text-[12px] text-right text-[var(--color-text-muted)]">
            {formatDate(v.acquisitionDate)}
          </td>
          <td class="px-4 py-3 num-value text-[13px] text-right text-[var(--color-text)]">
            {v.salePrice ? formatEUR(v.salePrice) : '—'}
          </td>
          <td class="px-4 py-3">
            <div class="flex flex-wrap items-center gap-2">
              <StatusBadge status={v.status} /><WebsiteStatus vehicle={v} compact liveOnly />
            </div>
          </td>
          <td class="px-4 py-3 text-right">
            {@render rowActions(v)}
          </td>
        </tr>
      {/each}
    </tbody>
  </table>
</div>

{#if deleteTarget}<VehicleDeleteDialog
    id={deleteTarget.id}
    brand={deleteTarget.brand}
    model={deleteTarget.model}
    blocked={!!deleteTarget.sale}
    draftOnly={deleteTarget.status === 'DRAFT'}
    bind:open={deleteOpen}
    oncancel={() => {
      if (deleteOpener?.isConnected) deleteOpener.focus();
    }}
  />{/if}

<style>
  .mobile-vehicle-link {
    grid-template-columns: auto minmax(0, 1fr);
  }
  .mobile-vehicle-photo {
    width: clamp(68px, 20vw, 84px);
    aspect-ratio: 4 / 3;
  }
  .mobile-vehicle-tags :global(.vehicle-state-chip) {
    --state-tag-height: 22px;
    --state-tag-padding: 2px 5px;
    --state-tag-size: 10px;
    white-space: nowrap;
  }
  .vehicle-name {
    display: flex;
    align-items: center;
    gap: 9px;
    min-width: 0;
  }
</style>
