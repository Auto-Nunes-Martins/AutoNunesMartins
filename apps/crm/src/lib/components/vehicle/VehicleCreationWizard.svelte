<script lang="ts">
  import { readyPhoto } from '$lib/photoPreparation';
  import { onMount, tick, untrack, type ComponentProps } from 'svelte';
  import { goto } from '$app/navigation';
  import { toast } from 'svelte-sonner';
  import VehicleSaveProgress from './VehicleSaveProgress.svelte';
  import { vehicleSavedFeedback } from './vehicleSaveFeedback';
  import { crmPath } from '$lib/paths';
  import { sessionFetch } from '$lib/auth/session';
  import { listNavigationCache } from '$lib/lists/navigationCache';
  import { markFormSaved } from '$lib/forms/formFeedback';
  import { automaticDraft, draftStorage, registerDraftGuard } from '$lib/forms/automaticDraft';
  import {
    validateVehicleEdit,
    serverEditIssues,
    markEditIssues,
    focusEditIssue,
    clearEditIssueMarks,
    type EditIssue,
  } from '$lib/forms/vehicleEditErrors';
  import type { VehicleDetailResponse } from '$lib/server/vehicles';
  import type { SignedVariantPhoto } from '$lib/vehicleImage';
  import { publicDraftFromForm, type EditPhoto } from './vehicleEditDraft';
  import {
    creationDetailsIssues,
    creationStatus,
    internalVehicleFields,
    vehicleDetailsFromForm,
    type CreationAction,
  } from './creationFlow';
  import WebPublicationPanel from './WebPublicationPanel.svelte';
  import VehicleForm from './VehicleForm.svelte';
  import Panel from '$lib/components/common/Panel.svelte';
  import ConfirmDialog from '$lib/components/common/ConfirmDialog.svelte';

  let {
    vehicle,
    photos,
    intendedStatus = 'AVAILABLE',
    draftOwner,
  }: {
    vehicle: VehicleDetailResponse;
    photos: SignedVariantPhoto[];
    intendedStatus?: 'AVAILABLE' | 'RESERVED' | 'DOCS_PENDING';
    draftOwner: string | null;
  } = $props();
  const baseline = untrack(() => JSON.parse(JSON.stringify(vehicle)) as VehicleDetailResponse);
  let initial = $state<NonNullable<ComponentProps<typeof VehicleForm>['initial']>>(untrack(() => ({
    ...vehicle,
    status: intendedStatus,
    salePrice: vehicle.salePrice ?? '',
    licensePlate: vehicle.licensePlate ?? '',
    description: vehicle.description ?? '',
    acquisitionDate: vehicle.acquisitionDate.slice(0, 10),
  })));
  let ready = $state(false);
  let savePhase = $state(0), preparedPhotos = $state(0), photoTotal = $state(0);
  let draftState = $state('');
  let recoveredPublication = $state<ReturnType<typeof publicDraftFromForm> | undefined>();
  let autosave: ReturnType<typeof automaticDraft<Recovery>> | undefined;
  let unregister: (() => void) | undefined;
  const recoveryKey = untrack(() => `vehicle:${draftOwner}:${baseline.id}`);
  type Recovery = {
    baseUpdatedAt: string;
    details: ReturnType<typeof vehicleDetailsFromForm>;
    publication: ReturnType<typeof publicDraftFromForm>;
    step: number;
    photos: { path: string; file?: File; preparedFile?: File; uploadId?: string; uploadedPath?: string }[];
  };
  function captureRecovery(): Recovery {
    const draft = snapshot('draft')!;
    return { baseUpdatedAt: baseline.updatedAt, details: draft.details, publication: draft.publication,
      step, photos: draft.paths.map(path => {
        const photo = photoDraft.find(item => item.path === path)!;
        return { path, file: photo.file, preparedFile: photo.preparedFile, uploadId: photo.uploadId, uploadedPath: photo.uploadedPath };
      }) };
  }
  function protectForms() {
    for (const form of Object.values(forms())) if (form) markFormSaved(form, { preserveErrors: true });
  }
  let photoDraft = $state<EditPhoto[]>(
    untrack(() =>
      vehicle.photos.map((path) => {
        const photo = photos.find((candidate) => candidate.path === path);
        return { ...photo, path, url: photo?.url ?? '' };
      }),
    ),
  );
  let step = $state(2),
    saving = $state(false),
    needsReload = $state(false);
  let root: HTMLElement;
  let issues = $state<EditIssue[]>([]),
    crmIssues = $state<EditIssue[]>([]),
    publishIssues = $state<EditIssue[]>([]);
  let message = $state(''),
    progress = $state(''),
    confirmNoPhoto = $state(false);
  const endpoint = crmPath(`/viaturas/${baseline.id}/editar/save`);
  function forms() {
    return {
      internal: root?.querySelector<HTMLFormElement>('form[data-edit-vehicle]'),
      publication: root?.querySelector<HTMLFormElement>('form[data-edit-publication]'),
    };
  }
  function snapshot(action: CreationAction) {
    const current = forms();
    if (!current.internal || !current.publication) return;
    const details = vehicleDetailsFromForm(new FormData(current.internal));
    const publication = publicDraftFromForm(new FormData(current.publication));
    publication.published = action === 'publish';
    const principal = root.querySelector<HTMLElement>('.photo-card.is-cover')?.dataset.photoPath;
    const paths = principal
      ? [principal, ...photoDraft.map((photo) => photo.path).filter((path) => path !== principal)]
      : photoDraft.map((photo) => photo.path);
    const errors = [
      ...creationDetailsIssues(details),
      ...validateVehicleEdit(
        root,
        details,
        publication,
        paths,
        !!baseline.sale || !!baseline.soldDate,
      ),
    ];
    return {
      details,
      publication,
      paths,
      errors: errors.filter(
        (issue, index) => errors.findIndex((other) => other.key === issue.key) === index,
      ),
    };
  }
  async function refresh() {
    await tick();
    if (saving || needsReload || !root?.isConnected) return;
    crmIssues = snapshot('crm')?.errors ?? [];
    publishIssues = snapshot('publish')?.errors ?? [];
    if (!publishIssues.some((issue) => issue.key === 'photoPrincipal')) {
      clearEditIssueMarks(root, ['photoPrincipal']);
      issues = issues.filter((issue) => issue.key !== 'photoPrincipal');
    }
    autosave?.update();
  }
  function changed(event: Event) {
    const field = event.target as HTMLInputElement;
    const key = field.name || field.dataset?.errorField;
    if (key) {
      clearEditIssueMarks(root, [key]);
      issues = issues.filter((issue) => issue.key !== key);
    }
    void refresh();
  }
  onMount(() => {
    let disposed = false;
    const urls: string[] = [];
    void (async () => {
      try {
        if (!draftOwner) throw Error('Sessão indisponível.');
        const saved = await draftStorage.read<Recovery>(recoveryKey);
        if (disposed) return;
        if (saved && saved.baseUpdatedAt === baseline.updatedAt) {
          const details = saved.details;
          initial = { ...initial, ...details, year: details.year ? Number(details.year) : null,
            mileage: details.mileage ? Number(details.mileage) : null,
            fuel: details.fuel as typeof initial.fuel, status: details.status as typeof initial.status,
            licensePlate: details.licensePlate ?? '', salePrice: details.salePrice ?? '',
            pendingDocFlags: { financing: !!details.pendingDocFlags.financing, imt: !!details.pendingDocFlags.imt,
              registration: !!details.pendingDocFlags.registration, docs: !!details.pendingDocFlags.docs } };
          recoveredPublication = saved.publication;
          step = saved.step;
          photoDraft = saved.photos.map(photo => {
            const signed = photos.find(item => item.path === photo.path);
            const localFile = photo.preparedFile ?? photo.file;
            const url = localFile ? URL.createObjectURL(localFile) : signed?.url ?? '';
            if (localFile) urls.push(url);
            return { ...signed, ...photo, url };
          });
          draftState = 'Rascunho recuperado neste dispositivo';
        } else if (saved) {
          message = 'A ficha foi alterada desde o rascunho anterior. Mantivemos a versão atual do CRM.';
        }
      } catch { draftState = 'Não foi possível aceder ao rascunho automático'; }
      if (disposed) return;
      ready = true;
      await tick();
      await refresh();
      autosave = automaticDraft({ capture: captureRecovery,
        persist: value => draftOwner ? draftStorage.write(recoveryKey, value) : Promise.reject(Error('Sessão indisponível.')),
        remove: () => draftStorage.remove(recoveryKey), protected: protectForms,
        state: value => { draftState = value === 'saved' ? 'Rascunho guardado neste dispositivo' : value === 'saving' ? 'A guardar rascunho…' : 'Não foi possível guardar o rascunho'; },
      });
      protectForms();
      unregister = registerDraftGuard({ flush: autosave.flush, discard: autosave.abandon, resume: autosave.resume });
    })();
    return () => { disposed = true; unregister?.(); autosave?.dispose(); urls.forEach(url => URL.revokeObjectURL(url)); };
  });
  async function changeStep(next: number) {
    if (saving || needsReload) return;
    if (next === 2) {
      const draft = snapshot('crm');
      const errors = draft?.errors.filter((issue) => internalVehicleFields.has(issue.key)) ?? [];
      if (errors.length) {
        await showIssues(errors);
        return;
      }
    }
    step = next;
    await tick();
    autosave?.update();
    root.querySelector<HTMLElement>('[data-step-heading]')?.focus();
  }
  async function showIssues(next: EditIssue[]) {
    issues = next;
    if (next.some((issue) => internalVehicleFields.has(issue.key))) step = 1;
    else step = 2;
    await tick();
    markEditIssues(root, next);
    root.querySelector<HTMLElement>('.creation-errors')?.focus();
  }
  async function visitIssue(issue: EditIssue) {
    step = internalVehicleFields.has(issue.key) ? 1 : 2;
    await tick();
    focusEditIssue(root, issue);
  }
  async function save(action: CreationAction, confirmed = false) {
    if (saving || needsReload) return;
    await tick();
    const draft = snapshot(action);
    if (!draft) return;
    if (draft.errors.length) {
      await showIssues(draft.errors);
      toast.error('Reveja os campos assinalados.');
      return;
    }
    if (action === 'publish' && !draft.publication.photoPaths.length && !confirmed) {
      confirmNoPhoto = true;
      return;
    }
    confirmNoPhoto = false;
    // Preserve the editable state before locking controls or making network requests.
    try { await autosave?.flush(); } catch { /* explicit final save can still succeed */ }
    clearEditIssueMarks(root);
    issues = [];
    message = '';
    saving = true;
    savePhase = 0; preparedPhotos = 0; photoTotal = 0;
    await tick();
    root.querySelector<HTMLElement>('[data-save-progress]')?.scrollIntoView({ block: 'start', behavior: 'instant' });
    let sent = false,
      responded = false,
      committed = false;
    try {
      const fresh = await sessionFetch(endpoint, { cache: 'no-store' });
      if (!fresh.ok)
        throw Error('Não foi possível confirmar a ficha. As alterações continuam neste ecrã.');
      const state = await fresh.json();
      if (state.vehicle.updatedAt !== baseline.updatedAt) {
        needsReload = true;
        throw Error(
          'A ficha foi alterada entretanto. Mantivemos o rascunho neste ecrã; confirme a versão guardada antes de continuar.',
        );
      }
      const files = photoDraft.filter((photo) => photo.file);
      photoTotal = files.length; preparedPhotos = files.filter(photo => photo.preparedFile || photo.uploadedPath).length;
      if (files.length) savePhase = 1;
      for (const photo of files) {
        if (photo.uploadedPath) continue;
        progress = `A preparar fotografias: ${preparedPhotos} de ${files.length}…`;
        await readyPhoto(photo);
        preparedPhotos = files.filter(item => item.preparedFile || item.uploadedPath).length;
      }
      preparedPhotos = files.filter(photo => photo.uploadedPath).length;
      if (files.length) savePhase = 2;
      for (const [index, photo] of files.entries()) {
        if (photo.uploadedPath) continue;
        progress = `A enviar fotografias: ${index + 1} de ${files.length}…`;
        const response = await sessionFetch(crmPath(`/viaturas/${baseline.id}/photos`), {
          method: 'POST',
          headers: {
            'content-type': photo.preparedFile!.type,
            'x-upload-id': photo.uploadId!,
            'x-edit-stage': 'true',
          },
          body: photo.preparedFile,
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok || !result.path)
          throw Error(
            result.error ?? 'Não foi possível preparar esta fotografia. O rascunho foi mantido.',
          );
        photo.uploadedPath = result.path;
        preparedPhotos += 1;
      }
      const resolve = (path: string) =>
        photoDraft.find((photo) => photo.path === path)?.uploadedPath ?? path;
      const { photoPaths: _legacyPhotoPaths, ...publicationData } = draft.publication;
      savePhase = 3;
      progress = action === 'publish' ? 'A concluir e publicar…' : 'A guardar a viatura…';
      sent = true;
      const response = await sessionFetch(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          expectedUpdatedAt: baseline.updatedAt,
          data: { ...draft.details, status: creationStatus(action, draft.details.status) },
          photos: draft.paths.map(resolve),
          uploadedPhotos: files.map((photo) => photo.uploadedPath!),
          publication: publicationData,
        }),
      });
      responded = true;
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        needsReload = !!result.outcomeUnknown || response.status >= 500;
        const feedback = serverEditIssues(result);
        if (feedback.length) await showIssues(feedback);
        throw Error(
          feedback[0]?.message ??
            result.error ??
            'Não foi possível guardar. O rascunho foi mantido.',
        );
      }
      committed = true;
      unregister?.();
      try { await autosave?.discard(); } catch { /* CRM save has already succeeded */ }
      saving = false;
      await tick();
      for (const form of Object.values(forms())) if (form) markFormSaved(form);
      listNavigationCache.clear();
      vehicleSavedFeedback({ title: action === 'publish' ? 'Viatura publicada' : 'Viatura adicionada ao CRM',
        brand: draft.details.brand, model: draft.details.model, year: draft.details.year,
        detail: action === 'publish' ? 'O anúncio já está disponível no website.' : 'Entrada confirmada. Ainda não publicada no website.',
        photo: photoDraft.find(photo => photo.path === draft.paths[0]),
      });
      await goto(crmPath(action === 'draft' ? '/viaturas' : `/viaturas/${baseline.id}`), {
        invalidateAll: true,
      });
    } catch (error) {
      if (committed || (sent && !responded)) needsReload = true;
      message = committed
        ? 'A gravação terminou, mas não foi possível abrir a ficha. Reabra-a para confirmar.'
        : needsReload
          ? 'Não foi possível confirmar o resultado. Não volte a gravar sem reabrir e verificar a ficha. Os dados continuam visíveis neste ecrã.'
          : error instanceof Error
            ? error.message
            : 'Não foi possível guardar. O rascunho foi mantido.';
      toast.error(message);
    } finally {
      saving = false;
      progress = '';
      await tick();
      if (issues.length) markEditIssues(root, issues);
    }
  }
</script>

<section bind:this={root} class="creation-wizard" oninput={changed} onchange={changed}>
  {#if ready}
  <nav class="wizard-steps" aria-label="Etapas da criação de viatura">
    <button
      type="button"
      aria-current={step === 1 ? 'step' : undefined}
      disabled={saving || needsReload}
      onclick={() => void changeStep(1)}><span>1</span><strong>Dados da viatura</strong></button
    >
    <button
      type="button"
      aria-current={step === 2 ? 'step' : undefined}
      disabled={saving || needsReload}
      onclick={() => void changeStep(2)}
      ><span>2</span><strong>Fotografias e website</strong></button
    >
  </nav>
  <p class="flow-note">
    {baseline.status === 'DRAFT'
      ? 'A ficha mantém-se em rascunho até escolher «Concluir no CRM» ou «Concluir e publicar».'
      : 'Esta viatura já tem uma ficha no CRM. As alterações deste ecrã só são aplicadas na ação final escolhida.'}
    Pode voltar ao passo 1 sem perder o que preencheu aqui.
  </p>
  {#if saving}<VehicleSaveProgress phase={savePhase} completed={preparedPhotos} total={photoTotal} label={progress || 'A guardar a viatura…'} />{/if}
  {#if issues.length}<div class="creation-errors" role="alert" tabindex="-1">
      <strong>Reveja os campos indicados:</strong>
      <ul>
        {#each issues as issue}<li>
            <button type="button" onclick={() => void visitIssue(issue)}>{issue.message}</button>
          </li>{/each}
      </ul>
      <p>As fotografias e os dados preenchidos foram mantidos.</p>
    </div>{/if}
  <h2 data-step-heading tabindex="-1">
    {step === 1 ? 'Dados da viatura' : 'Fotografias e website'}
  </h2>
  <!-- Keep both panels mounted: File/blob references, selection and editor history survive back/next. -->
  <div class:step-one={step === 1} class:step-two={step === 2}>
    <WebPublicationPanel
      creation
      recoveredDraft={recoveredPublication}
      unified
      managePhotos
      {vehicle}
      {photos}
      bind:photoDraft
      disabled={saving || needsReload}
      onsaveall={() => void save('crm')}
      onstatechange={() => void refresh()}
    >
      {#snippet vehicleDetails(characteristics)}
        <div class="creation-internal" hidden={step !== 1} inert={step !== 1}>
          <Panel
            ><div class="p-6">
              <VehicleForm
                {initial}
                {characteristics}
                unified
                disabled={saving || needsReload}
                onsaveall={() => void changeStep(2)}
                onstatechange={() => void refresh()}
              />
            </div></Panel
          >
        </div>
      {/snippet}
    </WebPublicationPanel>
  </div>
  {#if message}<p class="creation-errors" role="alert">{message}</p>{/if}
  {#if needsReload}<a href={crmPath(`/viaturas/${baseline.id}`)}
      >Abrir ficha guardada para confirmar →</a
    >{/if}
  <footer class="creation-footer">
    {#if draftState}<p role="status">{draftState}</p>{/if}
    {#if saving}<p role="status">{progress || 'A guardar…'}</p>{/if}
    <div class="creation-actions">
      {#if step === 1}<button
          class="strong"
          type="button"
          disabled={saving || needsReload}
          onclick={() => void changeStep(2)}>Continuar para fotografias →</button
        >
      {:else}
        <button type="button" disabled={saving || needsReload} onclick={() => void changeStep(1)}
          >← Voltar ao passo 1</button
        >
        <button
          class="strong"
          type="button"
          disabled={saving || needsReload || crmIssues.length > 0}
          aria-describedby="creation-requirements"
          onclick={() => void save('crm')}>Concluir no CRM</button
        >
        <button
          class="publish"
          type="button"
          disabled={saving || needsReload || publishIssues.length > 0}
          aria-describedby="creation-requirements"
          onclick={() => void save('publish')}>Concluir e publicar</button
        >
      {/if}
    </div>
  </footer>
  {#if step === 2}<div id="creation-requirements" class="creation-requirements">
      {#if crmIssues.length}<strong>Para concluir no CRM:</strong>
        <ul>
          {#each crmIssues as issue}<li>
              <button type="button" onclick={() => void visitIssue(issue)}>{issue.message}</button>
            </li>{/each}
        </ul>{/if}
      {#if publishIssues.length}<strong>Para publicar no site:</strong>
        <ul>
          {#each publishIssues as issue}<li>
              <button type="button" onclick={() => void visitIssue(issue)}>{issue.message}</button>
            </li>{/each}
        </ul>{:else}<p>
          Publicação pronta para validar ao guardar. Todas as fotografias da viatura serão públicas.
        </p>{/if}
    </div>{/if}
  {:else}<p role="status">A recuperar rascunho…</p>{/if}
</section>
<ConfirmDialog
  bind:open={confirmNoPhoto}
  title="Publicar sem fotografia?"
  message="A viatura ainda não tem fotografias. Será apresentada «Imagem indisponível». Pode voltar e adicionar fotografias ou confirmar a publicação sem imagem."
  confirmLabel="Publicar sem fotografia"
  cancelLabel="Voltar à seleção"
  onconfirm={() => void save('publish', true)}
/>

<style>
  .creation-wizard {
    display: grid;
    gap: 24px;
    min-width: 0;
  }
  .wizard-steps {
    display: flex;
    gap: 20px;
  }
  .wizard-steps button {
    display: flex;
    align-items: center;
    gap: 10px;
    flex: 1;
    text-align: left;
    padding: 14px 0;
    border-bottom: 2px solid var(--color-border);
    font-size: 13px;
  }
  .wizard-steps span {
    display: grid;
    place-items: center;
    width: 28px;
    height: 28px;
    border: 1px solid var(--color-border);
    border-radius: 50%;
  }
  .wizard-steps [aria-current] {
    border-color: var(--color-red);
  }
  .wizard-steps [aria-current] span {
    background: var(--color-red);
    color: white;
  }
  .flow-note,
  .creation-requirements,
  .creation-footer p {
    font-size: 13px;
    line-height: 1.6;
    color: var(--color-text-muted);
  }
  h2 {
    font-size: 22px;
    font-weight: 600;
  }
  .step-one :global(.photo-draft),
  .step-one :global(.web-publication) {
    display: none;
  }
  .step-one :global(.photo-save-note) {
    display: none;
  }
  .step-one :global(.editing-panels),
  .step-two :global(.editing-panels) {
    grid-template-columns: minmax(0, 1fr);
  }
  .creation-footer {
    border-top: 1px solid var(--color-border);
    padding-top: 24px;
    display: grid;
    gap: 16px;
  }
  .creation-actions {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    flex-wrap: wrap;
  }
  .creation-actions button {
    min-height: 48px;
    padding: 12px 20px;
    border: 1px solid var(--color-border-strong);
    border-radius: var(--radius-btn);
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
  }
  .creation-actions .strong {
    background: var(--color-text);
    color: var(--color-bg-0);
  }
  .creation-actions .publish {
    background: var(--color-red);
    color: white;
    border-color: var(--color-red);
  }
  button:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }
  button:focus-visible {
    outline: 2px solid var(--color-red);
    outline-offset: 3px;
  }
  .creation-errors {
    padding: 16px;
    border: 1px solid var(--color-warning);
    border-radius: var(--radius-btn);
    font-size: 13px;
    line-height: 1.6;
  }
  .creation-errors ul,
  .creation-requirements ul {
    padding-left: 20px;
    list-style: disc;
  }
  .creation-errors li button,
  .creation-requirements li button {
    text-decoration: underline;
    text-align: left;
  }
  .creation-requirements {
    padding: 16px;
    background: var(--color-bg-2);
    border-radius: var(--radius-btn);
  }
  @media (max-width: 700px) {
    .creation-actions {
      display: grid;
      grid-template-columns: 1fr;
    }
    .wizard-steps {
      gap: 12px;
    }
  }
</style>
