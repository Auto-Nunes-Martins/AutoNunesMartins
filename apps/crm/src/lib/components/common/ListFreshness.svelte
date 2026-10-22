<script lang="ts">
  import { invalidate } from '$app/navigation';
  import type { ListView } from '$lib/lists/navigationCache';
  let { snapshot, label = 'Lista' }: { snapshot: ListView<unknown>; label?: string } = $props();
  let retrying = $state(false);
  async function retry() {
    if (retrying) return;
    retrying = true;
    try { await invalidate('crm:overview'); } finally { retrying = false; }
  }
</script>

{#if snapshot.stale && snapshot.error && !snapshot.updating}
  <div class="list-freshness" role="status" aria-live="polite" aria-atomic="true">
    <span>{label}: última lista guardada{snapshot.updatedAt ? ` às ${new Date(snapshot.updatedAt).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}` : ''}.
      Não foi possível atualizar.</span>
    <button type="button" disabled={retrying} onclick={retry}>Tentar novamente</button>
  </div>
{/if}

<style>
  .list-freshness { min-height: 28px; display: flex; align-items: center; flex-wrap: wrap; gap: 4px 12px; color: var(--color-text-muted); font-size: 12px; }
  button { min-height: 28px; text-decoration: underline; text-underline-offset: 3px; }
  button:focus-visible { outline: 2px solid var(--color-red); outline-offset: 3px; }
</style>
