<script lang="ts">
  import { CarFront, CalendarDays, Gauge, Fuel, Car, DoorOpen, Palette } from 'lucide-svelte';
  import { brandLogo } from '$lib/brandLogos';
  let { label, value = '' }: { label: string; value?: string } = $props();
  const logo = $derived(label === 'Marca' ? brandLogo(value) : undefined);
  const icons = {
    Modelo: CarFront,
    Ano: CalendarDays,
    Potência: Gauge,
    Combustível: Fuel,
    Categoria: Car,
    Portas: DoorOpen,
    Cor: Palette,
  };
  const Icon = $derived(icons[label as keyof typeof icons] ?? CarFront);
</script>

{#if logo}
  <img class="spec-brand-logo" src={logo} alt="" width="20" height="20" />
{:else if ['Quilometragem', 'Caixa', 'Cilindrada', 'Lugares'].includes(label)}
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
      <path d="M6 7v12m12-12v5H6m6-5v12" /><circle cx="6" cy="5" r="2" /><circle
        cx="12"
        cy="5"
        r="2"
      /><circle cx="18" cy="5" r="2" />
    {:else if label === 'Cilindrada'}
      <rect x="7" y="3" width="12" height="8" rx="1" /><path d="M7 6h12m-8 5-4 6m8-6-5 8" /><circle
        cx="7"
        cy="19"
        r="3"
      />
    {:else}
      <path d="M7 3h3v4H7zM7 9h3l2 6h6a2 2 0 0 1 2 2v2H9a3 3 0 0 1-3-3V9Zm2 10-1 2m10-2 1 2" />
    {/if}
  </svg>
{:else}
  <Icon size={20} strokeWidth={1.5} aria-hidden="true" />
{/if}

<style>
  .spec-brand-logo {
    object-fit: contain;
    flex-shrink: 0;
  }
  :global(html[data-theme='dark']) .spec-brand-logo {
    filter: invert(1);
  }
</style>
