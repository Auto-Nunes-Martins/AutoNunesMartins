<script lang="ts">
 import {photoAttrs,photoFallback,type SignedVariantPhoto} from "$lib/vehicleImage";
  import { PUBLIC_WEBSITE_URL } from '$env/static/public';
  import { crmPath } from '$lib/paths';
  import { vehiclePrincipalPath } from '$lib/vehiclePrincipal';
  import { enhance } from '$app/forms';
  import { tick, untrack, type Snippet } from 'svelte';
  import { publicationDraftKey, reconcilePhotoSelection } from './publicationDraft';
  import VehiclePhotoDraft from './VehiclePhotoDraft.svelte';
  import type { EditPhoto } from './vehicleEditDraft';
  import PhotoGallery from './PhotoGallery.svelte';
  import { formFeedback, markFormSaved, refreshFormFeedback, showFormErrors } from '$lib/forms/formFeedback';
  import PublicPhotoPicker from './PublicPhotoPicker.svelte';
  import { formatEUR } from '$lib/utils/format';
  import { toast } from 'svelte-sonner';
  import { publicVehicleUrl } from '$lib/utils/publicVehicleUrl';
  import type { VehicleDetailResponse } from '$lib/server/vehicles';
  let {
    vehicle,
    photos = [],
    managePhotos = false,
    vehicleDetails,
    disabled = false,
    busy = $bindable(false),
    unified = false,
    photoDraft = $bindable<EditPhoto[]>([]),
    onsaveall,
    onstatechange,
  }: {
    vehicle: VehicleDetailResponse;
    photos?: SignedVariantPhoto[];
    managePhotos?: boolean;
    vehicleDetails?: Snippet;
    disabled?: boolean;
    busy?: boolean;
    unified?: boolean;
    photoDraft?: EditPhoto[];
    onsaveall?: () => void;
    onstatechange?: (state: { dirty: boolean; valid: boolean }) => void;
  } = $props();
  let price = $state('');
  let description = $state('');
  let transmission = $state('');
  let selected = $state<string[]>([]);
  let photoDragging = $state(false);
  let photoBusy = $state(false);
  const publicationFormId = $props.id();
  let loadedVehicle = '';
  let previousSavedPhotos: string[] = [];
  let formValid = $state(false);
  let draftPublished = $state(false);
  let specs = $state({
    powerHp: '',
    engineCc: '',
    doors: '',
    seats: '',
    category: '',
    color: '',
    equipment: '',
  });
  const cover = $derived(photos.find((photo) => photo.path === selected[0]));
  let pending = $state(false);
  $effect(() => { busy = pending || photoBusy || photoDragging; });
  let message = $state('');
  let confirmationDialog: HTMLDialogElement;
  let cancelButton: HTMLButtonElement;
  let confirmButton: HTMLButtonElement;
  let publicationForm: HTMLFormElement;
  let confirmationOrigin: HTMLElement | null = null;
  let confirmedWithoutPhoto = false;
  function confirmationKeydown(event: KeyboardEvent) {
    if (event.key !== 'Tab') return;
    if (event.shiftKey && document.activeElement === cancelButton) {
      event.preventDefault();
      confirmButton.focus();
    } else if (!event.shiftKey && document.activeElement === confirmButton) {
      event.preventDefault();
      cancelButton.focus();
    }
  }
  function cancelConfirmation() {
    confirmedWithoutPhoto = false;
    confirmationDialog.close();
    confirmationOrigin?.focus({ preventScroll: true });
  }
  function confirmPublication() {
    confirmedWithoutPhoto = true;
    confirmationDialog.close();
    publicationForm.requestSubmit();
  }
  const allowedPhotos = $derived(
    unified ? photoDraft.map(photo => photo.path) : vehicle.photos.filter((path) =>
      new RegExp(`^${vehicle.id}/[a-f0-9-]{36}\\.(jpg|jpeg|png|webp)$`).test(path),
    ),
  );
  const eligible = $derived(
    ['AVAILABLE', 'RESERVED'].includes(vehicle.status) && !vehicle.sale && !vehicle.soldDate,
  );
  const ready = $derived(
    eligible && (!price || Number(price) > 0) && description.trim().length > 0,
  );
  function savedPublicationDraft() {
    const details = vehicle.publicSpecifications;
    return {
      price: vehicle.publicSlug ? (vehicle.publicPrice ?? '') : (Number(vehicle.salePrice) > 0 ? vehicle.salePrice! : ''),
      description: vehicle.publicDescription ?? `${vehicle.brand} ${vehicle.model}, de ${vehicle.year}.`,
      transmission: vehicle.publicTransmission ?? '',
      selected: vehicle.publicPhotoPaths.filter(path => vehicle.photos.includes(path)),
      specs: {
      powerHp: String(details?.powerHp ?? ''),
      engineCc: String(details?.engineCc ?? ''),
      doors: String(details?.doors ?? ''),
      seats: String(details?.seats ?? ''),
      category: details?.category ?? '',
      color: details?.color ?? '',
      equipment: details?.equipment?.join('\n') ?? '',
      },
    };
  }
  function resetPublicationDraft() {
    const saved = savedPublicationDraft();
    price = saved.price; description = saved.description; transmission = saved.transmission;
    specs = saved.specs; selected = saved.selected;
    previousSavedPhotos = [...saved.selected];
    draftPublished = vehicle.webPublished;
  }
  const draftKey = $derived(publicationDraftKey({ price, description, transmission, selected, specs }));
  const publicationDirty = $derived((unified ? draftPublished !== vehicle.webPublished : !vehicle.webPublished) || draftKey !== publicationDraftKey(savedPublicationDraft()));
  const selectionPending = $derived(selected.length !== vehicle.publicPhotoPaths.length || selected.some(path => !vehicle.publicPhotoPaths.includes(path)));
  $effect(() => {
    draftKey;
    const changed = publicationDirty;
    const locked = pending || disabled;
    const photoOrder = unified ? photoDraft.map(photo => photo.path).join('|') : '';
    draftPublished;
    void tick().then(() => {
      if (!publicationForm) return;
      if (!unified && !changed && !locked) markFormSaved(publicationForm);
      else refreshFormFeedback(publicationForm);
    });
  });
  $effect(() => {
    const id = vehicle.id;
    const available = allowedPhotos;
    const saved = vehicle.publicPhotoPaths.filter(path => available.includes(path));
    untrack(() => {
      if (loadedVehicle !== id) {
        resetPublicationDraft();
        loadedVehicle = id;
      } else {
        selected = unified ? available.filter(path => selected.includes(path)) : reconcilePhotoSelection(selected, previousSavedPhotos, saved, available);
        previousSavedPhotos = [...saved];
      }
    });
  });
  const submit: import('@sveltejs/kit').SubmitFunction = ({
    formData,
    cancel,
    submitter,
    formElement,
  }) => {
    if (unified) { cancel(); onsaveall?.(); return; }
    if (disabled || pending || photoDragging || photoBusy || (formData.get('operation') === 'publish' && (!ready || !formValid || !publicationDirty))) {
      cancel();
      return;
    }
    if (formData.get('operation') === 'publish' && !formData.getAll('publicPhotoPaths').length) {
      if (!confirmedWithoutPhoto) {
        cancel();
        confirmationOrigin =
          submitter instanceof HTMLElement ? submitter : (document.activeElement as HTMLElement);
        confirmationDialog.showModal();
        cancelButton.focus();
        return;
      }
      formData.set('confirmWithoutPhoto', 'true');
    }
    confirmedWithoutPhoto = false;
    pending = true;
    message = '';
    return async ({ result, update }) => {
      try {
        await update({ reset: false, invalidateAll: result.type === 'success' });
        if (result.type === 'success') {
          await tick();
          if (formElement === publicationForm) resetPublicationDraft();
          await tick();
          message = 'Visibilidade no site atualizada.';
          toast.success(message);
        } else if (result.type === 'failure') {
          showFormErrors(formElement, result.data);
          message =
            result.type === 'failure'
              ? ((result.data as { error?: string })?.error ?? 'Falha ao atualizar.')
              : 'Não foi possível atualizar.';
          toast.error(message);
        }
      } finally {
        pending = false;
        await tick();
        if (result.type === 'success' && formElement === publicationForm) markFormSaved(formElement);
      }
    };
  };
</script>

{#if managePhotos}
  {#if unified}
    <VehiclePhotoDraft bind:photos={photoDraft} bind:selected persisted={vehicle.publicPhotoPaths} persistedCoverPath={vehiclePrincipalPath(vehicle) ?? vehicle.photos[0]} published={vehicle.webPublished && eligible} requirePublicPrincipal={draftPublished && eligible} form={publicationFormId} {disabled} />
  {:else}
  <PhotoGallery vehicleId={vehicle.id} {photos} disabled={disabled || pending} dragging={photoDragging} bind:busy={photoBusy}>
    {#snippet editor(controls)}
      <PublicPhotoPicker
        bind:selected
        bind:dragging={photoDragging}
        allowed={allowedPhotos}
        {photos}
        persisted={vehicle.publicPhotoPaths}
        published={vehicle.webPublished && eligible}
        pending={disabled || pending || controls.busy}
        form={publicationFormId}
        primaryPath={controls.primaryPath}
        onprimary={controls.setPrimary}
        onreorder={controls.reorder}
        ondelete={controls.deletePhoto}
        onpreview={controls.preview}
      />
    {/snippet}
  </PhotoGallery>
  {/if}
  <p class="note" role="status">{selectionPending ? `Seleção de fotografias por guardar. Use «${unified ? 'Guardar alterações' : 'Guardar publicação no site'}» para aplicar.` : 'Os indicadores «No site» e «Só no CRM» mostram o estado já guardado.'}</p>
{/if}

{@render vehicleDetails?.()}

<section class="web-publication" aria-labelledby="web-publication-title">
  <div class="heading">
    <div>
      <h2 id="web-publication-title">Publicação no website</h2>
      <p>O arquivo mínimo tem autorização própria. <a href={crmPath('/site/arquivo')}>Gerir identificação e fotografia do arquivo público</a>.</p>
      <p>
        {vehicle.webPublished
          ? eligible
            ? vehicle.status === 'RESERVED'
              ? 'Publicada · Reservada'
              : 'Publicada no site'
            : 'Publicação aprovada, mas oculta devido ao estado interno ou venda.'
          : 'Não publicada · visível apenas no CRM'}
      </p>
    </div>
    {#if vehicle.webPublished && !unified}<form method="POST" action="?/webPublication" use:enhance={submit}>
        <input type="hidden" name="operation" value="remove" /><button
          type="submit" disabled={disabled || pending || photoBusy || photoDragging}>Remover do site</button
        >
      </form>{/if}
  </div>
  <p class="note">
    Este controlo é independente da disponibilidade interna. Retirar do site não altera o estado nem
    a venda. As viaturas reservadas aparecem com a indicação «Reservada».
    {unified ? 'O botão «Guardar alterações» aplica os dados, as fotografias e a publicação em conjunto.' : 'Guarde primeiro quaisquer alterações à ficha interna.'}
  </p>
  {#if vehicle.webPublished && vehicle.publicSlug && eligible}<a
      href={publicVehicleUrl(PUBLIC_WEBSITE_URL, vehicle.publicSlug)}
      target="_blank"
      rel="noreferrer">Ver ficha pública ↗</a
    >{/if}
  <form
    id={publicationFormId}
    data-edit-publication
    novalidate={unified}
    method="POST"
    action="?/webPublication"
    use:formFeedback={{ onstatechange: state => { formValid = state.valid; onstatechange?.(state); } }}
    use:enhance={submit}
    bind:this={publicationForm}
  >
    <fieldset class="publication-lock" data-save-lock disabled={disabled || pending}>
    <input type="hidden" name="operation" value="publish" />
    {#if unified}
      <input type="hidden" name="published" value={String(draftPublished)} />
      <label class="publish-toggle"><input type="checkbox" data-error-field="published" bind:checked={draftPublished} /> Publicar esta viatura no website</label>
      <p class="note">Esta escolha só é aplicada ao guardar. Fotografias novas só ficam públicas se forem selecionadas.</p>
    {/if}
    <div class="fields">
      <label
        >Preço público (€)<input
          name="publicPrice"
          type="number"
          min="0.01"
          max="9999999999.99"
          step="0.01"
          bind:value={price}
        /></label
      >
      <label
        >Transmissão<select name="publicTransmission" bind:value={transmission}
          ><option value="">Não indicada</option><option value="MANUAL">Manual</option><option
            value="AUTOMATIC">Automática</option
          ></select
        ></label
      >
    </div>
    <label
      >Descrição pública<textarea
        name="publicDescription"
        rows="3"
        maxlength="6000"
        required={!unified || draftPublished}
        bind:value={description}
      ></textarea></label
    >
    <p class="note">
      Apenas este texto será publicado. Não inclua notas internas, matrícula, VIN ou dados pessoais.
      O preço público é aprovado separadamente do preço interno.
    </p>
    <fieldset>
      <legend>Detalhes públicos confirmados (opcional)</legend>
      <input type="hidden" name="specificationsPresent" value="true" />
      <p class="note">
        Preencha apenas características e equipamento confirmados nesta viatura. Os campos vazios
        não aparecem no site.
      </p>
      <div class="fields">
        <label
          >Potência (cv)<input
            name="powerHp"
            type="number"
            min="1"
            max="3000"
            step="1"
            bind:value={specs.powerHp}
          /></label
        >
        <label
          >Cilindrada (cm³)<input
            name="engineCc"
            type="number"
            min="1"
            max="20000"
            step="1"
            bind:value={specs.engineCc}
          /></label
        >
        <label
          >Portas<input
            name="doors"
            type="number"
            min="1"
            max="8"
            step="1"
            bind:value={specs.doors}
          /></label
        >
        <label
          >Lugares<input
            name="seats"
            type="number"
            min="1"
            max="20"
            step="1"
            bind:value={specs.seats}
          /></label
        >
        <label>Categoria<input name="category" maxlength="80" bind:value={specs.category} /></label>
        <label>Cor<input name="color" maxlength="80" bind:value={specs.color} /></label>
      </div>
      <label
        >Equipamento confirmado (um item por linha)<textarea
          name="equipment"
          rows="5"
          bind:value={specs.equipment}
        ></textarea></label
      >
    </fieldset>
    {#if !managePhotos}<fieldset>
        <legend>Fotografias autorizadas para o site</legend>
        <p class="note">A foto principal do anúncio e do CRM é a mesma. Para a alterar, use o editor de fotografias. A autorização para publicar cada fotografia é explícita.</p>
        <PublicPhotoPicker
          bind:selected
          bind:dragging={photoDragging}
          allowed={allowedPhotos}
          {photos}
          persisted={vehicle.publicPhotoPaths}
          published={vehicle.webPublished && eligible}
          primaryPath={vehiclePrincipalPath(vehicle) ?? vehicle.photos[0]}
          requirePublicPrincipal={eligible}
          pending={disabled || pending || photoBusy}
        />
      </fieldset>{/if}
    <details class="publication-preview">
      <summary>Pré-visualizar o anúncio · {selected.length} fotografias</summary>
      <div class="preview-card">
        {#if cover}<img {...photoAttrs(cover,800,'(max-width:700px) 80vw, 600px')} use:photoFallback={cover.url} alt="Foto principal do anúncio" />{:else}<div class="preview-empty">
            Imagem indisponível
          </div>{/if}
        <div>
          <span class="preview-kicker">Pré-visualização · só muda no site depois de guardar</span>
          <h3>{vehicle.brand} {vehicle.model}</h3>
          <p>{vehicle.year} · {vehicle.mileage.toLocaleString('pt-PT')} km</p>
          <strong>{price && Number(price) > 0 ? formatEUR(price) : 'Preço sob consulta'}</strong>
          <p class="preview-description">{description}</p>
        </div>
      </div>
    </details>
    <div class="requirements" aria-live="polite">
      {#if !eligible}<p>
          Requer estado Disponível ou Reservado, sem venda registada.
        </p>{/if}{#if !price}<p>
          Sem preço indicado, o site mostrará «Preço sob consulta».
        </p>{:else if !(Number(price) > 0)}<p>
          Indique um preço positivo ou deixe o campo vazio.
        </p>{/if}{#if !description.trim()}<p>
          Falta uma descrição pública.
        </p>{/if}{#if !selected.length}<p>
          Sem fotografia selecionada, será pedida confirmação para publicar com «Imagem
          indisponível».
        </p>{/if}
    </div>
    {#if !unified}<p class="note" role="status">{publicationDirty ? 'Alterações da publicação por guardar. Este botão guarda apenas os dados públicos e a seleção de fotografias.' : 'Publicação guardada · sem alterações.'}</p>
    <button type="submit" class="primary" disabled={disabled || pending || photoBusy || photoDragging || !ready || !formValid || !publicationDirty}
      >{pending
        ? 'A guardar…'
        : vehicle.webPublished
          ? 'Guardar publicação no site'
          : 'Publicar no site'}</button
    >{/if}
    </fieldset>
  </form>
  <p role="status" aria-live="polite">{message}</p>
</section>

<dialog
  class="publication-dialog"
  bind:this={confirmationDialog}
  aria-labelledby="publication-confirm-title"
  aria-describedby="publication-confirm-description"
  onkeydown={confirmationKeydown}
  oncancel={(event) => {
    event.preventDefault();
    cancelConfirmation();
  }}
  onclose={() => confirmationOrigin?.focus({ preventScroll: true })}
>
  <h2 id="publication-confirm-title">Publicar sem fotografia?</h2>
  <p id="publication-confirm-description">
    Esta viatura ficará visível no site com uma imagem indisponível até adicionar fotografias.
  </p>
  <div class="confirmation-actions">
    <button type="button" bind:this={cancelButton} onclick={cancelConfirmation}>Cancelar</button
    ><button type="button" class="primary" bind:this={confirmButton} onclick={confirmPublication}
      >Publicar mesmo assim</button
    >
  </div>
</dialog>

<style>
  .publish-toggle { display: flex; align-items: center; gap: 10px; font-size: 15px; font-weight: 600; margin-bottom: 12px; }
  .publication-lock { border: 0; padding: 0; margin: 0; min-width: 0; }
  .publication-dialog {
    width: min(460px, calc(100vw - 32px));
    max-height: calc(100svh - 40px);
    overflow: auto;
    margin: auto;
    padding: 26px;
    color: var(--color-text);
    background: var(--color-bg-1);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-card);
    box-shadow: 0 20px 60px #0006;
  }
  .publication-dialog::backdrop {
    background: #0008;
    backdrop-filter: blur(2px);
  }
  .publication-dialog p {
    font-size: 14px;
    line-height: 1.7;
    color: var(--color-text-muted);
    margin: 16px 0 24px;
  }
  .confirmation-actions {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    flex-wrap: wrap;
  }
  .web-publication {
    padding: 24px;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-card);
    background: var(--color-bg-1);
  }
  .heading {
    display: flex;
    align-items: start;
    justify-content: space-between;
    gap: 20px;
  }
  h2 {
    font-size: 19px;
    font-weight: 600;
    margin: 0 0 6px;
  }
  .note {
    font-size: 12px;
    color: var(--color-text-muted);
    line-height: 1.7;
    margin: 15px 0;
  }
  a {
    text-decoration: underline;
    font-size: 13px;
  }
  form {
    margin-top: 20px;
  }
  .heading form {
    margin: 0;
  }
  .fields {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
  }
  label {
    display: grid;
    gap: 7px;
    font-size: 13px;
    margin-bottom: 16px;
  }
  input:not([type='checkbox']),
  select,
  textarea {
    width: 100%;
    background: var(--color-bg-0);
    color: var(--color-text);
    border: 1px solid var(--color-border);
    padding: 10px;
    border-radius: var(--radius-btn);
  }
  fieldset {
    border: 1px solid var(--color-border);
    padding: 14px;
    margin: 20px 0;
  }
  legend {
    font-size: 13px;
    padding: 0 5px;
  }
  .publication-preview {
    margin: 20px 0;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-card);
    padding: 14px;
  }
  .publication-preview summary {
    cursor: pointer;
    font-size: 13px;
    font-weight: 600;
  }
  .preview-card {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    margin-top: 16px;
    background: var(--color-bg-2);
    border-radius: var(--radius-card);
    overflow: hidden;
  }
  .preview-card > img {
    width: 100%;
    height: 100%;
    max-height: 340px;
    object-fit: cover;
  }
  .preview-card > div {
    padding: 20px;
  }
  .preview-card h3 {
    font-family: var(--font-display);
    font-size: 22px;
    margin: 8px 0;
  }
  .preview-card p {
    font-size: 13px;
    color: var(--color-text-muted);
    margin: 8px 0;
  }
  .preview-kicker {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--color-text-faint);
  }
  .preview-description {
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }
  .preview-empty {
    display: grid;
    place-items: center;
    min-height: 180px;
  }
  @media (max-width: 600px) {
    .preview-card {
      grid-template-columns: 1fr;
    }
  }
  .requirements {
    font-size: 12px;
    color: var(--color-text-muted);
    margin-bottom: 14px;
  }
  button {
    min-height: 44px;
    border: 1px solid var(--color-border);
    padding: 10px 16px;
    border-radius: var(--radius-btn);
    cursor: pointer;
    font-size: 13px;
  }
  .primary {
    background: var(--color-red);
    color: white;
  }
  button:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }
  :is(button, input, select, textarea, a):focus-visible {
    outline: 2px solid var(--color-text);
    outline-offset: 3px;
  }
  @media (max-width: 600px) {
    .fields {
      grid-template-columns: 1fr;
    }
    .heading {
      flex-direction: column;
    }
    .web-publication {
      padding: 18px;
    }
  }
</style>
