<script lang="ts">
  import { photoAttrs, photoFallback, type SignedVariantPhoto } from '$lib/vehicleImage';
  import type { PhotoFraming } from '@anm/types';
  import { sessionFetch } from '$lib/auth/session';
  import { invalidateAll } from '$app/navigation';
  import { PUBLIC_WEBSITE_URL } from '$env/static/public';
  import WebsiteStatus from './WebsiteStatus.svelte';
  import {websiteVisibility} from '$lib/websiteVisibility';
  import { crmPath } from '$lib/paths';
  import { vehiclePrincipalPath } from '$lib/vehiclePrincipal';
  import { enhance } from '$lib/auth/enhance';
  import { tick, untrack, type Snippet } from 'svelte';
  import { publicationDraftKey } from './publicationDraft';
  import VehiclePhotoDraft from './VehiclePhotoDraft.svelte';
  import DescriptionEditor from './DescriptionEditor.svelte';
  import RichDescription from '../../../../../../shared/ui/RichDescription.svelte';
  import VehicleSpecGlyph from '../../../../../../shared/ui/VehicleSpecGlyph.svelte';
  import { descriptionText } from '@anm/types/richDescription';
  import type { EditPhoto, publicDraftFromForm } from './vehicleEditDraft';
  import PhotoGallery from './PhotoGallery.svelte';
  import {
    formFeedback,
    markFormSaved,
    refreshFormFeedback,
    showFormErrors,
  } from '$lib/forms/formFeedback';
  import PublicPhotoPicker from './PublicPhotoPicker.svelte';
  import { formatEUR } from '$lib/utils/format';
  import { toast } from 'svelte-sonner';
  import { publicVehicleUrl, publishedVehicleUrl } from '$lib/utils/publicVehicleUrl';
  import { vehicleSavedFeedback } from './vehicleSaveFeedback';
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
    creation = false,
    recoveredDraft,
    editorId,
  }: {
    vehicle: VehicleDetailResponse;
    photos?: SignedVariantPhoto[];
    managePhotos?: boolean;
    vehicleDetails?: Snippet<[Snippet]>;
    disabled?: boolean;
    busy?: boolean;
    unified?: boolean;
    photoDraft?: EditPhoto[];
    onsaveall?: () => void;
    onstatechange?: (state: { dirty: boolean; valid: boolean }) => void;
    creation?: boolean;
    recoveredDraft?: ReturnType<typeof publicDraftFromForm>;
    editorId?: string;
  } = $props();
  let price = $state('');
  let description = $state('');
  let transmission = $state('');
  let selected = $state<string[]>([]);
  let framing = $state<Record<string, PhotoFraming>>({});
  let framingBusy = $state(false);
  async function saveFraming(path: string, value: PhotoFraming | undefined) {
    framingBusy = true;
    try {
      const response = await sessionFetch(crmPath(`/viaturas/${vehicle.id}/photos/framing`), { method: 'POST', headers: {'content-type':'application/json'}, body: JSON.stringify({path, framing: value ?? null}) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? 'Não foi possível guardar o enquadramento.');
      framing = result.galleryFraming;
      await invalidateAll().catch(() => {});
      toast.success('Enquadramento guardado.');
      return true;
    } catch (error) { toast.error((error as Error).message); return false; } finally { framingBusy = false; }
  }
  let photoDragging = $state(false);
  let photoBusy = $state(false);
  const publicationFormId = $props.id();
  let loadedVehicle = '';
  let formValid = $state(false);
  let draftPublished = $state(false);
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
  const cover = $derived(
    (unified ? photoDraft : photos).find((photo) => photo.path === selected[0]),
  );
  let pending = $state(false);
  $effect(() => {
    busy = pending || photoBusy || photoDragging || framingBusy;
  });
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
    unified
      ? photoDraft.map((photo) => photo.path)
      : vehicle.photos.filter((path) =>
          new RegExp(`^${vehicle.id}/[a-f0-9-]{36}\\.(jpg|jpeg|png|webp)$`).test(path),
        ),
  );
  const eligible = $derived(
    (creation || ['AVAILABLE', 'RESERVED'].includes(vehicle.status)) &&
      !vehicle.sale &&
      !vehicle.soldDate,
  );
  const ready = $derived(
    eligible && (!price || Number(price) > 0) && descriptionText(description).length > 0,
  );
  function savedPublicationDraft() {
    if (creation && recoveredDraft) {
      const details = recoveredDraft.specifications as typeof recoveredDraft.specifications & Record<string, unknown>;
      return {
        price: recoveredDraft.price ?? '', description: recoveredDraft.description,
        transmission: recoveredDraft.transmission ?? '', selected: allowedPhotos,
        galleryFraming: recoveredDraft.galleryFraming ?? {},
        specs: { version: details.version, powerHp: String(details.powerHp ?? ''),
          engineCc: String(details.engineCc ?? ''), doors: String(details.doors ?? ''),
          seats: String(details.seats ?? ''), category: details.category, color: details.color,
          equipment: details.equipment.join('\n') },
      };
    }
    const details = vehicle.publicSpecifications;
    return {
      price: vehicle.publicSlug
        ? (vehicle.publicPrice ?? '')
        : Number(vehicle.salePrice) > 0
          ? vehicle.salePrice!
          : '',
      description:
        vehicle.publicDescription ?? `${vehicle.brand} ${vehicle.model}, de ${vehicle.year}.`,
      transmission: vehicle.publicTransmission ?? '',
      selected: vehicle.photos,
      galleryFraming: vehicle.galleryFraming ?? {},
      specs: {
        version: details?.version ?? '',
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
    framing = creation && recoveredDraft ? recoveredDraft.galleryFraming ?? {} : vehicle.galleryFraming ?? {};
    const saved = savedPublicationDraft();
    price = saved.price;
    description = saved.description;
    transmission = saved.transmission;
    specs = saved.specs;
    selected = saved.selected;
    draftPublished = creation ? false : vehicle.webPublished;
  }
  const draftKey = $derived(
    publicationDraftKey({ price, description, transmission, selected, specs, galleryFraming: framing }),
  );
  const publicationDirty = $derived(
    (unified ? draftPublished !== vehicle.webPublished : !vehicle.webPublished) ||
      draftKey !== publicationDraftKey(savedPublicationDraft()),
  );

  $effect(() => {
    draftKey;
    const changed = publicationDirty;
    const locked = pending || disabled;
    const photoOrder = unified ? photoDraft.map((photo) => photo.path).join('|') : '';
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
    untrack(() => {
      if (loadedVehicle !== id) {
        resetPublicationDraft();
        selected = [...available];
        loadedVehicle = id;
      } else {
        selected = [...available];
      }
    });
  });
  const submit: import('@sveltejs/kit').SubmitFunction = ({
    formData,
    cancel,
    submitter,
    formElement,
  }) => {
    if (unified) {
      cancel();
      onsaveall?.();
      return;
    }
    if (
      disabled ||
      pending ||
      photoDragging ||
      photoBusy ||
      framingBusy ||
      (formData.get('operation') === 'publish' && (!ready || !formValid || !publicationDirty))
    ) {
      cancel();
      return;
    }
    if (formData.get('operation') === 'publish' && !formData.getAll('vehiclePhotoPaths').length) {
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
          vehicleSavedFeedback({title:vehicle.webPublished?'Publicação atualizada':'Viatura retirada do website',brand:vehicle.brand,model:vehicle.model,year:vehicle.year,detail:message,photo:cover,onlineUrl:publishedVehicleUrl(PUBLIC_WEBSITE_URL,vehicle)});
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
        if (result.type === 'success' && formElement === publicationForm)
          markFormSaved(formElement);
      }
    };
  };
</script>

{#snippet vehicleCharacteristics()}
  <fieldset
    class="vehicle-characteristics crm-form-layout"
    data-vehicle-specifications
    disabled={disabled || pending}
  >
    <legend>Características e equipamento</legend>
    <input type="hidden" name="specificationsPresent" form={publicationFormId} value="true" />
    <p class="note">
      Preencha apenas características e equipamento confirmados nesta viatura. Os campos vazios não
      aparecem no site.
    </p>
    <div class="fields crm-compact-fields">
      <label style="--field-width: 180px"
        ><span class="spec-field-label"><VehicleSpecGlyph label="Caixa" />Transmissão</span><select
          name="publicTransmission"
          form={publicationFormId}
          bind:value={transmission}
          ><option value="">Não indicada</option><option value="MANUAL">Manual</option><option
            value="AUTOMATIC">Automática</option
          ></select
        ></label
      >
      <label style="--field-width: 260px"
        ><span class="spec-field-label">Versão / motorização <small>(opcional)</small></span><input
          name="version"
          form={publicationFormId}
          maxlength="160"
          bind:value={specs.version}
          placeholder="Ex.: 1.6 TDI S-line"
        /></label
      >
      <label style="--field-width: 150px"
        ><span class="spec-field-label"><VehicleSpecGlyph label="Categoria" />Categoria</span><input
          name="category"
          form={publicationFormId}
          maxlength="80"
          bind:value={specs.category}
        /></label
      >
      <label style="--field-width: 130px"
        ><span class="spec-field-label"><VehicleSpecGlyph label="Cor" />Cor</span><input
          name="color"
          form={publicationFormId}
          maxlength="80"
          bind:value={specs.color}
        /></label
      >
    </div>
    <div class="number-fields">
      <label
        ><span class="spec-field-label"><VehicleSpecGlyph label="Potência" />Potência (cv)</span
        ><input
          name="powerHp"
          form={publicationFormId}
          type="number"
          min="1"
          max="3000"
          step="1"
          bind:value={specs.powerHp}
        /></label
      >
      <label
        ><span class="spec-field-label"
          ><VehicleSpecGlyph label="Cilindrada" />Cilindrada (cm³)</span
        ><input
          name="engineCc"
          form={publicationFormId}
          type="number"
          min="1"
          max="20000"
          step="1"
          bind:value={specs.engineCc}
        /></label
      >
      <label
        ><span class="spec-field-label"><VehicleSpecGlyph label="Portas" />Portas</span><input
          name="doors"
          form={publicationFormId}
          type="number"
          min="1"
          max="8"
          step="1"
          bind:value={specs.doors}
        /></label
      >
      <label
        ><span class="spec-field-label"><VehicleSpecGlyph label="Lugares" />Lugares</span><input
          name="seats"
          form={publicationFormId}
          type="number"
          min="1"
          max="20"
          step="1"
          bind:value={specs.seats}
        /></label
      >
    </div>
    <label
      >Equipamento confirmado (um item por linha)<textarea
        name="equipment"
        form={publicationFormId}
        rows="3"
        bind:value={specs.equipment}
      ></textarea></label
    >
  </fieldset>
{/snippet}

{#if managePhotos}
  {#if unified}
    <VehiclePhotoDraft
      bind:photos={photoDraft}
      bind:selected
      persisted={vehicle.photos}
      persistedCoverPath={vehiclePrincipalPath(vehicle) ?? vehicle.photos[0]}

      form={publicationFormId}
      bind:framing
      {disabled}
    />
  {:else}
    <PhotoGallery
      vehicleId={vehicle.id}
      {photos}
      disabled={disabled || pending || framingBusy}
      dragging={photoDragging}
      bind:busy={photoBusy}
    >
      {#snippet editor(controls)}
        <PublicPhotoPicker
          bind:selected
          bind:dragging={photoDragging}
          allowed={allowedPhotos}
          {photos}
          persisted={vehicle.photos}

          pending={disabled || pending || controls.busy || framingBusy}
          form={publicationFormId}
          primaryPath={controls.primaryPath}
          onprimary={controls.setPrimary}
          onreorder={controls.reorder}
          ondelete={controls.deletePhoto}
          onpreview={controls.preview}
          {framing} onframing={saveFraming}
        />
      {/snippet}
    </PhotoGallery>
  {/if}

{/if}

<div class:editing-panels={unified}>
  {#if vehicleDetails}
    {@render vehicleDetails(vehicleCharacteristics)}
  {:else}
    <section class="standalone-characteristics">{@render vehicleCharacteristics()}</section>
  {/if}

  <div class="publication-editor" id={editorId}>
  <section class="web-publication" aria-labelledby="web-publication-title">
    <div class="heading">
      <div>
        <h2 id="web-publication-title" tabindex="-1">Publicação no website</h2>
        {#if creation}<p class="publication-status">Escolha uma das ações finais para guardar ou publicar.</p>{:else}<WebsiteStatus {vehicle} />{#if !websiteVisibility(vehicle).visible}<p class="publication-status">{websiteVisibility(vehicle).detail}</p>{/if}{/if}
      </div>
      {#if websiteVisibility(vehicle).visible && vehicle.publicSlug}<a
          class="public-view-link"
          href={publicVehicleUrl(PUBLIC_WEBSITE_URL, vehicle.publicSlug)}
          target="_blank"
          rel="noreferrer">Ver ficha pública ↗</a
        >{/if}
      {#if vehicle.webPublished && !unified}<form
          method="POST"
          action="?/webPublication"
          use:enhance={submit}
        >
          <input type="hidden" name="operation" value="remove" /><button
            type="submit"
            disabled={disabled || pending || photoBusy || photoDragging}>Remover do site</button
          >
        </form>{/if}
    </div>
    <form
      id={publicationFormId}
      class="crm-form-layout"
      data-edit-publication
      novalidate={unified}
      method="POST"
      action="?/webPublication"
      use:formFeedback={{
        onstatechange: (state) => {
          formValid = state.valid;
          onstatechange?.(state);
        },
      }}
      use:enhance={submit}
      bind:this={publicationForm}
    >
      <fieldset class="publication-lock" data-save-lock disabled={disabled || pending}>
        <input type="hidden" name="vehicleId" value={vehicle.id} />
        {#if unified}<input type="hidden" name="galleryFraming" value={JSON.stringify(Object.fromEntries(Object.entries(framing).filter(([path]) => allowedPhotos.includes(path))))} />{/if}
        <input type="hidden" name="operation" value="publish" />
        {#if unified}
          <input type="hidden" name="published" value={String(draftPublished)} />

        {/if}
        <h3 class="publication-group-title">Dados do anúncio</h3>
        <div class="fields crm-compact-fields">
          <label class="public-price-field" style="--field-width: 170px"
            >Preço público (€)<input
              name="publicPrice"
              type="number"
              min="0.01"
              max="9999999999.99"
              step="0.01"
              bind:value={price}
            /></label
          >
        </div>
        <DescriptionEditor
          bind:value={description}
          disabled={disabled || pending}
          required={!creation && (!unified || draftPublished)}
        />
        {#if creation}<p class="note">
            <span class="required-marker" style="color:var(--color-red)" aria-hidden="true">*</span> A
            descrição pública é obrigatória apenas para «Concluir e publicar». As características opcionais
            podem ficar vazias.
          </p>{/if}
        <p class="note">
          Visível no website. Não inclua notas internas, matrícula, VIN ou dados pessoais. O preço
          público é independente do interno.
        </p>
        {#if !managePhotos}<fieldset>
            <legend>Fotografias da viatura</legend>
            <p class="note">
              A foto principal do anúncio e do CRM é a mesma. Para a alterar, use o editor de
              fotografias. Todas acompanham a publicação global da viatura.
            </p>
            <PublicPhotoPicker
              bind:selected
              bind:dragging={photoDragging}
              allowed={allowedPhotos}
              {photos}
              persisted={vehicle.photos}
              {framing} onframing={saveFraming}

              primaryPath={vehiclePrincipalPath(vehicle) ?? vehicle.photos[0]}
              pending={disabled || pending || photoBusy || framingBusy}
            />
          </fieldset>{/if}
        <details class="publication-help">
          <summary>Como funciona a publicação</summary>
          <p class="note">
            Retirar do site não altera o estado nem a venda. As viaturas reservadas aparecem como
            «Reservada».
            {unified
              ? '«Guardar alterações» aplica os dados, as fotografias e a publicação em conjunto.'
              : 'Guarde primeiro as alterações à ficha interna.'}
          </p>
        </details>
        <details class="publication-preview">
          <summary>Pré-visualizar o anúncio · {selected.length} fotografias</summary>
          <div class="preview-card">
            {#if cover}<img
                {...photoAttrs(cover, 800, '(max-width:700px) 80vw, 600px')}
                use:photoFallback={cover.url}
                alt="Foto principal do anúncio"
              />{:else}<div class="preview-empty">Imagem indisponível</div>{/if}
            <div>
              <span class="preview-kicker"
                >Pré-visualização · só muda no site depois de guardar</span
              >
              <h3>{vehicle.brand} {vehicle.model}</h3>
              <p>{vehicle.year} · {vehicle.mileage.toLocaleString('pt-PT')} km</p>
              <strong>{price && Number(price) > 0 ? formatEUR(price) : 'Preço sob consulta'}</strong
              >
              <div class="preview-description"><RichDescription value={description} /></div>
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
            </p>{/if}{#if !descriptionText(description)}<p>
              Falta uma descrição pública.
            </p>{/if}{#if !selected.length}<p>
              Sem fotografias na viatura, será pedida confirmação para publicar com «Imagem
              indisponível».
            </p>{/if}
        </div>
        {#if !unified}<p class="note" role="status">
            {publicationDirty
              ? 'Alterações da publicação por guardar. Este botão guarda apenas os dados públicos.'
              : 'Publicação guardada · sem alterações.'}
          </p>
          <button
            type="submit"
            class="primary"
            disabled={disabled ||
              pending ||
              photoBusy ||
              photoDragging ||
              !ready ||
              !formValid ||
              !publicationDirty}
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
  </div>
</div>

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
  .publication-editor {min-width: 0;scroll-margin-top: 190px;}
  @media (max-width: 600px) {.publication-editor {scroll-margin-top: 260px;}}
  .spec-field-label {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 20px;
  }
  .vehicle-characteristics {
    width: 100%;
    min-width: 0;
    margin: 0;
  }
  .vehicle-characteristics legend {
    font-size: 18px;
    font-weight: 600;
    padding: 0;
  }
  .standalone-characteristics {
    padding: 20px;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-card);
    background: var(--color-bg-1);
    margin-block: 20px;
  }
  .editing-panels {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 20px;
    max-width: 1480px;
    margin-inline: auto;
    align-items: start;
  }
  .editing-panels > :global(*) {
    min-width: 0;
  }
  .number-fields {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 140px));
    gap: 14px;
    margin-block: 16px;
  }
  .number-fields > label {
    min-width: 0;
    margin-bottom: 0;
    align-content: start;
  }
  .number-fields input {
    min-width: 0;
    width: 100%;
  }
  .number-fields :is([name='doors'], [name='seats']) {
    max-width: 90px;
  }
  .fields :is([name='category'], [name='color']) {
    max-width: 240px;
  }
  .fields [name='version'] {
    max-width: 480px;
  }
  .fields [name='publicTransmission'] {
    max-width: 240px;
  }
  @container (min-width: 480px) {
    .number-fields {
      grid-template-columns: minmax(0, 120px) minmax(0, 140px) repeat(2, minmax(0, 90px));
    }
  }
  .public-price-field input {
    max-width: 240px;
  }
  label small {
    font-size: 11px;
    color: var(--color-text-muted);
  }
  .public-view-link {
    margin-left: auto;
    align-self: center;
    white-space: nowrap;
  }
  .publication-group-title {
    font-size: 13px;
    font-weight: 600;
    margin: 20px 0 12px;
  }
  .publication-status {
    font-size: 12px;
    color: var(--color-text-muted);
    margin-top: 5px;
  }
  .publication-help {
    font-size: 12px;
    color: var(--color-text-muted);
    margin: 8px 0 16px;
  }
  .publication-help summary {
    cursor: pointer;
    width: fit-content;
  }
  .publication-intro {
    margin: 10px 0 0;
  }
  .publication-lock {
    border: 0;
    padding: 0;
    margin: 0;
    min-width: 0;
  }
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
    padding: 20px;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-card);
    background: var(--color-bg-1);
  }
  .heading {
    display: flex;
    align-items: start;
    justify-content: space-between;
    gap: 12px;
    padding-bottom: 14px;
    margin-bottom: 14px;
    border-bottom: 1px solid var(--color-border);
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
    display: flex;
    gap: 16px;
  }
  .fields {
    margin-bottom: 18px;
  }
  .fields > label {
    margin-bottom: 0;
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
    min-height: 44px;
    border-radius: var(--radius-btn);
  }
  fieldset {
    border: 0;
    border-top: 1px solid var(--color-border);
    padding: 16px 0 0;
    margin: 24px 0 0;
    min-width: 0;
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
    .heading {
      flex-direction: column;
    }
    .web-publication {
      padding: 18px;
    }
  }
</style>
