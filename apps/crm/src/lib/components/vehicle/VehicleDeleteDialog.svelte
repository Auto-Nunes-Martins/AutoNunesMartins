<script lang="ts">
  import { enhance } from '$lib/auth/enhance';
  import { crmPath } from '$lib/paths';
  import { toast } from 'svelte-sonner';
  import ConfirmDialog from '$lib/components/common/ConfirmDialog.svelte';

  let {
    id,
    brand,
    model,
    open = $bindable(false),
    busy = $bindable(false),
    blocked = false,
    disabled = false,
    onredirect,
    oncancel,
  }: {
    id: string;
    brand: string;
    model: string;
    open?: boolean;
    busy?: boolean;
    blocked?: boolean;
    disabled?: boolean;
    onredirect?: () => void;
    oncancel?: () => void;
  } = $props();
  let form: HTMLFormElement;
  let confirmedId: string | null = null;
  function confirm() {
    if (busy || blocked || disabled) return;
    confirmedId = id;
    form.requestSubmit();
  }
</script>

<form
  bind:this={form}
  hidden
  method="POST"
  action={crmPath(`/viaturas/${id}/editar?/delete`)}
  use:enhance={({ cancel }) => {
    if (!open || confirmedId !== id || blocked || disabled || busy) {
      cancel();
      return;
    }
    confirmedId = null;
    busy = true;
    return async ({ result, update }) => {
      try {
        if (result.type === 'redirect') {
          onredirect?.();
          open = false;
          toast.success('Viatura eliminada.');
        } else if (result.type === 'failure') {
          toast.error(
            (result.data as { error?: string } | undefined)?.error ??
              'Não foi possível eliminar a viatura.',
          );
        }
        await update({ reset: false });
      } finally {
        busy = false;
      }
    };
  }}
></form>

<ConfirmDialog
  bind:open
  title={`Eliminar ${brand} ${model}?`}
  message="A ficha, as despesas e as fotografias associadas serão eliminadas. O histórico de atividade é preservado. Esta ação não pode ser desfeita."
  confirmLabel="Eliminar viatura"
  cancelLabel="Cancelar"
  tone="danger"
  {busy}
  onconfirm={confirm}
  oncancel={() => {
    confirmedId = null;
    oncancel?.();
  }}
/>
