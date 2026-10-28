<script lang="ts">
  import ItalicHero from '$lib/components/brand/ItalicHero.svelte';
  import HomepageHighlightsEditor from '$lib/components/vehicle/HomepageHighlightsEditor.svelte';
  import type { PageData } from './$types';
  let { data }: { data: PageData } = $props();
</script>

<svelte:head><title>Destaques da homepage · Auto Nunes Martins</title></svelte:head>
<section class="pt-8 pb-12 space-y-6">
  <div>
    <ItalicHero text="Destaques da homepage" size="lg" />
    <p
      class="mt-2 font-mono text-[11px] uppercase tracking-[0.12em] text-[var(--color-text-muted)]"
    >
      <span class="text-[var(--color-red)]">●</span> Site público + seleção editorial
    </p>
  </div>
  <HomepageHighlightsEditor editor={data.editor} selectedVehicleId={data.selectedVehicleId} />
</section>
