<script lang="ts">
  import { normalizeDecimal } from '$lib/forms/numericField';
  import { ArrowUpRight, ImageOff } from 'lucide-svelte';
  import { reusablePhoto } from '$lib/photos/reusablePhoto';
  import { photoAttrs, type SignedVariantPhoto } from '$lib/photos/vehicleImage';
  import { framingStyle, photoFraming, type GalleryPhotoFraming } from '@anm/types';
  import { sessionFetch } from '$lib/auth/session';
  import { invalidateAll } from '$app/navigation';
  import { PUBLIC_WEBSITE_URL } from '$env/static/public';
  import WebsiteStatus from './WebsiteStatus.svelte';
  import { websiteVisibility } from '$lib/vehicles/websiteVisibility';
  import { crmPath } from '$lib/paths';
  import { vehiclePrincipalPath } from '$lib/vehicles/vehiclePrincipal';
  import { enhance } from '$lib/auth/enhance';
  import { tick, untrack, type Snippet } from 'svelte';
  import { publicationDraftKey } from './publicationDraft';
  import VehiclePhotoDraft from './VehiclePhotoDraft.svelte';
  import DescriptionEditor from './DescriptionEditor.svelte';
  import RichDescription from '../../../../../../shared/ui/RichDescription.svelte';
  import VehicleCharacteristics from './VehicleCharacteristics.svelte';
  import { descriptionText } from '@anm/types/richDescription';
  import type { EditPhoto, listingDetailsFromForm, publicDraftFromForm } from './vehicleEditDraft';
  import PhotoGallery from './PhotoGallery.svelte';
  import {
    formFeedback,
    markFormSaved,
    refreshFormFeedback,
    showFormErrors,
  } from '$lib/forms/formFeedback';
  import PublicPhotoPicker from './PublicPhotoPicker.svelte';
  import { formatInt } from '$lib/utils/format';
  import { toast } from 'svelte-sonner';
  import { publicVehicleUrl, publishedVehicleUrl } from '$lib/utils/publicVehicleUrl';
  import { vehicleSavedFeedback } from './vehicleSaveFeedback';
  import type { VehicleDetailResponse } from '$lib/server/vehicles';
  let {
    vehicle,
    listingDetails,
    photos = [],
    managePhotos = false,
    vehicleDetails,
    disabled = false,
    busy = $bindable(false),
    unified = false,
    photoDraft = $bindable<EditPhoto[]>([]),
    onDiscardPrepared,
    onsaveall,
    onstatechange,
    creation = false,
    recoveredDraft,
    editorId,
  }: {
    vehicle: VehicleDetailResponse;
    listingDetails?: ReturnType<typeof listingDetailsFromForm>;
    photos?: SignedVariantPhoto[];
    managePhotos?: boolean;
    vehicleDetails?: Snippet<[Snippet]>;
    disabled?: boolean;
    busy?: boolean;
    unified?: boolean;
    photoDraft?: EditPhoto[];
    onDiscardPrepared?: (paths: string[]) => Promise<void>;
    onsaveall?: () => void;
    onstatechange?: (state: { dirty: boolean; valid: boolean }) => void;
    creation?: boolean;
    recoveredDraft?: ReturnType<typeof publicDraftFromForm>;
    editorId?: string;
  } = $props();
  const brand = $derived(listingDetails?.brand || vehicle.brand);
  const model = $derived(listingDetails?.model || vehicle.model);
  const year = $derived(listingDetails?.year || vehicle.year);
  const mileage = $derived(listingDetails ? listingDetails.mileage || null : vehicle.mileage);
  const fuel = $derived(listingDetails?.fuel || vehicle.fuel);
  const price = $derived(normalizeDecimal(listingDetails?.salePrice ?? vehicle.salePrice ?? ''));
  const numericPrice = $derived(Number(price));
  const hiddenPrice = $derived(
    vehicle.publicPriceOnRequest && numericPrice === Number(vehicle.salePrice),
  );
  const priceFormatter = new Intl.NumberFormat('pt-PT', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
  const fuelLabels: Record<string, string> = {
    GASOLINE: 'Gasolina',
    DIESEL: 'Gasóleo',
    HYBRID: 'Híbrido',
    PLUGIN_HYBRID: 'Híbrido Plug-in',
    ELECTRIC: 'Elétrico',
    LPG: 'GPL',
  };
  let description = $state('');
  let transmission = $state('');
  let selected = $state<string[]>([]);
  let framing = $state<Record<string, GalleryPhotoFraming>>({});
  let framingBusy = $state(false);
  async function saveFraming(path: string, value: GalleryPhotoFraming | undefined) {
    framingBusy = true;
    try {
      const response = await sessionFetch(crmPath(`/viaturas/${vehicle.id}/photos/framing`), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ path, framing: value ?? null }),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error ?? 'Não foi possível guardar o enquadramento.');
      framing = result.galleryFraming;
      await invalidateAll().catch(() => {});
      toast.success('Enquadramento guardado.');
      return true;
    } catch (error) {
      toast.error((error as Error).message);
      return false;
    } finally {
      framingBusy = false;
    }
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
    eligible &&
      (!price || numericPrice > 0) &&
      descriptionText(description).length > 0,
  );
  function savedPublicationDraft() {
    if (creation && recoveredDraft) {
      const details = recoveredDraft.specifications as typeof recoveredDraft.specifications &
        Record<string, unknown>;
      return {
        description: recoveredDraft.description,
        transmission: recoveredDraft.transmission ?? '',
        selected: allowedPhotos,
        galleryFraming: recoveredDraft.galleryFraming ?? {},
        specs: {
          version: details.version,
          powerHp: String(details.powerHp ?? ''),
          engineCc: String(details.engineCc ?? ''),
          doors: String(details.doors ?? ''),
          seats: String(details.seats ?? ''),
          category: details.category,
          color: details.color,
          equipment: details.equipment.join('\n'),
        },
      };
    }
    const details = vehicle.publicSpecifications;
    return {
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
    framing =
      creation && recoveredDraft
        ? (recoveredDraft.galleryFraming ?? {})
        : (vehicle.galleryFraming ?? {});
    const saved = savedPublicationDraft();
    description = saved.description;
    transmission = saved.transmission;
    specs = saved.specs;
    selected = saved.selected;
    draftPublished = creation ? false : vehicle.webPublished;
  }
  const draftKey = $derived(
    publicationDraftKey({
      description,
      transmission,
      selected,
      specs,
      galleryFraming: framing,
    }),
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
          vehicleSavedFeedback({
            title: vehicle.webPublished ? 'Publicação atualizada' : 'Viatura retirada do website',
            brand: vehicle.brand,
            model: vehicle.model,
            year: vehicle.year,
            detail: message,
            photo: cover,
            onlineUrl: publishedVehicleUrl(PUBLIC_WEBSITE_URL, vehicle),
          });
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
  <VehicleCharacteristics
    form={publicationFormId}
    disabled={disabled || pending}
    bind:transmission
    bind:specs
  />
{/snippet}

{#if managePhotos}
  {#if unified}
    <VehiclePhotoDraft
      {onDiscardPrepared}
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
          {framing}
          onframing={saveFraming}
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
          {#if creation}<p class="publication-status">
              Escolha uma das ações finais para guardar ou publicar.
            </p>{:else}<WebsiteStatus {vehicle} />{#if !websiteVisibility(vehicle).visible}<p
                class="publication-status"
              >
                {websiteVisibility(vehicle).detail}
              </p>{/if}{/if}
        </div>
        {#if websiteVisibility(vehicle).visible && vehicle.publicSlug}<a
            class="public-view-link"
            href={publicVehicleUrl(PUBLIC_WEBSITE_URL, vehicle.publicSlug)}
            target="_blank"
            rel="noopener noreferrer"
            ><span class="public-view-text">Ver ficha pública</span>
            <ArrowUpRight size={16} aria-hidden="true" /></a
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
          {#if unified}<input
              type="hidden"
              name="galleryFraming"
              value={JSON.stringify(
                Object.fromEntries(
                  Object.entries(framing).filter(([path]) => allowedPhotos.includes(path)),
                ),
              )}
            />{/if}
          <input type="hidden" name="operation" value="publish" />
          {#if unified}
            <input type="hidden" name="published" value={String(draftPublished)} />
          {/if}
          <h3 class="publication-group-title">Dados do anúncio</h3>
          <DescriptionEditor
            bind:value={description}
            disabled={disabled || pending}
            required={!creation && (!unified || draftPublished)}
          />
          {#if creation}<p class="note">
              <span class="required-marker" style="color:var(--color-red)" aria-hidden="true"
                >*</span
              > A descrição pública é obrigatória apenas para «Concluir e publicar». As características
              opcionais podem ficar vazias.
            </p>{/if}
          <p class="note">
            Visível no website. Não inclua notas internas, matrícula, VIN ou dados pessoais.
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
                {framing}
                onframing={saveFraming}
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
            <summary class="crm-text-disclosure">Pré-visualizar o anúncio</summary>
            <div class="preview-card">
              <div class="preview-cover">
                {#if cover}
                  <img
                    {...photoAttrs(cover, 800, '(max-width:700px) 90vw, 600px')}
                    use:reusablePhoto={{ photo: cover }}
                    style={framingStyle(framing[cover.path])}
                    use:photoFraming={{ framing: framing[cover.path] }}
                    loading="lazy"
                    alt={`${brand} ${model} — fotografia principal`}
                  />
                {:else}
                  <div class="preview-empty"><ImageOff size={24} aria-hidden="true" /> Imagem indisponível</div>
                {/if}
              </div>
              <div class="preview-overview">
                <h3>{brand}<br />{model}</h3>
                {#if specs.version}<p class="preview-version">{specs.version}</p>{/if}
                <p class="preview-price">
                  <span>Preço da viatura</span>
                  <strong>{price && numericPrice > 0 && !hiddenPrice
                    ? priceFormatter.format(numericPrice)
                    : 'Preço sob consulta'}</strong>
                </p>
                <dl class="preview-specs">
                  <div><dt>Ano</dt><dd>{year}</dd></div>
                  <div><dt>Quilómetros</dt><dd>{mileage == null ? 'Sob consulta' : formatInt(mileage)}</dd></div>
                  <div><dt>Combustível</dt><dd>{fuelLabels[fuel] ?? fuel}</dd></div>
                </dl>
              </div>
              {#if descriptionText(description)}
                <div class="preview-description"><RichDescription value={description} /></div>
              {/if}
            </div>
          </details>
          <div class="requirements" aria-live="polite">
            {#if !eligible}<p>
                Requer estado Disponível ou Reservado, sem venda registada.
              </p>{/if}{#if price && !(numericPrice > 0)}<p>
                O preço de venda deve ser superior a zero.
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
  .publication-editor {
    min-width: 0;
    scroll-margin-top: 190px;
  }
  @media (max-width: 600px) {
    .publication-editor {
      scroll-margin-top: 260px;
    }
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
    text-decoration: none;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 13px;
  }
  .public-view-text {
    position: relative;
    text-decoration: none;
    text-underline-offset: 4px;
  }
  .public-view-text::after {
    content: '';
    position: absolute;
    left: 0;
    bottom: 0;
    width: 0;
    height: 1px;
    background: currentColor;
    transition: width 420ms ease;
  }
  .public-view-link:is(:hover, :focus-visible) .public-view-text::after {
    width: 100%;
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
  input:not([type='checkbox']) {
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
    margin-block: 20px;
    border-block: 1px solid var(--color-border);
  }
  .publication-preview > summary {
    font-size: 13px;
  }
  .preview-card {
    display: grid;
    grid-template-columns: minmax(0, 1.65fr) minmax(0, 1fr);
    gap: 20px;
    align-items: start;
    margin-block: 6px 14px;
    padding: clamp(12px, 2.5vw, 24px);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-card);
    background: var(--color-bg-0);
    color: var(--color-text);
  }
  .preview-cover {
    position: relative;
    aspect-ratio: 1.5;
    max-height: 570px;
    overflow: hidden;
    border-radius: 12px;
    background: var(--color-bg-2);
  }
  .preview-cover img,
  .preview-empty {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
  }
  .preview-cover img {
    display: block;
    object-fit: cover;
    object-position: var(--photo-desktop, 50% 50%);
  }
  .preview-empty {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    color: var(--color-text-muted);
    font-size: 13px;
  }
  .preview-overview h3 {
    margin: 0;
    font-family: var(--font-display);
    font-size: clamp(24px, 3.2vw, 42px);
    font-weight: 800;
    line-height: 1;
    overflow-wrap: anywhere;
  }
  .preview-version {
    margin-top: 8px;
    color: var(--color-text-muted);
    font-size: 13px;
  }
  .preview-price {
    display: grid;
    gap: 3px;
    margin-top: 18px;
  }
  .preview-price span,
  .preview-specs dt {
    color: var(--color-text-muted);
    font-size: 11px;
  }
  .preview-price strong {
    font-family: var(--font-display);
    font-size: clamp(21px, 2.6vw, 35px);
    line-height: 1.2;
  }
  .preview-specs {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 8px;
    margin-top: 16px;
    padding-top: 12px;
    border-top: 1px solid var(--color-border);
  }
  .preview-specs > div {
    display: flex;
    flex-direction: column-reverse;
    gap: 2px;
    min-width: 0;
  }
  .preview-specs dd {
    font-size: 13px;
    font-weight: 600;
    overflow-wrap: anywhere;
  }
  .preview-description {
    grid-column: 1 / -1;
    padding-top: 14px;
    border-top: 1px solid var(--color-border);
    font-size: 13px;
    overflow-wrap: anywhere;
  }
  @media (max-width: 700px) {
    .preview-card {
      grid-template-columns: 1fr;
      gap: 14px;
    }
    .preview-cover {
      aspect-ratio: 1.3;
      max-height: 400px;
    }
    .preview-cover img {
      object-position: var(--photo-mobile, 50% 50%);
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
  :is(button, input, a):focus-visible {
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

  .public-view-link {
    align-self: center;
    align-items: center;
    min-height: 44px;
    padding-block: 0;
    gap: 8px;
  }
  .public-view-link:focus-visible :global(svg) {
    transform: translate(3px, -3px);
  }
  @media (hover: hover) {
    .public-view-link:hover :global(svg) {
      transform: translate(3px, -3px);
    }
  }
  @media (prefers-reduced-motion: no-preference) {
    .public-view-link :global(svg) {
      transition:
        transform 220ms ease,
        color 300ms ease;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .public-view-link :global(svg),
    .public-view-link:is(:hover, :focus-visible) :global(svg) {
      transition: none;
      transform: none;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .public-view-text::after {
      transition: none;
    }
  }
  .public-view-link :global(svg) {
    position: relative;
    top: -1px;
  }
</style>
