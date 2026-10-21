<script lang="ts">
  import { crmPath } from '$lib/paths';
  import { onMount, tick, untrack } from 'svelte';
  import { invalidateAll } from '$app/navigation';
  import { toast } from 'svelte-sonner';
  import ItalicHero from '$lib/components/brand/ItalicHero.svelte';
  import Panel from '$lib/components/common/Panel.svelte';
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
  let root: HTMLElement;
  let deleting = $state(false);
  const v = $derived(data.vehicle);
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
    void refreshPhotoIssue();
  }
  async function refreshPhotoIssue() {
    await tick();
    if (!editIssues.some((issue) => issue.key === 'photoPrincipal')) return;
    const form = forms().publication;
    if (!form) return;
    const pub = publicDraftFromForm(new FormData(form)),
      principal = root.querySelector<HTMLElement>('.photo-card.is-cover')?.dataset.photoPath;
    if (!pub.published || !photoDraft.length || (principal && pub.photoPaths.includes(principal))) {
      clearEditIssueMarks(root, ['photoPrincipal']);
      editIssues = editIssues.filter((issue) => issue.key !== 'photoPrincipal');
      if (!editIssues.length) message = '';
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
    void refreshPhotoIssue();
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
    const response = await fetch(crmPath(`/viaturas/${baseline.id}/editar/save`), {
      cache: 'no-store',
    });
    if (!response.ok)
      throw new Error(
        'Não foi possível confirmar a versão atual da viatura. O rascunho foi mantido.',
      );
    return (await response.json()) as Pick<PageData, 'vehicle' | 'signedPhotos'>;
  }
  async function saveAll() {
    if (saving || deleting || needsReload || !dirty) return;
    const current = forms();
    if (!current.internal || !current.publication) return;
    const internal = new FormData(current.internal),
      publication = publicDraftFromForm(new FormData(current.publication));
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
      principal,
      !!baseline.sale || !!baseline.soldDate,
    );
    markEditIssues(root, editIssues);
    if (editIssues.length) {
      message = 'Corrija os pontos indicados. O rascunho foi mantido.';
      return;
    }
    if (
      publication.published &&
      !orderedPhotos.length &&
      !window.confirm('Publicar sem fotografia? O site mostrará «Imagem indisponível».')
    )
      return;
    if (
      removedCount &&
      !window.confirm(
        `Eliminar ${removedCount} fotografia(s) ao guardar? Também deixam de estar disponíveis no site.`,
      )
    )
      return;
    saving = true;
    message = '';
    let committed = false,
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
      for (const [index, photo] of files.entries()) {
        if (photo.uploadedPath) continue;
        progress = `A preparar fotografia ${index + 1} de ${files.length}…`;
        const response = await fetch(crmPath(`/viaturas/${baseline.id}/photos`), {
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
      }
      const resolvePath = (path: string) =>
        photoDraft.find((photo) => photo.path === path)?.uploadedPath ?? path;
      publication.photoPaths = publication.photoPaths.map(resolvePath);
      progress = 'A guardar todas as alterações…';
      saveRequestStarted = true;
      const response = await fetch(crmPath(`/viaturas/${baseline.id}/editar/save`), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          expectedUpdatedAt: baseline.updatedAt,
          data: details,
          photos: orderedPhotos.map(resolvePath),
          uploadedPhotos: files.map((photo) => photo.uploadedPath!),
          ...(publicDirty ? { publication } : {}),
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
      const saved = await freshState();
      data = { ...data, ...saved };
      baseline = JSON.parse(JSON.stringify(saved.vehicle));
      photoDraft = initialPhotos();
      revision += 1;
      await invalidateAll().catch(() => {});
      message =
        'Todas as alterações foram guardadas. As fotografias só estão públicas de acordo com a seleção confirmada.';
      toast.success('Alterações guardadas.');
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
      progress = '';
      await tick();
      if (editIssues.length) markEditIssues(root, editIssues);
      if (committed) await rememberSavedForms();
    }
  }
  function discard() {
    if (dirty && !window.confirm('Descartar todas as alterações por guardar?')) return;
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
  onchange={() => void refreshPhotoIssue()}
>
  <div>
    <a class="edit-back" href={crmPath(`/viaturas/${data.vehicle.id}`)}
      >← Voltar à ficha da viatura</a
    ><ItalicHero text="Editar" accent=" {data.vehicle.brand} {data.vehicle.model}" size="lg" />
    <p class="edit-note">
      Um único botão guarda os dados, as fotografias e as escolhas de publicação. Nenhuma alteração
      desta edição é aplicada antes de guardar.
    </p>
  </div>
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
      <button type="button" disabled={saving} onclick={discard}>Cancelar e voltar</button><button
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

<style>
  .vehicle-edit-page {
    width: 100%;
    max-width: 1480px;
    margin-inline: auto;
    min-width: 0;
  }
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
  }
</style>
