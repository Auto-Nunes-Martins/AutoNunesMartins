<script lang="ts">
 import BrandLogo from '$lib/components/vehicle/BrandLogo.svelte';
  import { crmPath } from '$lib/paths';
  import { vehiclePrincipalPath } from '$lib/vehiclePrincipal';
  import { PUBLIC_WEBSITE_URL } from '$env/static/public';
  import { publicVehicleUrl } from '$lib/utils/publicVehicleUrl';
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
  import WebsiteStatus from '$lib/components/vehicle/WebsiteStatus.svelte';
  import {websiteVisibility} from '$lib/websiteVisibility';
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
  import type { HighlightStatus } from '$lib/highlightStatus';

  interface Props {
    data: PageData;
  }

  let { data }: Props = $props();
  // Reactive: when SvelteKit re-runs the load function after a form action,
  // `data` is reassigned and these derived values pick up the new vehicle.
  const v = $derived(data.vehicle);
  const highlightStatus = $derived(data.homepageHighlight ?? Promise.resolve(data.isFeatured).then<HighlightStatus>(featured => featured ? 'live' : 'none'));

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
  const pendingDocs = $derived(docFlags.filter(f => v.pendingDocFlags?.[f.key as keyof typeof v.pendingDocFlags] === true));
  const pendingCount = $derived(pendingDocs.length);
  const docsKnown = $derived(v.pendingDocFlags != null);
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
        <WebsiteStatus vehicle={v} compact />
        {#if websiteVisibility(v).state === 'blocked'}<span class="text-[13px] text-[var(--color-text-muted)]">{websiteVisibility(v).detail}</span>{/if}
        {#if v.licensePlate}
          <!-- Stylized Portuguese license plate with the authentic blue prefix. -->
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
          {#await highlightStatus}
            <span class="highlight-loading">A verificar destaque…</span>
          {:then status}
            {#if status === 'live' || status === 'hidden'}
              <span class="highlight-status vehicle-state-chip" class:highlight-hidden={status === 'hidden'} title={status === 'live' ? 'Esta viatura aparece no carrossel publicado da homepage e nos destaques do painel.' : 'Está na seleção guardada, mas não aparece no carrossel público. Reveja a publicação e a fotografia escolhida.'}>
                <Star size={14} aria-hidden="true" fill={status === 'live' ? 'currentColor' : 'none'} />{status === 'live' ? 'Em destaque' : 'Destaque oculto'}
              </span>
            {:else if status === 'unknown'}<span class="highlight-loading">Destaque por confirmar</span>{/if}
          {:catch}<span class="highlight-loading">Destaque por confirmar</span>
          {/await}
        </span>
      </div>
      <div class="flex items-center gap-3"><BrandLogo name={v.brand} size={40} /><ItalicHero text={`${v.brand} `} accent={v.model} size="lg" /></div>
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
    <div class="vehicle-actions flex flex-wrap items-center gap-2">
      {#if websiteVisibility(v).visible && v.publicSlug}
        <a
          class="public-view-link"
          href={publicVehicleUrl(PUBLIC_WEBSITE_URL, v.publicSlug)}
          target="_blank"
          rel="noreferrer"
        >
          Ver ficha pública <span aria-hidden="true">↗</span>
        </a>
      {/if}
      {#await highlightStatus}
        <Button variant="outline" href={crmPath(`/site/destaques?viatura=${encodeURIComponent(v.id)}`)}><Star class="h-4 w-4" />Ver destaques</Button>
      {:then status}
        <Button variant="outline" class={status === 'live' ? 'featured-vehicle-action' : ''} href={crmPath(`/site/destaques?viatura=${encodeURIComponent(v.id)}`)}><Star class="h-4 w-4" fill={status === 'live' ? 'currentColor' : 'none'} />{status === 'live' ? 'Ver destaque' : status === 'hidden' ? 'Rever destaque' : status === 'unknown' ? 'Ver destaques' : 'Destacar viatura'}</Button>
      {:catch}<Button variant="outline" href={crmPath(`/site/destaques?viatura=${encodeURIComponent(v.id)}`)}><Star class="h-4 w-4" />Ver destaques</Button>{/await}
      <Button variant="outline" class="edit-vehicle-action" href={crmPath(`/viaturas/${v.id}/editar`)}>
        <Pencil class="h-4 w-4" />
        Editar
      </Button>

      {#if !v.sale && ['AVAILABLE', 'RESERVED', 'DOCS_PENDING'].includes(v.status)}
        <Button variant="primary" class="sell-vehicle-action" href={crmPath(`/viaturas/${v.id}/vender`)}>
          <Check class="h-4 w-4" />
          Vender viatura
        </Button>
      {/if}

    </div>
  </div>

  <!-- The DRAFT banner always appears first for an inventory vehicle that is not ready for sale because its price is missing. The CTA opens the publication flow, which requires a price and description. -->
  {#if v.status === 'DRAFT'}
    <a
      href={crmPath(`/viaturas/nova?viatura=${v.id}`)}
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
          Complete os dados e escolha se conclui apenas no CRM ou também publica no site. Enquanto
          estiver em rascunho não pode ser vendida nem aparece como disponível.
        </div>
      </div>
      <span
        class="font-mono text-[10px] uppercase tracking-[0.18em] group-hover:translate-x-0.5 transition-transform flex-shrink-0"
        style="color: var(--color-warning);"
      >
        Completar ficha →
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
    <div class="lg:col-span-7 min-w-0 space-y-6">
      {#await data.signedPhotos}
        <PhotoGallery
          vehicleId={v.id}
          photos={[]}
          loading
          photoCount={v.photos.length}
          principalPath={vehiclePrincipalPath(v) ?? null}
          editable={false}
        />
      {:then signedPhotos}
        <PhotoGallery
          vehicleId={v.id}
          photos={signedPhotos}
          principalPath={vehiclePrincipalPath(v) ?? null}
          editable={false}
        />
      {:catch}
        <PhotoGallery
          vehicleId={v.id}
          photos={[]}
          loadError
          photoCount={v.photos.length}
          principalPath={vehiclePrincipalPath(v) ?? null}
          editable={false}
        />
      {/await}

      {#if v.description?.trim()}<Panel>
        <PanelHeader icon={FileText} title="Notas" />
        <div class="p-5 text-[14px] leading-relaxed text-[var(--color-text-muted)]">
          {v.description}
        </div>
      </Panel>{/if}
    </div>

    <div class="vehicle-sidebar lg:col-span-5 min-w-0 space-y-6">
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

      <section class="vehicle-document-status" aria-label="Documentação da viatura">
        {#if !docsKnown}
          <div class="document-summary"><p>Não foi possível confirmar as pendências documentais.</p><a href={crmPath(`/viaturas/${v.id}/editar#documentos`)}>Atualizar</a></div>
        {:else if pendingCount === 0}
          <div class="document-summary"><p>Sem pendências documentais</p><a href={crmPath(`/viaturas/${v.id}/editar#documentos`)}>Atualizar</a></div>
        {:else}
          <Panel>
            <PanelHeader icon={FileText} title="Documentos pendentes" meta={`${pendingCount} ${pendingCount === 1 ? 'PENDENTE' : 'PENDENTES'}`} />
            <div class="pending-doc-body"><ul class="pending-document-list">{#each pendingDocs as document (document.key)}<li><FileText size={14} aria-hidden="true" />{document.label}</li>{/each}</ul><Button variant="outline" size="sm" href={crmPath(`/viaturas/${v.id}/editar#documentos`)}>Atualizar</Button></div>
          </Panel>
        {/if}
      </section>
      <ExpenseTable expenses={v.expenses} vehicleStatus={v.status} />
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
  .public-view-link { display:inline-flex; align-items:center; gap:4px; min-height:44px; white-space:nowrap; font-size:13px; text-decoration:underline; color:var(--color-text); }
  .public-view-link:focus-visible { outline:2px solid var(--color-red); outline-offset:3px; border-radius:var(--radius-btn); }
  .vehicle-actions :global(.edit-vehicle-action) {border-color:var(--color-text-muted);background:var(--color-bg-2);font-weight:600;color:var(--color-text);}
  .vehicle-actions :global(.edit-vehicle-action:hover) {border-color:var(--color-text);}
  .vehicle-actions :global(.sell-vehicle-action) {margin-left:auto;}
  .document-summary {display:flex;align-items:center;justify-content:space-between;gap:12px;padding:6px 0;font-size:12px;color:var(--color-text-muted);}
  .document-summary p {min-width:0;}
  .document-summary a {display:inline-flex;align-items:center;min-height:44px;flex-shrink:0;text-decoration:underline;text-underline-offset:3px;color:var(--color-text-muted);}
  .document-summary a:focus-visible {outline:2px solid var(--color-red);outline-offset:3px;}
  .pending-doc-body {display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;padding:16px;}
  .pending-document-list {display:flex;flex-wrap:wrap;gap:8px;flex:1;min-width:150px;}
  .vehicle-document-status :global(h3) {white-space:normal;overflow:visible;text-overflow:clip;line-height:1.15;}
  .pending-document-list li {display:inline-flex;align-items:center;gap:7px;padding:8px 10px;border:1px solid color-mix(in srgb,var(--color-warning) 35%,var(--color-border));border-radius:var(--radius-btn);font-size:12px;color:var(--color-warning);background:color-mix(in srgb,var(--color-warning) 7%,transparent);}
  .highlight-status {color:var(--color-warning);background:color-mix(in srgb,var(--color-warning) 10%,var(--color-bg-1));border:1px solid color-mix(in srgb,var(--color-warning) 45%,transparent);}
  .highlight-hidden {color:var(--color-text-muted);background:var(--color-bg-2);border-color:var(--color-border-strong);}
  .highlight-loading {font:11px var(--font-mono);color:var(--color-text-muted);}
  .vehicle-actions :global(.featured-vehicle-action) {border-color:var(--color-warning);color:var(--color-warning);}
  .featured-slot {
    display: inline-flex;
    min-width: 130px;
    min-height: 22px;
    align-items: center;
  }
</style>
