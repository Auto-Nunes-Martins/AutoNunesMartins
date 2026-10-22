<script lang="ts">
  import { crmPath } from '$lib/paths';
  import { vehiclePrincipalPath } from '$lib/vehiclePrincipal';
  import {
    ArrowRightLeft,
    Calendar,
    Car,
    Check,
    FileText,
    Fuel as FuelIcon,
    Gauge,
    Pencil,
    Star,
    Tag,
  } from 'lucide-svelte';
  import StatusBadge from '$lib/components/brand/StatusBadge.svelte';
  import SpecRow from '$lib/components/brand/SpecRow.svelte';
  import ItalicHero from '$lib/components/brand/ItalicHero.svelte';
  import Button from '$lib/components/common/Button.svelte';
  import Panel from '$lib/components/common/Panel.svelte';
  import PanelHeader from '$lib/components/brand/PanelHeader.svelte';
  import PhotoGallery from '$lib/components/vehicle/PhotoGallery.svelte';
  import ExpenseTable from '$lib/components/vehicle/ExpenseTable.svelte';
  import VehicleDeletePanel from '$lib/components/vehicle/VehicleDeletePanel.svelte';
  import ProfitCard from '$lib/components/vehicle/ProfitCard.svelte';
  import { formatDate, formatEUR, formatInt } from '$lib/utils/format';
  import type { PageData } from './$types';

  interface Props {
    data: PageData;
  }

  let { data }: Props = $props();
  // Reactive: when SvelteKit re-runs the load function after a form action,
  // `data` is reassigned and these derived values pick up the new vehicle.
  const v = $derived(data.vehicle);

  const FUEL_LABELS: Record<string, string> = {
    GASOLINE: 'Gasolina',
    DIESEL: 'Gasóleo',
    HYBRID: 'Híbrido',
    PLUGIN_HYBRID: 'Híbrido Plug-in',
    ELECTRIC: 'Elétrico',
    LPG: 'GPL',
  };

  const docFlags = [
    { key: 'financing', label: 'Financiamento' },
    { key: 'imt', label: 'IMT' },
    { key: 'registration', label: 'Registo' },
    { key: 'docs', label: 'Documentação' },
  ];
  const pendingCount = $derived(
    docFlags.filter((f) => v.pendingDocFlags?.[f.key as keyof typeof v.pendingDocFlags]).length,
  );
</script>

<svelte:head>
  <title>{v.brand} {v.model} · Auto Nunes Martins</title>
</svelte:head>

<section class="pt-8 pb-12 space-y-6">
  <!-- Header -->
  <div class="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4 lg:gap-6">
    <div class="min-w-0">
      <div class="mb-2 flex flex-wrap items-center gap-2">
        <StatusBadge status={v.status} />
        {#if v.licensePlate}
          <!-- Stylized PT-plate chip — blue prefix mirrors a real matrícula. -->
          <span
            class="inline-flex items-center font-mono text-[10px] uppercase tracking-[0.18em] border border-[var(--color-border-strong)] overflow-hidden"
            style="border-radius: 3px;"
            title="Matrícula portuguesa"
          >
            <span class="bg-[#154e91] text-white font-bold text-[9px] tracking-[0.12em] px-1.5 py-1"
              >PT</span
            >
            <span class="px-2 py-1 tracking-[0.18em] text-[var(--color-text)]">
              {v.licensePlate}
            </span>
          </span>
        {/if}
        <span
          class="font-mono text-[10px] uppercase tracking-[0.25em] text-[var(--color-text-faint)] truncate"
        >
          VIN {v.vin}
        </span>
        <span class="featured-slot">
        {#await data.isFeatured}
          <span class="invisible" aria-hidden="true">Em destaque</span>
        {:then isFeatured}
          {#if isFeatured}
            <span
              class="inline-flex items-center gap-1 px-2 py-0.5 bg-[color-mix(in_oklab,#e6b800_15%,transparent)] border border-[color-mix(in_oklab,#e6b800_45%,transparent)] text-[#e6b800] font-mono text-[9.5px] uppercase tracking-[0.22em]"
              style="border-radius: var(--radius-btn);"
              title="Esta viatura está nos destaques do site e da dashboard"
            >
              <Star class="h-2.5 w-2.5 fill-[#e6b800]" />
              Em destaque
            </span>
          {:else}<span class="invisible" aria-hidden="true">Em destaque</span>{/if}
        {:catch}
          <span role="status"
            >Não foi possível verificar os destaques. Verifique a sessão e atualize a página.</span
          >
        {/await}
        </span>
      </div>
      <ItalicHero text={`${v.brand} `} accent={v.model} size="lg" />
      <p
        class="mt-2 font-mono text-[11px] uppercase tracking-[0.25em] text-[var(--color-text-muted)]"
      >
        <span class="text-[var(--color-red)]">●</span>
        Adquirida em {formatDate(v.acquisitionDate)}
        {#if v.soldDate}
          <span class="text-[var(--color-text-faint)]">·</span>
          Vendida em {formatDate(v.soldDate)}
        {/if}
      </p>
    </div>
    <div class="flex flex-wrap items-center gap-2">
      {#if !v.sale && ['AVAILABLE', 'RESERVED', 'DOCS_PENDING'].includes(v.status)}
        <Button variant="primary" href={crmPath(`/viaturas/${v.id}/vender`)}>
          <Check class="h-4 w-4" />
          Marcar como Vendida
        </Button>
      {/if}
      <Button variant="outline" href={crmPath('/site/destaques')}
        ><Star class="h-4 w-4" />Gerir destaques</Button
      >
      <Button variant="outline" href={crmPath(`/viaturas/${v.id}/editar`)}>
        <Pencil class="h-4 w-4" />
        Editar
      </Button>
    </div>
  </div>

  <!--
    DRAFT banner — viatura existe no inventário mas ainda não está pronta
    para venda (preço por definir). Aparece SEMPRE em primeiro lugar para
    o vendedor não esquecer este passo. O CTA leva ao fluxo dedicado de
    publicação que pede preço + descrição.
  -->
  {#if v.status === 'DRAFT'}
    <a
      href={crmPath(`/viaturas/${v.id}/publicar`)}
      class="flex items-center gap-3 p-4 pl-5 border bg-[color-mix(in_oklab,var(--color-warning)_8%,transparent)] hover:bg-[color-mix(in_oklab,var(--color-warning)_14%,transparent)] transition-colors group"
      style="border-radius: var(--radius-btn); border-color: color-mix(in oklab, var(--color-warning) 45%, transparent);"
    >
      <span
        class="inline-flex items-center justify-center h-9 w-9 rounded-full flex-shrink-0"
        style="background: color-mix(in oklab, var(--color-warning) 25%, transparent);"
      >
        <Tag class="h-4 w-4" style="color: var(--color-warning);" />
      </span>
      <div class="flex-1 min-w-0">
        <div class="font-display font-semibold text-[14px]" style="color: var(--color-warning);">
          Esta viatura está em rascunho
        </div>
        <div
          class="font-mono text-[10.5px] uppercase tracking-[0.12em] text-[var(--color-text-muted)] mt-0.5 normal-case tracking-normal"
        >
          Define o preço de venda e a descrição para a publicar. Enquanto estiver em rascunho não
          pode ser vendida nem aparece como disponível.
        </div>
      </div>
      <span
        class="font-mono text-[10px] uppercase tracking-[0.18em] group-hover:translate-x-0.5 transition-transform flex-shrink-0"
        style="color: var(--color-warning);"
      >
        Publicar →
      </span>
    </a>
  {/if}

  <!--
    Provenance banner — only renders for vehicles that came into stock as a
    customer trade-in. Surfaces the link back to the originating sale so the
    dealer can follow consolidated profit across both deals (the future sale
    of this car + the sale that produced it).
  -->
  {#if v.sourceTradeIn}
    {@const origin = v.sourceTradeIn}
    <a
      href={crmPath(`/vendas/${origin.sale.id}`)}
      class="flex items-center gap-3 p-3 pl-4 border border-[color-mix(in_oklab,var(--color-warning)_30%,transparent)] bg-[color-mix(in_oklab,var(--color-warning)_6%,transparent)] hover:bg-[color-mix(in_oklab,var(--color-warning)_10%,transparent)] transition-colors group"
      style="border-radius: var(--radius-btn);"
    >
      <span
        class="inline-flex items-center justify-center h-8 w-8 rounded-full"
        style="background: color-mix(in oklab, var(--color-warning) 18%, transparent);"
      >
        <ArrowRightLeft class="h-4 w-4" style="color: var(--color-warning);" />
      </span>
      <div class="flex-1 min-w-0 text-[13px]">
        <span class="font-display font-semibold"
          >{origin.sale.cancelledAt
            ? origin.sale.cancellationDecision?.tradeInAction === 'KEEP'
              ? 'Retoma mantida · aquisição independente'
              : 'Retoma devolvida · histórico fora do stock'
            : 'Adquirido como retoma'}</span
        >
        <span class="text-[var(--color-text-muted)]">
          · na venda de {origin.sale.vehicle.brand}
          {origin.sale.vehicle.model}
          ({origin.sale.vehicle.year}) a {origin.sale.customer.name} em
          {formatDate(origin.sale.saleDate)}
          {#if origin.sale.cancelledAt}
            · venda anulada{/if}
        </span>
      </div>
      <span
        class="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--color-warning)] group-hover:translate-x-0.5 transition-transform"
      >
        Ver venda →
      </span>
    </a>
  {/if}

  <!-- Top grid: gallery + spec/profit -->
  <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
    <div class="lg:col-span-7 space-y-6">
      {#await data.signedPhotos}
        <PhotoGallery vehicleId={v.id} photos={[]} loading photoCount={v.photos.length}
          principalPath={vehiclePrincipalPath(v) ?? null} editable={false} publicPaths={v.publicPhotoPaths}
          published={v.webPublished && ['AVAILABLE', 'RESERVED'].includes(v.status) && !v.sale && !v.soldDate} />
      {:then signedPhotos}
        <PhotoGallery
          vehicleId={v.id}
          photos={signedPhotos}
          principalPath={vehiclePrincipalPath(v) ?? null}
          editable={false}
          publicPaths={v.publicPhotoPaths}
          published={v.webPublished &&
            ['AVAILABLE', 'RESERVED'].includes(v.status) &&
            !v.sale &&
            !v.soldDate}
        />
      {:catch}
        <PhotoGallery vehicleId={v.id} photos={[]} loadError photoCount={v.photos.length}
          principalPath={vehiclePrincipalPath(v) ?? null} editable={false} publicPaths={v.publicPhotoPaths}
          published={v.webPublished && ['AVAILABLE', 'RESERVED'].includes(v.status) && !v.sale && !v.soldDate} />
      {/await}

      <Panel>
        <PanelHeader icon={FileText} title="Notas" />
        <div class="p-5 text-[14px] leading-relaxed text-[var(--color-text-muted)]">
          {v.description ?? 'Sem notas registadas.'}
        </div>
      </Panel>
    </div>

    <div class="lg:col-span-5 space-y-6">
      <!-- Specs -->
      <Panel>
        <PanelHeader icon={Car} title="Especificações" />
        <div class="p-5 grid grid-cols-2 gap-5">
          <SpecRow icon={Calendar} label="Ano" value={String(v.year)} />
          <SpecRow icon={Gauge} label="Quilometragem" value={`${formatInt(v.mileage)} km`} />
          <SpecRow
            icon={Tag}
            label="PVP"
            value={v.salePrice ? formatEUR(v.salePrice) : '—'}
            valueClass="text-[var(--color-text)] font-bold"
          />
          <SpecRow icon={FuelIcon} label="Combustível" value={FUEL_LABELS[v.fuel] ?? v.fuel} />
        </div>
      </Panel>

      <!-- Pending docs -->
      <Panel>
        <PanelHeader
          icon={FileText}
          title="Documentos pendentes"
          meta={pendingCount === 0 ? 'OK' : `${pendingCount} POR TRATAR`}
        />
        <div class="p-5 grid grid-cols-2 gap-3">
          {#each docFlags as f (f.key)}
            {@const isPending = v.pendingDocFlags?.[f.key as keyof typeof v.pendingDocFlags]}
            <div
              class="flex items-center gap-2 px-3 py-2 border {isPending
                ? 'border-[color-mix(in_oklab,var(--color-red)_30%,transparent)] text-[var(--color-red)]'
                : 'border-[var(--color-border)] text-[var(--color-text-muted)]'}"
              style="border-radius: var(--radius-btn);"
            >
              <span
                class="h-1.5 w-1.5 rounded-full {isPending
                  ? 'bg-[var(--color-red)]'
                  : 'bg-[var(--color-success)]'}"
              ></span>
              <span class="font-mono text-[10px] uppercase tracking-[0.2em]">{f.label}</span>
            </div>
          {/each}
        </div>
      </Panel>
    </div>
  </div>

  <!-- Profit card -->
  <ProfitCard
    purchasePrice={v.purchasePrice}
    salePrice={v.salePrice}
    expensesTotal={v.expensesTotal}
    figures={v.figures}
    sale={v.sale
      ? {
          vatAmount: v.sale.vatAmount,
          commission: v.sale.commission,
          realProfit: v.sale.realProfit,
        }
      : null}
  />

  <!-- Expenses -->
  <ExpenseTable expenses={v.expenses} vehicleStatus={v.status} />

  {#if v.sale}
    {@const saleId = v.sale.id}
    <Panel>
      <PanelHeader icon={Tag} title="Venda registada" meta={v.sale.deliveryStatus.toUpperCase()}>
        {#snippet actions()}
          <Button variant="outline" size="sm" href={crmPath(`/vendas/${saleId}`)}>Ver venda</Button>
        {/snippet}
      </PanelHeader>
      <div class="p-5 grid grid-cols-1 md:grid-cols-3 gap-5 text-[14px]">
        <div>
          <div
            class="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-faint)] mb-1"
          >
            Cliente
          </div>
          <a
            href={crmPath(`/clientes/${v.sale.customer.id}`)}
            class="font-display font-semibold hover:text-[var(--color-red)] transition-colors"
          >
            {v.sale.customer.name}
          </a>
          <div class="font-mono text-[11px] text-[var(--color-text-muted)] mt-0.5">
            NIF {v.sale.customer.nif}
          </div>
        </div>
        <div>
          <div
            class="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-faint)] mb-1"
          >
            Data
          </div>
          <div class="font-mono">{formatDate(v.sale.saleDate)}</div>
        </div>
        <div>
          <div
            class="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-faint)] mb-1"
          >
            Valor
          </div>
          <div class="num-value text-[18px]">
            {formatEUR(v.sale.salePrice)}
          </div>
        </div>
      </div>
    </Panel>
  {/if}
  <VehicleDeletePanel id={v.id} brand={v.brand} model={v.model} blocked={!!v.sale} />
</section>

<style>
  .featured-slot { display: inline-flex; min-width: 130px; min-height: 22px; align-items: center; }
</style>
