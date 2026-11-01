<script lang="ts">
  import { Trash2 } from 'lucide-svelte';
  import { invalidateAll } from '$app/navigation';
  import { toast } from 'svelte-sonner';
  import ConfirmDialog from '$lib/components/common/ConfirmDialog.svelte';
  import RowActions from '$lib/components/common/RowActions.svelte';
  import { discardVehicleDraft } from './creationLifecycle';
  let { id, label }: { id: string; label: string } = $props();
  let open = $state(false), busy = $state(false);
  let opener: HTMLButtonElement | null = null;
  async function remove() {
    if (busy) return;
    busy = true;
    try {
      await discardVehicleDraft(id);
      open = false;
      toast.success('Rascunho eliminado.');
      await invalidateAll();
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Não foi possível eliminar o rascunho.'); }
    finally { busy = false; }
  }
</script>
<RowActions {label} actions={[{ label: 'Eliminar rascunho', icon: Trash2, danger: true, disabled: busy,
  onselect: trigger => { opener = trigger; open = true; } }]} />
<ConfirmDialog bind:open title="Eliminar rascunho?" message={`Os dados e as fotografias de ${label} serão descartados. Esta ação não pode ser desfeita.`}
  confirmLabel="Eliminar rascunho" cancelLabel="Manter rascunho" tone="danger" {busy}
  oncancel={() => { if (opener?.isConnected) opener.focus(); }} onconfirm={() => void remove()} />
