<script lang="ts">
  import { invalidateAll } from '$app/navigation';
  import { refreshCrmSession } from '$lib/auth/session';
  import { crmPath } from '$lib/paths';
  import { hasUnsavedForms } from '$lib/forms/formFeedback';
  import { RefreshCw } from 'lucide-svelte';
  import Button from './Button.svelte';
  let { status }: { status: number } = $props();
  let pending = $state(false);
  let message = $state('');
  async function retry() {
    if (pending) return;
    pending = true;
    message = '';
    try {
      await refreshCrmSession();
      if (hasUnsavedForms()) {
        message = 'A sessão foi validada. Guarde ou termine a edição antes de atualizar os dados.';
        return;
      }
      await invalidateAll();
    } catch {
      message =
        status === 401
          ? 'Ainda não foi possível validar a sessão. Pode entrar noutra janela e tentar novamente aqui.'
          : 'Ainda não foi possível atualizar esta página. Verifique a ligação e tente novamente.';
    } finally {
      pending = false;
    }
  }
</script>

<div class="error-recovery">
  {#if message}<p role="status">{message}</p>{/if}
  <div class="recovery-actions">
    <Button type="button" variant="outline" onclick={retry} disabled={pending} loading={pending}>
      <RefreshCw size={14} aria-hidden="true" />Tentar novamente
    </Button>
    {#if status === 401}
      <a href={crmPath('/')} target="_blank" rel="noopener noreferrer">Entrar noutra janela</a>
    {/if}
  </div>
</div>

<style>
  .error-recovery {
    min-width: 0;
  }
  p {
    margin: 0 0 12px;
    color: var(--color-text-muted);
    font: 12px/1.7 var(--font-sans);
    max-width: 56ch;
  }
  .recovery-actions {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
  }
  a {
    min-height: 40px;
    display: inline-flex;
    align-items: center;
    padding: 8px 12px;
    color: var(--color-text-muted);
    font: 13px var(--font-sans);
    text-decoration: underline;
    text-underline-offset: 3px;
  }
  a:hover {
    color: var(--color-text);
  }
  a:focus-visible {
    outline: 2px solid var(--color-red);
    outline-offset: 3px;
  }
</style>
