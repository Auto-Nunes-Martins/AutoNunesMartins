<script lang="ts">
  import { sessionFetch } from '$lib/auth/session';
  import { listNavigationCache } from '$lib/lists/navigationCache';
  import { crmPath } from '$lib/paths';
  import { onMount, onDestroy, tick, untrack } from 'svelte';
  import ConfirmDialog from '$lib/components/common/ConfirmDialog.svelte';
  import { afterNavigate, goto, invalidateAll } from '$app/navigation';
  import { vehicleEditReturn } from '$lib/vehicleEditReturn';
  import { toast } from 'svelte-sonner';
  import VehicleSaveProgress from '$lib/components/vehicle/VehicleSaveProgress.svelte';
  import { vehicleSavedFeedback } from '$lib/components/vehicle/vehicleSaveFeedback';
  import ItalicHero from '$lib/components/brand/ItalicHero.svelte';
  import Panel from '$lib/components/common/Panel.svelte';
  import WebsiteStatus from '$lib/components/vehicle/WebsiteStatus.svelte';
  import { websiteVisibility } from '$lib/websiteVisibility';
  import VehicleForm from '$lib/components/vehicle/VehicleForm.svelte';
  import VehicleDeletePanel from '$lib/components/vehicle/VehicleDeletePanel.svelte';
  import WebPublicationPanel from '$lib/components/vehicle/WebPublicationPanel.svelte';
  import { markFormSaved } from '$lib/forms/formFeedback';
  import {
    validateVehicleEdit,
    serverEditIssues,
    markEditIssues,
    focusEditIssue,
    clearEditIssueMarks,
    type EditIssue,
  } from '$lib/forms/vehicleEditErrors';
  import {
    publicDraftFromForm,
    publicEditKey,
    type EditPhoto,
  } from '$lib/components/vehicle/vehicleEditDraft';
  import type { VehicleDetailResponse } from '$lib/server/vehicles';
  import type { PageData } from './$types';
  let { data }: { data: PageData } = $props();
  let confirmationOpen = $state(false),
    confirmationMessage = $state(''),
    confirmationLabel = $state('Confirmar');
  let resolveConfirmation: ((value: boolean) => void) | undefined;
  function confirmEdit(message: string, label: string) {
    confirmationMessage = message;
    confirmationLabel = label;
    confirmationOpen = true;
    return new Promise<boolean>((resolve) => {
      resolveConfirmation = resolve;
    });
  }
  function answerConfirmation(value: boolean) {
    const resolve = resolveConfirmation;
    resolveConfirmation = undefined;
    confirmationOpen = false;
    resolve?.(value);
  }
  onDestroy(() => answerConfirmation(false));
  let root: HTMLElement;
  const publicationEditorId = $props.id();
  let savePhase = $state(0), preparedPhotos = $state(0), photoTotal = $state(0);
  let deleting = $state(false);
  let publicationIntent = $state<boolean | undefined>();
  const v = $derived(data.vehicle);
  let returnDestination = untrack(() => crmPath(`/viaturas/${data.vehicle.id}`));
  afterNavigate(({ from, to }) => {
    if (to && from?.url.pathname !== to.url.pathname)
      returnDestination = vehicleEditReturn(data.vehicle.id, to.url, from?.url);
  });
  let baseline = $state<VehicleDetailResponse>(
    untrack(() => JSON.parse(JSON.stringify(data.vehicle))),
  );
  let photoDraft = $state<EditPhoto[]>(initialPhotos());
  let revision = $state(0),
    saving = $state(false),
    needsReload = $state(false);
  let internalDirty = $state(false),
    publicDirty = $state(false),
    internalValid = $state(false),
    publicValid = $state(false);
  let message = $state(''),
    progress = $state('');
  let initialPublicKey = '';
  let editIssues = $state<EditIssue[]>([]);
  function editChanged(event: Event) {
    const field = event.target as HTMLInputElement;
    const name = field?.name || field?.dataset?.errorField;
    if (name) {
      const hadErrors = editIssues.length > 0;
      clearEditIssueMarks(root, [name]);
      editIssues = editIssues.filter((issue) => issue.key !== name);
      if (hadErrors && !editIssues.length) message = '';
    }
  }
  const photoDirty = $derived(
    JSON.stringify(photoDraft.map((photo) => photo.path)) !== JSON.stringify(baseline.photos),
  );
  const dirty = $derived(internalDirty || publicDirty || photoDirty);
  const removedCount = $derived(
    baseline.photos.filter((path) => !photoDraft.some((photo) => photo.path === path)).length,
  );
  function initialPhotos(): EditPhoto[] {
    return data.vehicle.photos.map((path) => ({
      path,
      url: data.signedPhotos.find((photo) => photo.path === path)?.url ?? '',
    }));
  }
  function forms() {
    return {
      internal: root?.querySelector<HTMLFormElement>('form[data-edit-vehicle]'),
      publication: root?.querySelector<HTMLFormElement>('form[data-edit-publication]'),
    };
  }
  function initial(vehicle: VehicleDetailResponse) {
    return {
      ...vehicle,
      salePrice: vehicle.sale?.salePrice ?? vehicle.salePrice ?? '',
      licensePlate: vehicle.licensePlate ?? '',
      acquisitionDate: vehicle.acquisitionDate.slice(0, 10),
      description: vehicle.description ?? '',
    };
  }
  function publicChanged(state: { dirty: boolean; valid: boolean }) {
    publicValid = state.valid;
    const form = forms().publication;
    if (!saving && form && initialPublicKey)
      publicDirty = publicEditKey(publicDraftFromForm(new FormData(form))) !== initialPublicKey;
  }
  async function rememberSavedForms() {
    await tick();
    await tick();
    const current = forms();
    if (current.publication) {
      initialPublicKey = publicEditKey(publicDraftFromForm(new FormData(current.publication)));
      markFormSaved(current.publication);
    }
    if (current.internal) markFormSaved(current.internal);
    internalDirty = false;
    publicDirty = false;
  }
  onMount(() => {
    void rememberSavedForms();
  });
  async function freshState() {
    const response = await sessionFetch(crmPath(`/viaturas/${baseline.id}/editar/save`), {
      cache: 'no-store',
    });
    if (!response.ok)
      throw new Error(
        'Não foi possível confirmar a versão atual da viatura. O rascunho foi mantido.',
      );
    return (await response.json()) as Pick<PageData, 'vehicle' | 'signedPhotos'>;
  }
  async function saveAll(published?: boolean) {
    const changingPublication = published !== undefined && published !== baseline.webPublished;
    if (saving || deleting || needsReload || confirmationOpen || (!dirty && !changingPublication)) return;
    const current = forms();
    if (!current.internal || !current.publication) return;
    const internal = new FormData(current.internal),
      publication = publicDraftFromForm(new FormData(current.publication));
    if (published !== undefined) publication.published = published;
    const get = (key: string) => String(internal.get(key) ?? '');
    const details = {
      brand: get('brand'),
      model: get('model'),
      year: get('year'),
      fuel: get('fuel'),
      mileage: get('mileage'),
      vin: get('vin').toUpperCase(),
      licensePlate: get('licensePlate') || null,
      purchasePrice: get('purchasePrice'),
      ...(get('salePrice') ? { salePrice: get('salePrice') } : {}),
      status: get('status'),
      acquisitionDate: get('acquisitionDate'),
      description: get('description'),
      pendingDocFlags: Object.fromEntries(
        ['financing', 'imt', 'registration', 'docs'].map((key) => [
          key,
          internal.get('pendingDocFlags.' + key) === 'true',
        ]),
      ),
    };
    const principal = root.querySelector<HTMLElement>('.photo-card.is-cover')?.dataset.photoPath;
    const orderedPhotos = principal
      ? [principal, ...photoDraft.map((photo) => photo.path).filter((path) => path !== principal)]
      : photoDraft.map((photo) => photo.path);
    editIssues = validateVehicleEdit(
      root,
      details,
      publication,
      orderedPhotos,
      !!baseline.sale || !!baseline.soldDate,
    );
    markEditIssues(root, editIssues);
    if (editIssues.length) {
      message = 'Corrija os pontos indicados. O rascunho foi mantido.';
      return;
    }
    const warnings: string[] = [];
    if (publication.published && !orderedPhotos.length)
      warnings.push('Publicar sem fotografia? O site mostrará «Imagem indisponível».');
    if (removedCount)
      warnings.push(
        `Eliminar ${removedCount} fotografia(s) ao guardar? Também deixam de estar disponíveis no site.`,
      );
    if (
      warnings.length &&
      !(await confirmEdit(warnings.join(' '), 'Confirmar e guardar alterações'))
    )
      return;
    saving = true;
    publicationIntent = published;
    savePhase = 0; preparedPhotos = 0; photoTotal = 0;
    await tick();
    root.querySelector<HTMLElement>('[data-save-progress]')?.scrollIntoView({ block: 'nearest' });
    const publishing = (publicDirty || changingPublication) && publication.published;
    const removing = changingPublication && !publication.published;
    const previouslyPublished = baseline.webPublished;
    message = '';
    let committed = false,
      confirmed = false,
      saveRequestStarted = false,
      saveResponseReceived = false,
      uncertainResult = false;
    try {
      const latest = await freshState();
      if (latest.vehicle.updatedAt !== baseline.updatedAt)
        throw new Error(
          'A viatura foi alterada entretanto. O rascunho foi mantido. Atualize a ficha e reveja as alterações antes de guardar.',
        );
      const files = photoDraft.filter((photo) => photo.file);
      photoTotal = files.length; preparedPhotos = files.filter(photo => photo.uploadedPath).length;
      if (files.length) savePhase = 1;
      for (const [index, photo] of files.entries()) {
        if (photo.uploadedPath) continue;
        progress = `A preparar fotografia ${index + 1} de ${files.length}…`;
        const response = await sessionFetch(crmPath(`/viaturas/${baseline.id}/photos`), {
          method: 'POST',
          headers: {
            'content-type': photo.file!.type,
            'x-upload-id': photo.uploadId!,
            'x-edit-stage': 'true',
          },
          body: photo.file,
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok || !result.path) {
          editIssues = [
            {
              key: 'photos',
              photoPath: photo.path,
              message: `Fotografias: ${result.error ?? 'Não foi possível preparar este ficheiro.'} Remova-o ou escolha outro ficheiro e tente novamente.`,
            },
          ];
          throw new Error(editIssues[0]!.message);
        }
        photo.uploadedPath = result.path;
        preparedPhotos += 1;
      }
      const resolvePath = (path: string) =>
        photoDraft.find((photo) => photo.path === path)?.uploadedPath ?? path;
      const { photoPaths: _legacyPhotoPaths, ...publicationData } = publication;
      savePhase = 2;
      progress = 'A guardar todas as alterações…';
      saveRequestStarted = true;
      const response = await sessionFetch(crmPath(`/viaturas/${baseline.id}/editar/save`), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          expectedUpdatedAt: baseline.updatedAt,
          data: details,
          photos: orderedPhotos.map(resolvePath),
          uploadedPhotos: files.map((photo) => photo.uploadedPath!),
          ...((publicDirty || changingPublication) ? { publication: publicationData } : {}),
        }),
      });
      saveResponseReceived = true;
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        uncertainResult = Boolean(result.outcomeUnknown) || response.status >= 500;
        editIssues = serverEditIssues(result);
        throw new Error(
          editIssues[0]?.message ??
            result.error ??
            'Não foi possível guardar. O rascunho foi mantido.',
        );
      }
      committed = true;
      listNavigationCache.clear();
      const saved = await freshState();
      data = { ...data, ...saved };
      baseline = JSON.parse(JSON.stringify(saved.vehicle));
      photoDraft = initialPhotos();
      revision += 1;
      await invalidateAll().catch(() => {});
      message = removing ? 'Viatura retirada do website. Alterações guardadas.' : publishing ? 'Viatura publicada no website. Alterações guardadas.' : 'Alterações guardadas.';
      vehicleSavedFeedback({ title: removing ? 'Viatura retirada do website' : publishing ? (previouslyPublished ? 'Publicação atualizada' : 'Viatura publicada') : 'Alterações guardadas',
        brand: saved.vehicle.brand, model: saved.vehicle.model, year: saved.vehicle.year,
        detail: removing ? 'A ficha deixou de estar visível no website.' : publishing ? 'O website já reflete as alterações confirmadas.' : 'A ficha da viatura foi atualizada no CRM.',
        photo: saved.signedPhotos.find(photo => photo.path === saved.vehicle.photos[0]),
      });
      confirmed = true;
    } catch (error) {
      message =
        error instanceof Error
          ? error.message
          : 'Não foi possível guardar. O rascunho foi mantido.';
      if (committed) {
        needsReload = true;
        message =
          'As alterações foram guardadas, mas não foi possível atualizar a ficha. Recarregue a página para continuar.';
      } else if (uncertainResult || (saveRequestStarted && !saveResponseReceived)) {
        needsReload = true;
        message =
          'A ligação foi interrompida durante a gravação. Não foi possível confirmar o resultado. Recarregue a ficha e confirme os dados antes de voltar a editar; o rascunho continua visível nesta página.';
      } else if (photoDraft.some((photo) => photo.uploadedPath))
        message +=
          ' Os ficheiros preparados continuam privados e serão reutilizados ao tentar novamente; não foram associados à viatura nem publicados.';
      toast.error(message);
    } finally {
      saving = false;
      publicationIntent = undefined;
      progress = '';
      await tick();
      if (editIssues.length) markEditIssues(root, editIssues);
      if (committed) await rememberSavedForms();
    }
    // Publication controls save in place; only the explicit Save action returns.
    if (confirmed && published === undefined) {
      try { await goto(returnDestination, { invalidateAll: true }); }
      catch { toast.error('As alterações foram guardadas, mas não foi possível abrir a página anterior.'); }
    }
  }
  async function discard() {
    if (confirmationOpen || saving) return;
    if (
      dirty &&
      !(await confirmEdit(
        'Descartar todas as alterações por guardar? Os dados já guardados mantêm-se.',
        'Descartar alterações',
      ))
    )
      return;
    const current = forms();
    if (current.internal) markFormSaved(current.internal);
    if (current.publication) markFormSaved(current.publication);
    window.location.assign(crmPath(`/viaturas/${baseline.id}`));
  }
</script>

<svelte:head
  ><title>Editar {data.vehicle.brand} {data.vehicle.model} · Auto Nunes Martins</title></svelte:head
>
<section
  class="vehicle-edit-page pt-8 pb-12 space-y-6"
  bind:this={root}
  oninput={editChanged}
>
  <div>
    <a class="edit-back" href={crmPath(`/viaturas/${data.vehicle.id}`)}
      >← Voltar à ficha da viatura</a
    ><ItalicHero text="Editar" accent=" {data.vehicle.brand} {data.vehicle.model}" size="lg" />
    <p class="edit-note">
      Edite a ficha e as fotografias. As escolhas de publicação no website também são aplicadas ao guardar.
    </p>
  </div>
  <div id="vehicle-edit-actions" class="edit-save edit-save-top">
    <div class="edit-state">
      <p role="status">{saving ? progress || 'A guardar…' : needsReload ? 'Recarregue a ficha para continuar.' : dirty ? `Alterações por guardar${removedCount ? ` · ${removedCount} fotografia(s) por eliminar` : ''}` : 'Sem alterações por guardar'}</p>
      {#if needsReload}<span class="publication-state publication-unknown">Publicação por confirmar · recarregue a ficha.</span>{:else}<WebsiteStatus vehicle={baseline} />{/if}
      {#if websiteVisibility(baseline).state === 'blocked'}<span class="publication-state publication-warning">{websiteVisibility(baseline).detail}</span>{/if}
    </div>
    <div class="edit-actions">
      <button type="button" class="publication-action" data-error-field="published" disabled={saving || deleting || needsReload} onclick={() => void saveAll(!baseline.webPublished)}>{saving && publicationIntent !== undefined ? (publicationIntent ? 'A publicar…' : 'A retirar…') : baseline.webPublished ? (dirty ? 'Guardar e retirar do website' : 'Retirar do website') : (dirty ? 'Guardar e publicar no website' : 'Publicar no website')}</button>
      <button type="button" disabled={saving || deleting} onclick={discard}>Cancelar e voltar</button>
      <button type="button" class="primary" disabled={saving || deleting || needsReload || !dirty} onclick={() => void saveAll()}>{saving ? 'A guardar…' : 'Guardar alterações'}</button>
    </div>
  </div>
  {#if saving}<VehicleSaveProgress phase={savePhase} completed={preparedPhotos} total={photoTotal} label={progress || 'A guardar as alterações…'} />{/if}
  {#if editIssues.length}<div class="edit-errors" role="alert">
      <strong>Não foi possível guardar. Corrija os seguintes pontos:</strong>
      <ul>
        {#each editIssues as issue}<li>
            <button type="button" onclick={() => focusEditIssue(root, issue)}
              >{issue.message}</button
            >
          </li>{/each}
      </ul>
      <p>Os dados e as fotografias continuam no rascunho.</p>
    </div>{/if}
  {#key revision}
    {@const values = initial(data.vehicle)}
    <WebPublicationPanel
      editorId={publicationEditorId}
      unified
      managePhotos
      vehicle={data.vehicle}
      photos={data.signedPhotos}
      bind:photoDraft
      disabled={saving || deleting || needsReload}
      onsaveall={() => void saveAll()}
      onstatechange={publicChanged}
    >
      {#snippet vehicleDetails(characteristics)}
        <Panel
          ><div class="p-6">
            <VehicleForm
              initial={values}
              {characteristics}
              saleRecorded={!!data.vehicle.sale}
              unified
              disabled={saving || deleting || needsReload}
              onsaveall={() => void saveAll()}
              onstatechange={(state) => {
                internalDirty = state.dirty;
                internalValid = state.valid;
              }}
            ></VehicleForm>
            {#if data.vehicle.sale}<p class="edit-note">
                A informação da viatura continua editável após a venda. Para alterar a entrega ou
                devolver a viatura ao stock, <a
                  class="underline"
                  href={crmPath(`/vendas/${data.vehicle.sale.id}`)}>abra a venda registada</a
                >.
              </p>{/if}
          </div></Panel
        >
      {/snippet}
    </WebPublicationPanel>
  {/key}
  {#if message}<p class="edit-message" role={needsReload || dirty ? 'alert' : 'status'}>
      {message}
    </p>{/if}
  <div class="edit-save">
    <p role="status">
      {saving
        ? progress || 'A guardar…'
        : needsReload
          ? 'Recarregue a ficha para continuar.'
          : dirty
            ? `Alterações por guardar${removedCount ? ` · ${removedCount} fotografia(s) por eliminar` : ''}.`
            : 'Sem alterações por guardar.'}
    </p>
    <div>
      <a class="edit-top-link" href="#vehicle-edit-actions">Voltar às ações do topo ↑</a><button
        type="button"
        class="primary"
        disabled={saving || deleting || needsReload || !dirty}
        onclick={() => void saveAll()}>{saving ? 'A guardar…' : 'Guardar alterações'}</button
      >
    </div>
  </div>
  <VehicleDeletePanel
    id={v.id}
    brand={v.brand}
    model={v.model}
    blocked={!!v.sale}
    disabled={saving || needsReload}
    bind:busy={deleting}
    onredirect={() => {
      const current = forms();
      if (current.internal) markFormSaved(current.internal);
      if (current.publication) markFormSaved(current.publication);
    }}
  />
</section>

<ConfirmDialog
  bind:open={confirmationOpen}
  title="Confirmar alteração"
  message={confirmationMessage}
  confirmLabel={confirmationLabel}
  cancelLabel="Continuar a editar"
  onconfirm={() => answerConfirmation(true)}
  oncancel={() => answerConfirmation(false)}
/>

<style>
  .vehicle-edit-page {
    width: 100%;
    max-width: 1480px;
    margin-inline: auto;
    min-width: 0;
  }
  .edit-save.edit-save-top { display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:10px 16px;position: sticky; top: 76px; z-index: 15; background: var(--color-bg-elevated); box-shadow: 0 6px 18px #0001; scroll-margin-top: 88px; flex-wrap: wrap; }
  .edit-save-top .edit-state {display:contents;}
  .edit-save-top .edit-state > p {grid-column:1 / -1;grid-row:1;}
  .edit-save-top .edit-state > :global(.website-status), .edit-save-top .publication-unknown {grid-column:1;grid-row:2;justify-self:start;max-width:100%;min-width:0;min-height:44px;box-sizing:border-box;display:inline-flex;align-items:center;}
  .edit-save-top .publication-warning {grid-column:1 / -1;grid-row:3;}
  .edit-save-top .edit-actions {grid-column:2;grid-row:2;align-items:stretch;}
  @media (max-width:900px) {
    .edit-save.edit-save-top {grid-template-columns:minmax(0,1fr);}
    .edit-save-top .edit-state > p, .edit-save-top .edit-state > :global(.website-status), .edit-save-top .publication-unknown, .edit-save-top .publication-warning, .edit-save-top .edit-actions {grid-column:1;grid-row:auto;}
    .edit-save-top .edit-state > :global(.website-status), .edit-save-top .publication-unknown {justify-self:stretch;}
    .edit-save-top .edit-actions {display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);}
    .edit-save-top .publication-action {grid-column:1 / -1;}
    .edit-save-top button {width:100%;}
  }
  .publication-state {font-size: 12px;color: var(--color-text-muted);}
  .edit-actions {flex-shrink: 0;}
  .publication-action {font-weight: 600;border-color: var(--color-red);}
  .edit-top-link {display: inline-flex;align-items: center;min-height: 44px;font-size: 13px;color: var(--color-text-muted);}
  .edit-errors {
    padding: 16px;
    border: 1px solid var(--color-warning);
    border-radius: 6px;
    font-size: 13px;
    line-height: 1.6;
  }
  .edit-errors ul {
    list-style: disc;
    padding-left: 20px;
    margin-block: 8px;
  }
  .edit-errors button {
    text-align: left;
    border: 0;
    min-height: 44px;
    padding: 6px 0;
    color: var(--color-text);
    text-decoration: underline;
    text-underline-offset: 3px;
  }
  .edit-errors p {
    color: var(--color-text-muted);
  }
  .edit-back {
    display: inline-flex;
    align-items: center;
    min-height: 44px;
    color: var(--color-text-muted);
    font-size: 13px;
    text-decoration: none;
    margin-bottom: 12px;
  }
  .edit-back:hover {
    color: var(--color-text);
  }
  .edit-note,
  .edit-message,
  .edit-save p {
    font-size: 13px;
    line-height: 1.6;
    color: var(--color-text-muted);
  }
  .edit-message {
    border: 1px solid var(--color-border);
    border-radius: 6px;
    padding: 14px;
  }
  .edit-save {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 16px;
    padding: 18px;
    background: var(--color-bg-1);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-card);
  }
  .edit-save > div {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
  }
  button {
    min-height: 44px;
    padding: 10px 18px;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-btn);
    font-size: 13px;
    cursor: pointer;
  }
  button.primary {
    background: var(--color-red);
    color: white;
    border-color: var(--color-red);
  }
  button:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }
  a:focus-visible,
  button:focus-visible {
    outline: 2px solid var(--color-red);
    outline-offset: 3px;
  }
  @media (max-width: 600px) {
    .edit-save {
      align-items: stretch;
      flex-direction: column;
    }
    .edit-save > div {
      display: grid;
      grid-template-columns: 1fr 1fr;
    }
    .edit-save-top .edit-actions {display: grid;grid-template-columns: 1fr 1fr;}
    .edit-save-top .publication-action {grid-column: 1 / -1;}
    .edit-save-top button { width: 100%; }
  }
</style>
