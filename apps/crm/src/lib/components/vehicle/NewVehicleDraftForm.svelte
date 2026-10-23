<script lang="ts">
  import { onMount, tick, untrack, type ComponentProps } from 'svelte';
  import VehicleForm from './VehicleForm.svelte';
  import { automaticDraft, draftStorage, registerDraftGuard } from '$lib/forms/automaticDraft';
  import { markFormSaved } from '$lib/forms/formFeedback';

  let { draftOwner }: { draftOwner: string | null } = $props();
  const key = untrack(() => `vehicle:${draftOwner}:new`);
  let root: HTMLElement;
  let ready = $state(false);
  let status = $state('');
  let initial = $state<ComponentProps<typeof VehicleForm>['initial']>({});
  type Values = Record<string, string>;
  let lastCapture: Values | undefined;
  let autosave: ReturnType<typeof automaticDraft<Values>> | undefined;
  let unregister: (() => void) | undefined;
  function form() { return root.querySelector<HTMLFormElement>('form')!; }
  function capture() {
    if (lastCapture && form().querySelector('fieldset[data-save-lock][disabled]')) return lastCapture;
    return lastCapture = Object.fromEntries([...new FormData(form())].map(([key, value]) => [key, String(value)]));
  }
  async function changed() { await tick(); autosave?.update(); }
  async function completed() {
    unregister?.();
    try { await autosave?.discard(); } catch { /* The server already saved the new vehicle. */ }
  }
  onMount(() => {
    let disposed = false;
    void (async () => {
      try {
        if (!draftOwner) throw Error('Sessão indisponível.');
        const saved = await draftStorage.read<Values>(key);
        if (disposed) return;
        if (saved) {
          initial = { ...saved, year: saved.year ? Number(saved.year) : null,
            mileage: saved.mileage ? Number(saved.mileage) : null,
            fuel: saved.fuel as NonNullable<typeof initial>['fuel'],
            status: saved.status as NonNullable<typeof initial>['status'],
            pendingDocFlags: { financing: saved['pendingDocFlags.financing'] === 'true',
              imt: saved['pendingDocFlags.imt'] === 'true', registration: saved['pendingDocFlags.registration'] === 'true',
              docs: saved['pendingDocFlags.docs'] === 'true' } };
          status = 'Rascunho recuperado neste dispositivo';
        }
      } catch { status = 'Não foi possível aceder ao rascunho automático'; }
      if (disposed) return;
      ready = true;
      await tick();
      autosave = automaticDraft({ capture,
        persist: value => draftOwner ? draftStorage.write(key, value) : Promise.reject(Error('Sessão indisponível.')),
        remove: () => draftStorage.remove(key), protected: () => markFormSaved(form(), { preserveErrors: true }),
        state: value => { status = value === 'saved' ? 'Rascunho guardado neste dispositivo' : value === 'saving' ? 'A guardar rascunho…' : 'Não foi possível guardar o rascunho'; },
      });
      markFormSaved(form());
      unregister = registerDraftGuard({ flush: autosave.flush, discard: autosave.abandon, resume: autosave.resume });
    })();
    return () => { disposed = true; unregister?.(); autosave?.dispose(); };
  });
</script>

<div bind:this={root} oninput={changed} onchange={changed}>
  {#if ready}
    <VehicleForm {initial} submitLabel="Guardar e continuar" onsaved={completed} />
    {#if status}<p class="draft-status" role="status">{status}</p>{/if}
  {:else}<p role="status">A recuperar rascunho…</p>{/if}
</div>

<style>
  .draft-status { margin-top: 16px; color: var(--color-text-muted); font-size: 12px; }
</style>
