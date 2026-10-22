<script lang="ts">
  import { CarFront, CalendarDays, Gauge, Fuel, Car, SprayCan } from 'lucide-svelte';
  let { label, size = 20 }: { label: string; size?: number } = $props();
  const icons = {
    Modelo: Car,
    Ano: CalendarDays,
    Potência: Gauge,
    Combustível: Fuel,
    Categoria: Car,
    Cor: SprayCan,
  };
  const Icon = $derived(icons[label as keyof typeof icons] ?? CarFront);
</script>

<span class="vehicle-spec-glyph" style={`width:${size}px;height:${size}px`} aria-hidden="true">
  {#if ['Quilometragem', 'Caixa', 'Cilindrada', 'Lugares', 'Portas'].includes(label)}
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.7"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      {#if label === 'Quilometragem'}
        <path d="M4 19 8 5m8 0 4 14M12 6v2m0 3v2m0 3v2" />
      {:else if label === 'Caixa'}
        <path d="M5 5v14m7-14v14m7-14v7H5M3 5h4m3 0h4m3 0h4M3 19h4m3 0h4" />
      {:else if label === 'Cilindrada'}
        <path d="M8 7h7l3 3h3v8h-3l-2 2H8l-3-3v-7l3-3ZM9 4h5m-2.5 0v3M2 11v6m0-3h3m13-4v8" />
      {:else if label === 'Portas'}
        <path d="m5 10 5-6h9v16H5V10Z M8 10l3-4h5v4H8Zm7 4h2" />
      {:else}
        <path d="M7 3h3v4H7zM7 9h3l2 6h6a2 2 0 0 1 2 2v2H9a3 3 0 0 1-3-3V9Zm2 10-1 2m10-2 1 2" />
      {/if}
    </svg>
  {:else}
    <Icon {size} strokeWidth={1.5} aria-hidden="true" />
  {/if}
</span>

<style>
  .vehicle-spec-glyph {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    vertical-align: middle;
  }
  .vehicle-spec-glyph :global(svg.lucide) {
    stroke-width: 1.5;
  }
</style>
