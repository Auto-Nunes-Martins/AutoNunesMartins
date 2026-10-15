<script lang="ts">
  import { crmPath } from '$lib/paths';
  import type { PageData } from './$types';
  import { formatDate, formatEUR } from '$lib/utils/format';
  import Pagination from '$lib/components/common/Pagination.svelte';
  let { data }: { data: PageData } = $props();
</script>

<svelte:head><title>Vendas anuladas · Auto Nunes Martins</title></svelte:head>
<section class="py-8 space-y-5">
  <h1 class="font-display text-3xl">Vendas anuladas</h1>
  <p>
    Histórico preservado. Estes registos não contam nos indicadores nem nas exportações de vendas
    activas.
  </p>
  <a class="underline" href={crmPath("/vendas")}>Voltar às vendas activas</a>
  {#each data.list.items as sale (sale.id)}
    <a
      class="block p-4 border border-[var(--color-border)] rounded hover:bg-[var(--color-bg-2)]"
      href={crmPath(`/vendas/${sale.id}`)}
    >
      <span class="font-semibold"
        >{sale.vehicle.brand}
        {sale.vehicle.model} · {sale.vehicle.licensePlate ?? sale.vehicle.vin}</span
      >
      <p>
        {sale.customer.name} · Venda registada em {formatDate(sale.saleDate)} · Valor histórico: {formatEUR(
          sale.salePrice,
        )} · Anulada
      </p>
    </a>
  {:else}<p>Sem vendas anuladas.</p>{/each}
  <Pagination
    currentPage={data.list.page}
    totalPages={data.list.totalPages}
    total={data.list.total}
    pageSize={data.list.pageSize}
  />
</section>
