<script lang="ts">
  import { Plus, Star } from 'lucide-svelte';
  import Panel from '$lib/components/common/Panel.svelte';
  import PanelHeader from '$lib/components/brand/PanelHeader.svelte';
  import Skeleton from '$lib/components/common/Skeleton.svelte';

  let {
    label = 'A carregar os destaques…',
    selected = 3,
    candidates = 5,
  }: { label?: string; selected?: number; candidates?: number } = $props();
</script>

<p class="sr-only" role="status">{label}</p>
<div class="loading-grid" aria-hidden="true">
  <Panel>
    <PanelHeader icon={Star} title="Carrossel da homepage" />
    <div class="p-5"><Skeleton width="85%" height="12px" /></div>
    <div class="divide-y divide-[var(--color-border)] border-y border-[var(--color-border)]">
      {#each Array(Math.max(1, selected)) as _, index (index)}
        <div class="flex items-center gap-3.5 px-5 py-[18px]">
          <Skeleton width="16px" height="12px" class="shrink-0" />
          <div class="selected-photo"><Skeleton height="100%" /></div>
          <div class="flex min-w-0 flex-1 flex-col gap-2">
            <Skeleton width="80%" />
            <Skeleton width="50%" height="10px" />
          </div>
        </div>
      {/each}
    </div>
    <div class="p-5"><Skeleton width="132px" height="32px" /></div>
  </Panel>

  <Panel>
    <PanelHeader icon={Plus} title="Adicionar viaturas" />
    <div class="p-5">
      <Skeleton height="40px" />
      <div class="py-3.5"><Skeleton width="80%" height="12px" /></div>
      <div class="candidate-rows divide-y divide-[var(--color-border)]">
        {#each Array(Math.min(6, Math.max(1, candidates))) as _, index (index)}
          <div class="flex items-center gap-3 py-3">
            <Skeleton width="64px" height="48px" class="shrink-0" />
            <div class="flex min-w-0 flex-1 flex-col gap-2">
              <Skeleton width="78%" />
              <Skeleton width="54%" height="10px" />
            </div>
            <Skeleton width="32px" height="32px" class="shrink-0" />
          </div>
        {/each}
      </div>
      <div class="pt-[18px]"><Skeleton width="124px" height="12px" /></div>
    </div>
  </Panel>
</div>

<style>
  .loading-grid {
    display: grid;
    grid-template-columns: minmax(0, 1.4fr) minmax(300px, 1fr);
    gap: 24px;
    align-items: start;
  }
  .selected-photo {
    width: 128px;
    aspect-ratio: 1.65;
    display: flex;
    flex-shrink: 0;
  }
  .candidate-rows {
    max-height: min(50svh, 420px);
    overflow: hidden;
  }
  @media (max-width: 1100px) {
    .loading-grid {
      grid-template-columns: 1fr;
    }
  }
  @media (max-width: 600px) {
    .selected-photo {
      width: 92px;
    }
    .candidate-rows {
      max-height: min(45svh, 320px);
    }
  }
</style>
