<script lang="ts">
  import { invalidate } from '$app/navigation';
  import { refreshCrmSession } from '$lib/auth/session';
  import Button from '$lib/components/common/Button.svelte';
  import Panel from '$lib/components/common/Panel.svelte';
  import HomepageHighlightsEditor from '$lib/components/vehicle/HomepageHighlightsEditor.svelte';
  import HomepageHighlightsSkeleton from '$lib/components/vehicle/HomepageHighlightsSkeleton.svelte';
  import type { PageData } from './$types';
  let { data }: { data: PageData } = $props();
  let retrying = $state(false);
  let retryError = $state('');

  async function retry(status: number) {
    if (retrying) return;
    retrying = true;
    retryError = '';
    try {
      if (status === 401) await refreshCrmSession();
      await invalidate('crm:homepage-highlights');
    } catch {
      retryError = status === 401
        ? 'Ainda não foi possível validar a sessão.'
        : 'Ainda não foi possível atualizar os destaques.';
    } finally {
      retrying = false;
    }
  }
</script>

<svelte:head><title>Destaques da homepage · Site público · Auto Nunes Martins</title></svelte:head>
{#await data.editor}
  <HomepageHighlightsSkeleton />
{:then result}
  {#if result.ok}
    <HomepageHighlightsEditor editor={result.editor} selectedVehicleId={data.selectedVehicleId} />
  {:else}
    <Panel>
      <div class="space-y-3 p-6">
        <p class="text-sm text-[var(--color-text)]" role="alert">{retryError || result.message}</p>
        {#if result.status !== 403}
          <Button type="button" variant="outline" onclick={() => retry(result.status)} disabled={retrying} loading={retrying}>
            Tentar novamente
          </Button>
        {/if}
      </div>
    </Panel>
  {/if}
{/await}
