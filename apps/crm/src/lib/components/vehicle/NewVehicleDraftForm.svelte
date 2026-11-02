<script lang="ts">
  import { onMount, tick, untrack, type ComponentProps } from 'svelte';
  import VehicleForm from './VehicleForm.svelte';
  import VehicleCharacteristics from './VehicleCharacteristics.svelte';
  import { automaticDraft, draftStorage, registerDraftGuard } from '$lib/forms/automaticDraft';
  import { markFormSaved } from '$lib/forms/formFeedback';
  import { goto } from '$app/navigation';
  import { crmPath } from '$lib/paths';
  import { toast } from 'svelte-sonner';
  import ConfirmDialog from '$lib/components/common/ConfirmDialog.svelte';
  import { rememberCreatedDraft } from './creationLifecycle';

  let { draftOwner }: { draftOwner: string | null } = $props();
  const key = untrack(() => `vehicle:${draftOwner}:new`);
  let root: HTMLElement;
  let ready = $state(false);
  let submitting = $state(false),
    cancelling = $state(false),
    confirmCancel = $state(false);
  let status = $state('');
  let initial = $state<ComponentProps<typeof VehicleForm>['initial']>({});
  let transmission = $state('');
  let specs = $state({
    version: '',
    powerHp: '',
    engineCc: '',
    doors: '',
    seats: '',
    category: '',
    color: '',
    equipment: '',
  });
  type Values = Record<string, string>;
  let lastCapture: Values | undefined;
  let autosave: ReturnType<typeof automaticDraft<Values>> | undefined;
  let unregister: (() => void) | undefined;
  function form() {
    return root.querySelector<HTMLFormElement>('form')!;
  }
  function capture() {
    if (lastCapture && form().querySelector('fieldset[data-save-lock][disabled]'))
      return lastCapture;
    return (lastCapture = Object.fromEntries(
      [...new FormData(form())].map(([key, value]) => [key, String(value)]),
    ));
  }
  async function changed() {
    await tick();
    autosave?.update();
  }
  async function completed(location?: string) {
    rememberCreatedDraft(draftOwner, location);
    unregister?.();
    try {
      await autosave?.discard();
    } catch {
      /* The server already saved the new vehicle. */
    }
  }
  async function discardLocal() {
    if (submitting) throw Error('Aguarde que a criação em curso termine.');
    try {
      await autosave?.discard();
    } catch (error) {
      autosave?.resume();
      throw error;
    }
    markFormSaved(form());
  }
  async function cancelCreation() {
    if (submitting || cancelling) return;
    cancelling = true;
    try {
      await discardLocal();
      unregister?.();
      confirmCancel = false;
      await goto(crmPath('/viaturas'));
    } catch {
      toast.error(
        'Não foi possível descartar a criação. Os dados continuam neste ecrã; tente novamente.',
      );
    } finally {
      cancelling = false;
    }
  }
  onMount(() => {
    let disposed = false;
    void (async () => {
      try {
        if (!draftOwner) throw Error('Sessão indisponível.');
        const saved = await draftStorage.read<Values>(key);
        if (disposed) return;
        if (saved) {
          transmission = saved.publicTransmission ?? '';
          specs = Object.fromEntries(
            Object.keys(specs).map((key) => [key, saved[key] ?? '']),
          ) as typeof specs;
          initial = {
            ...saved,
            year: saved.year ? Number(saved.year) : null,
            mileage: saved.mileage ? Number(saved.mileage) : null,
            fuel: saved.fuel as NonNullable<typeof initial>['fuel'],
            status: saved.status as NonNullable<typeof initial>['status'],
            pendingDocFlags: {
              financing: saved['pendingDocFlags.financing'] === 'true',
              imt: saved['pendingDocFlags.imt'] === 'true',
              registration: saved['pendingDocFlags.registration'] === 'true',
              docs: saved['pendingDocFlags.docs'] === 'true',
            },
          };
          status = 'Rascunho recuperado neste dispositivo';
        }
      } catch {
        status = 'Não foi possível aceder ao rascunho automático';
      }
      if (disposed) return;
      ready = true;
      await tick();
      autosave = automaticDraft({
        capture,
        persist: (value) =>
          draftOwner
            ? draftStorage.write(key, value)
            : Promise.reject(Error('Sessão indisponível.')),
        remove: () => draftStorage.remove(key),
        protected: () => markFormSaved(form(), { preserveErrors: true }),
        state: (value) => {
          status =
            value === 'saved'
              ? 'Rascunho guardado neste dispositivo'
              : value === 'saving'
                ? 'A guardar rascunho…'
                : 'Não foi possível guardar o rascunho';
        },
      });
      markFormSaved(form());
      unregister = registerDraftGuard({
        flush: autosave.flush,
        discard: discardLocal,
        resume: autosave.resume,
        busy: () => submitting || cancelling,
      });
    })();
    return () => {
      disposed = true;
      unregister?.();
      autosave?.dispose();
    };
  });
</script>

<div bind:this={root} oninput={changed} onchange={changed}>
  {#if ready}
    <VehicleForm
      {initial}
      bind:submitting
      disabled={cancelling}
      submitLabel="Guardar e continuar"
      onsaved={completed}
      cancelLabel="Cancelar criação"
      oncancel={() => (confirmCancel = true)}
    >
      {#snippet characteristics()}
        <VehicleCharacteristics bind:transmission bind:specs />
      {/snippet}
    </VehicleForm>
    {#if status}<p class="draft-status" role="status">{status}</p>{/if}
  {:else}<p role="status">A recuperar rascunho…</p>{/if}
</div>
<ConfirmDialog
  bind:open={confirmCancel}
  title="Cancelar criação?"
  message="Os dados desta criação serão descartados. Pode continuar a editar para os manter."
  confirmLabel="Descartar criação"
  cancelLabel="Continuar a editar"
  tone="danger"
  busy={cancelling}
  onconfirm={() => void cancelCreation()}
/>

<style>
  .draft-status {
    margin-top: 16px;
    color: var(--color-text-muted);
    font-size: 12px;
  }
</style>
