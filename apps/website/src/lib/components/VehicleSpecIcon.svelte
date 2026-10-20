<script lang="ts">
  import { CarFront, CalendarDays, Gauge, Fuel, Car, Palette } from 'lucide-svelte';
  import { brandLogo } from '$lib/brandLogos';
  let { label, value = '' }: { label: string; value?: string } = $props();
  const logo = $derived(label === 'Marca' ? brandLogo(value) : undefined);
  const icons = {
    Ano: CalendarDays,
    Potência: Gauge,
    Combustível: Fuel,
    Categoria: Car,
    Cor: Palette,
  };
  const Icon = $derived(icons[label as keyof typeof icons] ?? CarFront);
</script>

{#if logo}
  <span
    class="spec-brand-logo"
    style={`mask-image: url('${logo}'); -webkit-mask-image: url('${logo}');`}
    aria-hidden="true"
  ></span>
{:else if ['Quilometragem', 'Caixa', 'Cilindrada', 'Lugares', 'Portas', 'Modelo'].includes(label)}
  <svg
    width="20"
    height="20"
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
      <rect x="6" y="3" width="12" height="8" rx="1" /><path d="M6 6h12m-8 5v5m4-5v5" /><circle
        cx="12"
        cy="19"
        r="3"
      />
    {:else if label === 'Portas'}
      <path d="m5 10 5-6h9v16H5V10Z M8 10l3-4h5v4H8Zm7 4h2" />
    {:else if label === 'Modelo'}
      <path d="m3 14 1-5h4l3-4h5l4 7 1 2v4h-3m-12 0H3v-4Zm5-5h10m-7-4v4m-4 9h7" /><circle
        cx="7"
        cy="18"
        r="2"
      /><circle cx="17" cy="18" r="2" />
    {:else}
      <path d="M7 3h3v4H7zM7 9h3l2 6h6a2 2 0 0 1 2 2v2H9a3 3 0 0 1-3-3V9Zm2 10-1 2m10-2 1 2" />
    {/if}
  </svg>
{:else}
  <Icon size={20} strokeWidth={1.5} aria-hidden="true" />
{/if}

<style>
  .spec-brand-logo {
    display: inline-block;
    width: 20px;
    height: 20px;
    background: currentColor;
    mask-size: contain;
    mask-position: center;
    mask-repeat: no-repeat;
    -webkit-mask-size: contain;
    -webkit-mask-position: center;
    -webkit-mask-repeat: no-repeat;
    flex-shrink: 0;
  }
</style>
