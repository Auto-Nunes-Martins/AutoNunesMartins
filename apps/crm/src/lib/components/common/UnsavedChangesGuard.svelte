<script lang="ts">
  import { beforeNavigate, goto } from '$app/navigation';
  import ConfirmDialog from './ConfirmDialog.svelte';
  import { toast } from 'svelte-sonner';
  import { hasUnsavedForms } from '$lib/forms/formFeedback';
  import { isSessionNavigationDeferred } from '$lib/auth/session';
  import { activeDraftGuard } from '$lib/forms/automaticDraft';
  let open = $state(false);
  let destination = $state<string | null>(null);
  let approved: string | null = null;
  let automaticFailure = $state(false);
  let pending = $state(false);

  async function protectAndLeave() {
    if (pending) return;
    pending = true;
    try {
      await activeDraftGuard()?.flush();
      await leave();
    } catch {
      automaticFailure = true;
      open = true;
    } finally { pending = false; }
  }

  beforeNavigate((navigation) => {
    // Refresh and external navigation use the browser's native beforeunload dialog.
    if (navigation.willUnload) return;
    if (approved === navigation.to?.url.href) {
      approved = null;
      return;
    }
    if (isSessionNavigationDeferred()) return;
    if (
      navigation.to?.url.pathname === navigation.from?.url.pathname &&
      navigation.to?.url.search === navigation.from?.url.search
    )
      return;
    if (activeDraftGuard()) {
      navigation.cancel();
      if (activeDraftGuard()?.busy?.()) {
        toast.error('Aguarde que a operação em curso termine antes de sair.');
        return;
      }
      destination = navigation.to?.url.href ?? null;
      void protectAndLeave();
      return;
    }
    if (hasUnsavedForms()) {
      navigation.cancel();
      destination = navigation.to?.url.href ?? null;
      automaticFailure = false;
      open = true;
    }
  });
  async function leave() {
    const target = destination;
    open = false;
    if (!target) return;
    approved = target;
    try {
      await goto(target);
    } catch {
      approved = null;
      activeDraftGuard()?.resume?.();
      toast.error('Não foi possível abrir a página. As alterações continuam neste ecrã.');
    }
  }
  async function discardAndLeave() {
    if (pending || activeDraftGuard()?.busy?.()) return;
    pending = true;
    try {
      await activeDraftGuard()?.discard();
      await leave();
    } catch (error) {
      activeDraftGuard()?.resume?.();
      toast.error(error instanceof Error ? error.message : 'Não foi possível descartar o rascunho. Continue a editar ou tente novamente.');
    } finally { pending = false; }
  }
</script>

<ConfirmDialog
  bind:open
  title={automaticFailure ? 'Não foi possível guardar o rascunho' : 'Sair desta página?'}
  message={activeDraftGuard()?.discardMessage ?? (automaticFailure ? 'As últimas alterações ainda não estão protegidas. Pode tentar novamente ou continuar a editar.' : 'Se sair agora, perde as alterações que ainda não guardou.')}
  confirmLabel="Sair sem guardar"
  cancelLabel={automaticFailure ? 'Continuar a editar' : 'Ficar na página'}
  secondaryLabel={automaticFailure ? 'Tentar novamente' : undefined}
  onsecondary={() => void protectAndLeave()}
  busy={pending}
  tone="danger"
  onconfirm={() => void discardAndLeave()}
  oncancel={() => (destination = null)}
/>
