<script lang="ts">
  import {
    Tag,
    CarFront,
    CalendarDays,
    Route,
    Gauge,
    Cog,
    Fuel,
    Car,
    Cylinder,
    DoorOpen,
    Armchair,
    Palette,
  } from 'lucide-svelte';
  let { label }: { label: string } = $props();
  const icons = {
    Marca: Tag,
    Modelo: CarFront,
    Ano: CalendarDays,
    Quilometragem: Route,
    Potência: Gauge,
    Caixa: Cog,
    Combustível: Fuel,
    Categoria: Car,
    Cilindrada: Cylinder,
    Portas: DoorOpen,
    Lugares: Armchair,
    Cor: Palette,
  };
  const Icon = $derived(icons[label as keyof typeof icons] ?? CarFront);
</script>

<Icon size={20} strokeWidth={1.5} aria-hidden="true" />
