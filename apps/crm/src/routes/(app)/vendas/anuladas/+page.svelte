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
        class="block p-5 border-b border-[var(--color-border)] hover:bg-[var(--color-bg-2)]"
        href={crmPath(`/vendas/${sale.id}`)}
      >
        <span class="font-semibold"
          >{sale.vehicle.brand}
          {sale.vehicle.model} · {sale.vehicle.licensePlate ?? sale.vehicle.vin}</span
        >
        <p class="mt-2 text-[12px] leading-relaxed text-[var(--color-text-muted)]">
          {sale.customer.name} · Venda registada em {formatDate(sale.saleDate)} · Valor histórico: {formatEUR(
            sale.salePrice,
          )} · Anulada
        </p>
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
