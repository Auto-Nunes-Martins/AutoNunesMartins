<script lang="ts">
 import {photoAttrs,photoFallback} from "$lib/vehicleImage";
  import { onDestroy, untrack } from 'svelte';
  import { Camera, Plus, Upload, X, Check } from 'lucide-svelte';
  import PanelHeader from '$lib/components/brand/PanelHeader.svelte';
  import PublicPhotoPicker from './PublicPhotoPicker.svelte';
  import type { EditPhoto } from './vehicleEditDraft';
  import { framingStyle, type PhotoFraming } from '@anm/types';
  import { PHOTO_ACCEPT, validatePhoto, preparePhoto } from '$lib/photoPreparation';
  import { crmPath } from '$lib/paths';
  let { photos = $bindable<EditPhoto[]>([]), selected = $bindable<string[]>([]), persisted, persistedCoverPath, form, disabled = false, framing = $bindable<Record<string, PhotoFraming>>({}) }:
    { photos: EditPhoto[]; selected: string[]; persisted: string[]; persistedCoverPath?: string; form: string; disabled?: boolean; framing?: Record<string, PhotoFraming> } = $props();
  let notice = $state<{ accepted: EditPhoto[]; rejected: string[] } | null>(null);
  let fileInput: HTMLInputElement;
  let uploadButton: HTMLButtonElement;
  let failedCoverUrl = $state('');
  let revealPath = $state('');
  let principalPath = $state(untrack(()=>persistedCoverPath));
  const cover = $derived(photos.find(photo=>photo.path===principalPath) ?? photos[0]);
  const displayOrder = $derived(cover ? [cover.path,...photos.filter(photo=>photo.path!==cover.path).map(photo=>photo.path)] : []);
  const addedCount = $derived(photos.filter(photo => photo.file).length);
  const uploadId = $props.id();
  const urls = new Set<string>();
  const controllers = new Map<string, AbortController>();
  const newPhotos = $derived(photos.filter(photo => photo.file));
  const readyCount = $derived(newPhotos.filter(photo => photo.preparedFile).length);
  const failedCount = $derived(newPhotos.filter(photo => photo.preparationError).length);
  const pendingCount = $derived(newPhotos.length - readyCount - failedCount);
  function enqueue(photo: EditPhoto) {
    const controller = new AbortController();
    controllers.set(photo.path, controller);
    photo.preparationError = undefined;
    photo.preparation = preparePhoto(photo.file!, controller.signal);
    void photo.preparation.then(file => {
      const current = photos.find(item => item.path === photo.path);
      if (!current || controller.signal.aborted) return;
      current.preparedFile = file;
      const url = URL.createObjectURL(file); urls.add(url); current.url = url;
      if (notice) notice = { ...notice, accepted: notice.accepted.map(item => item.path === current.path ? current : item) };
      failedCoverUrl = '';
    }).catch(error => {
      const current = photos.find(item => item.path === photo.path);
      if (current && !controller.signal.aborted) current.preparationError = `${photo.file!.name}: ${error.message}`;
    });
  }
  $effect(() => {
    for (const photo of photos) if (photo.file && !photo.preparation && !photo.preparedFile) enqueue(photo);
    for (const [path, controller] of controllers) if (!photos.some(photo => photo.path === path)) { controller.abort(); controllers.delete(path); }
  });
  $effect(() => {
    const used = new Set([...photos.map(photo => photo.url), ...(notice?.accepted.map(photo => photo.url) ?? [])]);
    for (const url of urls) if (!used.has(url)) { URL.revokeObjectURL(url); urls.delete(url); }
  });
  function pick(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    if (!input.files?.length) return;
    const accepted: EditPhoto[] = [], rejected: string[] = [];
    const previousCount = photos.length;
    for (const file of Array.from(input.files ?? [])) {
      if (photos.length >= 20) { rejected.push(`${file.name}: máximo de 20 fotografias atingido.`); continue; }
      try { validatePhoto(file); } catch (error) { rejected.push(`${file.name}: ${(error as Error).message}`); continue; }
      const uploadId = crypto.randomUUID(), url = /\.hei[cf]$/i.test(file.name) || /image\/hei[cf]/.test(file.type)
        ? crmPath('/catalog-placeholder.svg') : URL.createObjectURL(file);
      const photo = { path: 'draft:' + uploadId, url, file, uploadId };
      if (url.startsWith('blob:')) urls.add(url); accepted.push(photo); photos = [...photos, photo];
    }
    input.value = '';
    if (photos.length > previousCount) revealPath = photos[photos.length - 1]!.path;
    notice = { accepted, rejected };
  }
  async function reorder(paths: string[]) { photos = paths.map(path => photos.find(photo => photo.path === path)!); principalPath=paths[0]; return true; }
  async function primary(path: string) { await reorder([path, ...photos.filter(photo => photo.path !== path).map(photo => photo.path)]); }
  async function remove(path: string) { const wasPrincipal=cover?.path===path;photos = photos.filter(photo => photo.path !== path); selected = selected.filter(item => item !== path);if(wasPrincipal)principalPath=photos[0]?.path;if(notice?.accepted.some(photo=>photo.path===path)){const accepted=notice.accepted.filter(photo=>photo.path!==path);notice=accepted.length||notice.rejected.length?{...notice,accepted}:null;} }
  function closeNotice() { notice = null; uploadButton?.focus({ preventScroll: true }); }
  onDestroy(() => { for (const controller of controllers.values()) controller.abort(); for (const url of urls) URL.revokeObjectURL(url); });
</script>
<section class="photo-draft">
  <PanelHeader icon={Camera} title="Fotografias" meta={`${photos.length} / 20`} />
  <div class="draft-content">
    <div class="draft-toolbar"><p>JPEG, PNG, WebP ou HEIC/HEIF · até 50 MB e 50 megapíxeis por fotografia. Preparação automática neste dispositivo; envio apenas ao guardar.</p><button bind:this={uploadButton} type="button" class="upload-button" disabled={disabled || photos.length >= 20} aria-controls={uploadId} onclick={() => fileInput.click()}><Upload size={17} aria-hidden="true" />Escolher fotografias</button></div>
    <input id={uploadId} bind:this={fileInput} type="file" accept={PHOTO_ACCEPT} multiple hidden disabled={disabled || photos.length >= 20} onchange={pick} />
    <p class="decoder-notice"><a href={crmPath('/licenses/photo-decoder.txt')} target="_blank" rel="noreferrer">Licenças do conversor HEIC/HEIF</a></p>
    {#if newPhotos.length}
      <aside class="preparation-status" role="status" aria-live="polite" aria-atomic="true">
        <strong>{pendingCount ? `A preparar fotografias: ${readyCount} de ${newPhotos.length}` : failedCount ? 'Algumas fotografias precisam de atenção' : `${readyCount} de ${newPhotos.length} fotografias prontas`}</strong>
        <p>{pendingCount ? 'Pode continuar a preencher a ficha. Guardar aguarda a preparação.' : 'As fotografias só são enviadas ao guardar.'}</p>
        <progress max={newPhotos.length} value={readyCount} aria-label="Fotografias preparadas"></progress>
      </aside>
      {#each newPhotos.filter(photo => photo.preparationError) as photo}
        <div class="preparation-error"><p>{photo.preparationError}</p><button type="button" disabled={disabled} onclick={() => enqueue(photo)}>Tentar novamente</button><button type="button" disabled={disabled} onclick={() => remove(photo.path)}>Remover</button></div>
      {/each}
    {/if}
    {#if notice}<aside class="photo-notice" aria-label="Resultado da seleção de fotografias">
      <div class="notice-thumbnails" aria-hidden="true">{#each notice.accepted.slice(0, 3) as photo}<img {...photoAttrs(photo,320,'48px')} use:photoFallback={photo.url} alt="" />{/each}{#if notice.accepted.length > 3}<span>+{notice.accepted.length - 3}</span>{/if}{#if !notice.accepted.length}<Camera size={28} />{/if}</div>
      <div class="notice-copy" role="status" aria-live="polite" aria-atomic="true">
        <h3>{#if notice.accepted.length}<Check size={17} aria-hidden="true" />{notice.accepted.length === 1 ? 'Fotografia adicionada ao rascunho' : 'Fotografias adicionadas ao rascunho'}{:else}Não foi adicionada nenhuma fotografia{/if}</h3>
        {#if notice.accepted.length}<p><strong>Falta guardar alterações.</strong></p><p><span>{notice.accepted.length} {notice.accepted.length === 1 ? 'fotografia nova por guardar' : 'fotografias novas por guardar'}</span>. Todas as fotografias ficam visíveis quando a viatura é publicada, depois de guardar.</p>{/if}
        {#if notice.rejected.length}<p class="notice-rejected">{notice.rejected.length} {notice.rejected.length === 1 ? 'ficheiro não adicionado' : 'ficheiros não adicionados'}.</p><details><summary>Ver motivo{notice.rejected.length > 1 ? 's' : ''}</summary><ul>{#each notice.rejected as reason}<li>{reason}</li>{/each}</ul></details>{/if}
      </div>
      <button type="button" class="notice-close" aria-label="Fechar notificação de fotografias" onclick={closeNotice}><X size={18} aria-hidden="true" /></button>
    </aside>{/if}
    {#each photos as photo}<input type="hidden" name="photoDraft" value={photo.path} {form} />{/each}
    <div class="photo-workbench">
      <div class="cover-slot">
      <figure class="cover-preview" aria-label="Pré-visualização da foto principal">
        <div class="cover-image">
          {#if cover && failedCoverUrl !== cover.url}
            <img {...photoAttrs(cover,800,'320px')} style={framingStyle(framing[cover.path])} use:photoFallback={cover.url} alt={cover.path !== persistedCoverPath ? 'Foto principal · por guardar' : 'Foto principal guardada'} onerror={() => failedCoverUrl = cover.url} />
          {:else}
            <div class="cover-empty"><Camera size={36} strokeWidth={1.2} aria-hidden="true" /><span>{cover ? 'Fotografia indisponível' : 'A foto principal aparece aqui'}</span></div>
          {/if}
        </div>
        <figcaption><strong>{cover && cover.path !== persistedCoverPath ? 'Foto principal · por guardar' : 'Foto principal'}</strong><span>{cover ? 'A fotografia de apresentação do anúncio' : 'Adicione fotografias para escolher a principal'}</span></figcaption>
      </figure>
      </div>
      <div class="organize-panel">
        <div class="organize-heading"><h3>Organizar fotografias</h3><p>As alterações só são aplicadas <strong>ao guardar</strong>.</p></div>
        <PublicPhotoPicker dense {revealPath} {persistedCoverPath} bind:selected allowed={displayOrder} {photos} {persisted} {form} {framing} onframing={(path, value) => { const next = {...framing}; if (value) next[path] = value; else delete next[path]; framing = next; }} pending={disabled} staged onprimary={primary} onreorder={reorder} ondelete={remove} primaryPath={cover?.path}>
          {#snippet addPhoto()}<button type="button" class="add-photo-card" disabled={disabled || photos.length >= 20} aria-controls={uploadId} onclick={() => fileInput.click()}><Plus size={30} strokeWidth={1.3} aria-hidden="true" /><strong>Adicionar fotografias</strong><span>{photos.length >= 20 ? 'Limite de 20 atingido' : 'Escolher uma ou várias'}</span></button>{/snippet}
        </PublicPhotoPicker>
        {#if photos.length >= 20}<p class="upload-feedback" role="status">Limite de 20 fotografias atingido.</p>{:else if addedCount && !notice}<p class="upload-feedback" role="status">{addedCount} {addedCount === 1 ? 'fotografia nova por guardar' : 'fotografias novas por guardar'}</p>{/if}
      </div>
    </div>
  </div>
</section>
<style>
  .decoder-notice {font-size:10px;margin:-12px 0 16px;} .decoder-notice a {text-decoration:underline;color:var(--color-text-faint);}
  .preparation-status { padding:16px; margin-bottom:20px; border:1px solid var(--color-border); border-left:3px solid var(--color-red); border-radius:var(--radius-card); background:var(--color-bg-2); }
  .preparation-status strong {font-size:13px;} .preparation-status p {margin-top:5px;font-size:12px;} .preparation-status progress {display:block;width:100%;height:6px;margin-top:12px;accent-color:var(--color-red);}
  .preparation-status progress::-webkit-progress-bar {background:var(--color-border);border-radius:3px;} .preparation-status progress::-webkit-progress-value {background:var(--color-red);border-radius:3px;} .preparation-status progress {appearance:none;border:0;border-radius:3px;overflow:hidden;}
  .preparation-error {padding:12px;margin-bottom:12px;border:1px solid var(--color-red);border-radius:var(--radius-card);} .preparation-error button {font-size:12px;text-decoration:underline;margin:8px 16px 0 0;min-height:32px;}
  .photo-draft { border: 1px solid var(--color-border); border-radius: var(--radius-card); background: var(--color-bg-1); overflow: hidden; }
  .draft-content { padding: 24px;container-type:inline-size;container-name:vehicle-photos; }
  .photo-workbench { display:grid;grid-template-columns:clamp(240px,26%,320px) minmax(0,1fr);gap:20px;align-items:start; }
  .cover-slot { min-width:0; }
  .cover-preview { display:block;margin:0;width:100%;min-width:0;border:1px solid var(--color-border);border-radius:6px;overflow:hidden; }
  .cover-image { position:relative;aspect-ratio:1.4;background:var(--color-bg-0);display:grid;place-items:center;overflow:hidden; }
  .cover-image img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover;object-position:var(--photo-desktop,50% 50%); }
  @media(max-width:700px){.cover-image{aspect-ratio:4/3;}.cover-image img{object-position:var(--photo-mobile,50% 50%);}}
  .cover-empty { display:flex;flex-direction:column;align-items:center;gap:6px;padding:8px;color:var(--color-text-faint);font-size:11px;text-align:center; }
  figcaption { display:flex;flex-direction:column;justify-content:center;gap:6px;padding:12px 16px;border-top:1px solid var(--color-border); }
  figcaption strong { font-size: 13px; } figcaption span { font-size: 12px; color: var(--color-text-muted); }
  .draft-toolbar { display:flex; justify-content:space-between; align-items:center; gap:12px; margin-bottom:20px; }
  .draft-toolbar p {font-size:11px;}
  .organize-panel {min-width:0;}
  h3 { font-size: 17px; font-weight: 600; margin: 0 0 8px; color: var(--color-text); }
  p { font-size: 13px; color: var(--color-text-muted); line-height: 1.6; margin: 0; }
  .upload-button { display: inline-flex; align-items: center; justify-content: center; gap: 9px; min-height: 44px; padding: 10px 14px; flex-shrink:0; border: 1px solid var(--color-red); border-radius: var(--radius-btn); background: var(--color-red); color: white; font-size: 13px; font-weight: 600; cursor: pointer; }
  .upload-button:hover { background: var(--color-red-soft); border-color: var(--color-red-soft); }
  .add-photo-card { display:flex; flex-direction:row; align-items:center; justify-content:center; gap:10px; width:100%; min-height:76px; padding:14px 8px; border:1px dashed var(--color-border-strong); border-radius:var(--radius-card); background:var(--color-bg-2); color:var(--color-text-muted); cursor:pointer; }
  .add-photo-card strong {font-size:13px;color:var(--color-text);} .add-photo-card span {font-size:11px;} .add-photo-card:hover {border-color:var(--color-red);color:var(--color-text);}
  .upload-button:disabled,.add-photo-card:disabled { opacity: .45; cursor: not-allowed; }
  :is(.upload-button,.add-photo-card):focus-visible { outline: 2px solid var(--color-red); outline-offset: 4px; }
  .upload-feedback { margin-top: 12px; color: var(--color-text); font-size: 12px; }
  .photo-notice {display:flex;align-items:flex-start;gap:14px;padding:16px;margin-bottom:20px;border:1px solid var(--color-border-strong);border-left:3px solid var(--color-warning);border-radius:var(--radius-card);background:var(--color-bg-2);}
  .notice-thumbnails {display:flex;align-items:center;gap:4px;flex-shrink:0;flex-wrap:wrap;max-width:160px;color:var(--color-text-muted);}
  .notice-thumbnails img {width:48px;height:54px;object-fit:cover;border-radius:4px;}.notice-thumbnails span {font-size:12px;padding:4px;}
  .notice-copy {flex:1;min-width:0;}.notice-copy h3 {display:flex;align-items:center;gap:6px;font-size:14px;line-height:1.5;margin-bottom:4px;}.notice-copy p {font-size:12px;}.notice-copy strong {color:var(--color-text);}
  .notice-copy details {font-size:12px;color:var(--color-text-muted);margin-top:6px;}.notice-copy summary {cursor:pointer;padding:6px 0;}.notice-copy ul {padding-left:18px;list-style:disc;overflow-wrap:anywhere;}
  .notice-rejected {margin-top:6px;}.notice-close {display:grid;place-items:center;width:44px;height:44px;flex-shrink:0;border:1px solid var(--color-border);border-radius:4px;color:var(--color-text-muted);cursor:pointer;}.notice-close:focus-visible,.notice-copy summary:focus-visible {outline:2px solid var(--color-red);outline-offset:3px;}
  .organize-heading { margin-bottom: 18px; }
  @media(max-width:760px) { .draft-content {padding:16px;} .photo-workbench {grid-template-columns:1fr;gap:20px;} .draft-toolbar {flex-wrap:wrap;align-items:flex-start;} .draft-toolbar p {flex-basis:100%;} .upload-button {font-size:12px;padding-inline:10px;} }
  @container vehicle-photos (max-width:800px) {.photo-workbench {grid-template-columns:1fr;}.cover-slot {width:min(320px,100%);}}
  @media(max-width:480px) {.cover-slot {width:min(240px,100%);}figcaption {padding:8px 10px;}figcaption span {font-size:11px;}.add-photo-card strong {font-size:12px;}}
  @media(max-width:480px) {.photo-notice {flex-wrap:wrap;gap:10px;padding:12px;}.notice-thumbnails {order:2;max-width:100%;width:100%;}.notice-copy {flex-basis:calc(100% - 54px);}.notice-close {margin-left:auto;}}
</style>
