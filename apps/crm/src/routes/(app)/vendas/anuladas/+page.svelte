<script lang="ts">
  import { crmPath } from '$lib/paths';
  import type { PageData } from './$types';
  import { formatDate, formatEUR } from '$lib/utils/format';
  import Pagination from '$lib/components/common/Pagination.svelte';
  import ItalicHero from '$lib/components/brand/ItalicHero.svelte';
  import Panel from '$lib/components/common/Panel.svelte';
  import EmptyState from '$lib/components/common/EmptyState.svelte';
  import { Receipt } from 'lucide-svelte';
  let { data }: { data: PageData } = $props();
</script>

<svelte:head><title>Vendas anuladas · Auto Nunes Martins</title></svelte:head>
<section class="list-frame pt-8 pb-12 space-y-6">
  <ItalicHero text="Vendas anuladas" size="lg" />
  <p class="text-[13px] text-[var(--color-text-muted)]">
    Histórico preservado. Estes registos não contam nos indicadores nem nas exportações de vendas
    activas.
  </p>
  <Panel>
    {#each data.list.items as sale (sale.id)}
      <a
        class="flex items-center justify-between gap-2 px-3 py-2.5 md:p-5 border-b border-[var(--color-border)] hover:bg-[var(--color-bg-2)]"
        href={crmPath(`/vendas/${sale.id}`)}
      >
        <div class="min-w-0">
          <div class="truncate text-[14px] font-semibold">
            {sale.vehicle.brand}
            {sale.vehicle.model}
          </div>
          <div class="truncate text-[11px] text-[var(--color-text-muted)]">
            {sale.vehicle.licensePlate ?? sale.vehicle.vin ?? sale.vehicle.year} · {sale.customer
              .name}
          </div>
        </div>
        <div class="shrink-0 text-right">
          <div class="num-value text-[13px]" title="Valor histórico">
            {formatEUR(sale.salePrice)}
          </div>
          <div class="text-[11px] text-[var(--color-text-muted)]">{formatDate(sale.saleDate)}</div>
        </div>
      </a>
    {:else}<EmptyState
        icon={Receipt}
        title="Sem vendas anuladas"
        description="As vendas anuladas ficam aqui disponíveis para consulta."
      />{/each}
    <Pagination
      currentPage={data.list.page}
      totalPages={data.list.totalPages}
      total={data.list.total}
      pageSize={data.list.pageSize}
    />
  </Panel>
</section>
