<script lang="ts">
 import {photoAttrs,photoFallback,type SignedVariantPhoto} from "$lib/vehicleImage";
  import { crmPath } from '$lib/paths';
  import { trapDialogTab } from '../../../../../../shared/ui/dialogFocus';
  import type { Snippet } from 'svelte';
  import { Camera, Plus, Star, Trash2, Upload, ArrowLeft, ArrowRight, X } from 'lucide-svelte';
  import { invalidateAll } from '$app/navigation';
  import { toast } from 'svelte-sonner';
  import PanelHeader from '$lib/components/brand/PanelHeader.svelte';

  interface SignedPhoto extends SignedVariantPhoto {
    path: string;
    url: string;
  }

  interface Props {
    vehicleId: string;
    photos: SignedPhoto[];
    busy?: boolean;
    disabled?: boolean;
    dragging?: boolean;
    editable?: boolean;
    publicPaths?: string[];
    published?: boolean;
    principalPath?: string | null;
    editor?: Snippet<
      [
        {
          setPrimary: (path: string) => Promise<void>;
          reorder: (paths: string[]) => Promise<boolean>;
          deletePhoto: (path: string) => Promise<void>;
          preview: (path: string) => void;
          primaryPath: string | undefined;
          busy: boolean;
        },
      ]
    >;
  }

  let { vehicleId, photos, editor, disabled = false, dragging = false, editable = true, publicPaths, published = false, principalPath, busy = $bindable(false) }: Props = $props();
  // All photo ops go through SvelteKit proxy endpoints so the user's Clerk
  // session is forwarded server-side as a Bearer token to the Express backend.
  const apiBase = $derived(crmPath(`/viaturas/${vehicleId}/photos`));

  let uploading = $state(false);
  let activeIndex = $state(0);
  let loadedPrincipal = '';
  $effect(()=>{ const key=vehicleId+'|'+principalPath;if(key!==loadedPrincipal){loadedPrincipal=key;if(principalPath!==undefined)activeIndex=principalPath===null?-1:Math.max(0,photos.findIndex(photo=>photo.path===principalPath));} });
  let viewer = $state<HTMLDialogElement>(undefined!), opener = $state<HTMLButtonElement>(undefined!);
  let imageFailed = $state(false);
  let failedThumbnailUrls = $state<string[]>([]);
  const uid = $props.id();
  const captionId = uid + '-photo-caption';
  $effect(() => { if (activeIndex >= photos.length) activeIndex = Math.max(0, photos.length - 1); if (!photos.length) viewer?.close(); });
  $effect(() => { photos[activeIndex]?.path; photos[activeIndex]?.url; imageFailed = false; });
  function photoKey(event: KeyboardEvent) {
    trapDialogTab(event, viewer);
    if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    event.preventDefault(); event.stopPropagation();
    activeIndex = Math.max(0, Math.min(photos.length - 1, activeIndex + (event.key === 'ArrowRight' ? 1 : -1)));
  }

  async function uploadFiles(files: FileList) {
    if (disabled || dragging || busy || files.length === 0) return;
    busy = true;
    uploading = true;
    let uploaded = 0;
    try {
      for (const file of Array.from(files)) {
        if (file.size > 20 * 1024 * 1024) {
          toast.error(`${file.name}: ficheiro maior que 20 MB.`);
          continue;
        }
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
          toast.error(`${file.name}: formato não suportado.`);
          continue;
        }

        const persistRes = await fetch(apiBase, {
          method: 'POST', headers: { 'content-type': file.type }, body: file,
        });
        if (!persistRes.ok) {
          const error = await persistRes.json().catch(() => ({}));
          toast.error(error.error || 'Falha ao guardar fotografia.');
          continue;
        }
        uploaded++;

      }
      if (uploaded) toast.success(`${uploaded} fotografia(s) guardada(s) no CRM. A inclusão no site requer guardar a publicação.`);
      await invalidateAll();
    } catch {
      toast.error('Não foi possível concluir o carregamento. Verifique as fotografias já guardadas antes de repetir.');
      if (uploaded) await invalidateAll().catch(() => toast.error('Atualize a página para confirmar as fotografias guardadas.'));
    } finally {
      uploading = false;
      busy = false;
    }
  }

  async function setPrimary(path: string) {
    await reorder([path, ...photos.filter((p) => p.path !== path).map((p) => p.path)]);
  }

  async function reorder(next: string[]) {
    if (disabled || busy) return false;
    if (next.length === photos.length && next.every((path, index) => path === photos[index]?.path)) return true;
    busy = true;
    try {
      const res = await fetch(`${apiBase}/reorder`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ photos: next }),
      });
      if (res.ok) {
        activeIndex = 0;
        await invalidateAll();
        toast.success('Capa e ordem guardadas. A seleção de fotografias para o site é independente.');
        return true;
      } else {
        toast.error('Falha ao reordenar.');
      }
    } catch {
      toast.error('Não foi possível definir a fotografia principal.');
    } finally {
      busy = false;
    }
    return false;
  }

  async function deletePhoto(path: string) {
    if (disabled || busy || !window.confirm('Eliminar esta foto? A eliminação é imediata e também a retira do site, caso esteja publicada.')) return;
    busy = true;
    try {
      const res = await fetch(`${apiBase}/${encodeURIComponent(path)}`, { method: 'DELETE' });
      if (res.ok) {
        await invalidateAll();
        toast.success('Foto eliminada.');
      } else {
        toast.error('Falha ao eliminar.');
      }
    } catch {
      toast.error('Não foi possível eliminar a fotografia.');
    } finally {
      busy = false;
    }
  }

  function pickFile(e: Event) {
    const target = e.target as HTMLInputElement;
    if (target.files) {
      void uploadFiles(target.files);
      target.value = '';
    }
  }

  const primary = $derived(activeIndex<0 ? null : photos[activeIndex] ?? photos[0] ?? null);
</script>

<section
  class:with-editor={!!editor}
  class="overflow-hidden border border-[var(--color-border)] bg-[var(--color-bg-1)]"
  style="border-radius: var(--radius-card);"
>
  <PanelHeader icon={Camera} title="Fotografias" meta={`${photos.length} / 20`}>
    {#snippet actions()}
      {#if editable}
      <label
        class="inline-flex items-center gap-1.5 px-3 h-8 border border-[var(--color-border)] hover:border-[var(--color-border-strong)] font-mono text-[10px] uppercase tracking-[0.2em] cursor-pointer transition-colors {uploading
          ? 'opacity-50 pointer-events-none'
          : ''}"
        style="border-radius: var(--radius-btn);"
      >
        {#if uploading}
          <span
            class="inline-block h-3 w-3 rounded-full border-2 border-current border-r-transparent animate-spin"
          ></span>
        {:else}
          <Upload class="h-3.5 w-3.5" />
        {/if}
        Carregar
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          disabled={disabled || dragging || busy}
          onchange={pickFile}
          class="hidden"
        />
      </label>
      {:else}<a class="edit-photos" href={crmPath(`/viaturas/${vehicleId}/editar`)}>Editar fotografias</a>{/if}
    {/snippet}
  </PanelHeader>
  {#if editable}<p class="px-4 pb-3 text-xs text-[var(--color-text-muted)]">
    Carregar, eliminar, definir a foto principal e ordenar guardam de imediato neste ecrã. A foto principal do anúncio tem de estar autorizada para o site. Incluir ou retirar fotografias requer guardar a publicação.
  </p>
  {:else}<p class="px-4 py-3 text-xs text-[var(--color-text-muted)]">Consulte as fotografias com as setas ou amplie a imagem. Para alterar fotografias, capa e publicação, use «Editar fotografias» e guarde o rascunho completo.</p>{/if}
  <p class="px-4 pb-3 text-xs text-[var(--color-text-muted)]">
    JPEG, PNG ou WebP · até 20 MB por ficheiro. Otimização para cerca de 1,1 MB, com um máximo de 2 MB na fotografia guardada.
  </p>

  <div class:photo-workspace={!!editor}>
    <div>
      {#if photos.length === 0}
        <div
          class="photo-empty aspect-[16/10] flex flex-col items-center justify-center gap-3 bg-[var(--color-bg-2)]"
        >
          <Camera class="h-8 w-8 text-[var(--color-text-faint)]" />
          <span
            class="font-mono text-[10px] uppercase tracking-[0.25em] text-[var(--color-text-faint)]"
          >
            {editable ? 'Sem fotografias · carregar acima' : 'Sem fotografias · use «Editar fotografias» para adicionar'}
          </span>
        </div>

      {:else}
        <!-- Primary photo -->
        <div class="photo-preview aspect-[16/10] bg-[var(--color-bg-2)] overflow-hidden">
          {#if primary}
            <button bind:this={opener} type="button" class="photo-open" aria-label={`Ampliar fotografia ${activeIndex + 1} de ${photos.length}`} onclick={() => viewer.showModal()} onkeydown={photoKey}>
            {#if imageFailed}<span class="photo-unavailable">Fotografia indisponível</span>{:else}
            <img
              {...photoAttrs(primary,1600,'(max-width:700px) 100vw, 1100px')} use:photoFallback={primary.url}
              alt={`Fotografia ${activeIndex + 1} da viatura`}
              class="h-full w-full object-cover"
              loading="lazy"
              onerror={() => imageFailed = true}
            />
            {/if}
            </button>
            {#if photos.length > 1}
              <button type="button" class="photo-step previous" aria-label="Fotografia anterior" aria-disabled={activeIndex === 0} onclick={() => { if (activeIndex > 0) activeIndex -= 1; }} onkeydown={photoKey}><ArrowLeft size={20} aria-hidden="true" /></button>
              <button type="button" class="photo-step next" aria-label="Fotografia seguinte" aria-disabled={activeIndex === photos.length - 1} onclick={() => { if (activeIndex < photos.length - 1) activeIndex += 1; }} onkeydown={photoKey}><ArrowRight size={20} aria-hidden="true" /></button>
            {/if}
            <span class="photo-count" aria-hidden="true">{activeIndex + 1} / {photos.length}</span>
          {:else}<span class="photo-unavailable">Sem foto principal autorizada para o site. As fotografias privadas continuam disponíveis nas miniaturas.</span>{/if}
        </div>

        {#if publicPaths && primary}<p class="saved-visibility" class:on-site={published && publicPaths.includes(primary.path)}>{published && publicPaths.includes(primary.path) ? '✓ No site' : publicPaths.includes(primary.path) ? 'Autorizada · viatura fora do site' : 'Só no CRM'}</p>{/if}
        {#if !editor}
          <!-- Thumbnail strip -->
          <div class="flex gap-2 p-3 overflow-x-auto border-t border-[var(--color-border)]">
            {#each photos as p, i (p.path)}
              {@const isActive = i === activeIndex}
              {@const isPrimary = principalPath === undefined ? i === 0 : p.path === principalPath}
              <div class="relative flex-shrink-0">
                <button
                  type="button"
                  onclick={() => (activeIndex = i)}
                  class="block h-16 w-24 overflow-hidden border-2 transition-colors {isActive
                    ? 'border-[var(--color-red)]'
                    : 'border-transparent hover:border-[var(--color-border-strong)]'}"
                  style="border-radius: 4px;"
                >
                  {#if failedThumbnailUrls.includes(p.url)}<span class="flex h-full w-full items-center justify-center bg-[var(--color-bg-2)] text-[10px] text-[var(--color-text-muted)]">Indisponível</span>{:else}<img
                    {...photoAttrs(p,320,'96px')} use:photoFallback={p.url}
                    alt="Miniatura"
                    class="h-full w-full object-cover"
                    loading="lazy"
                    onerror={() => { if (!failedThumbnailUrls.includes(p.url)) failedThumbnailUrls = [...failedThumbnailUrls, p.url]; }}
                  />{/if}
                </button>
                {#if isPrimary}
                  <span
                    class="absolute top-0.5 left-0.5 px-1 py-0.5 bg-[var(--color-red)] text-white font-mono text-[8px] uppercase tracking-[0.15em]"
                    style="border-radius: 2px;"
                  >
                    Foto principal
                  </span>
                {/if}
                {#if publicPaths}<span class="thumb-visibility">{published && publicPaths.includes(p.path) ? '✓ No site' : 'CRM'}</span>{/if}
                {#if editable}<div class="absolute bottom-0.5 right-0.5 flex gap-0.5">
                  {#if !isPrimary}
                    <button
                      type="button"
                      disabled={disabled || busy}
                      onclick={() => setPrimary(p.path)}
                      title="Definir como principal"
                      class="bg-black/60 hover:bg-[var(--color-red)] text-white p-1"
                      style="border-radius: 2px;"
                    >
                      <Star class="h-3 w-3" />
                    </button>
                  {/if}
                  <button
                    type="button"
                    disabled={disabled || busy}
                    onclick={() => deletePhoto(p.path)}
                    title="Eliminar"
                    class="bg-black/60 hover:bg-[var(--color-red)] text-white p-1"
                    style="border-radius: 2px;"
                  >
                    <Trash2 class="h-3 w-3" />
                  </button>
                </div>{/if}
              </div>
            {/each}
            {#if editable}<label
              class="flex-shrink-0 flex items-center justify-center h-16 w-24 border-2 border-dashed border-[var(--color-border)] hover:border-[var(--color-red)] hover:bg-[color-mix(in_oklab,var(--color-red)_5%,transparent)] cursor-pointer transition-colors {uploading
                ? 'opacity-50 pointer-events-none'
                : ''}"
              style="border-radius: 4px;"
            >
              <Plus class="h-5 w-5 text-[var(--color-text-faint)]" />
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                disabled={disabled || dragging || busy}
                onchange={pickFile}
                class="hidden"
              />
            </label>{/if}
          </div>
        {/if}
      {/if}
    </div>
    {#if editor}<div class="photo-editor">
        {@render editor({
          setPrimary,
          reorder,
          deletePhoto,
          preview: (path) =>
            (activeIndex = Math.max(
              0,
              photos.findIndex((photo) => photo.path === path),
            )),
          primaryPath: photos[0]?.path,
          busy,
        })}
      </div>{/if}
  </div>
</section>

<dialog class="crm-photo-viewer" bind:this={viewer} aria-labelledby={captionId} onkeydown={photoKey} onclose={() => opener?.focus({ preventScroll: true })} onclick={event => { if (event.target === viewer) viewer.close(); }}>
  <button type="button" class="viewer-close" aria-label="Fechar fotografia" onclick={() => viewer.close()}><X size={22} aria-hidden="true" /></button>
  {#if primary}
    {#if imageFailed}<p class="photo-unavailable" role="status">Fotografia indisponível. Pode navegar para outra fotografia.</p>{:else}<img src={primary.url} alt={`Fotografia ${activeIndex + 1} da viatura`} onerror={() => imageFailed = true} />{/if}
  {/if}
  <p id={captionId}>Fotografia {activeIndex + 1} de {photos.length}</p>
  {#if photos.length > 1}
    <button type="button" class="viewer-step previous" aria-label="Fotografia anterior" aria-disabled={activeIndex === 0} onclick={() => { if (activeIndex > 0) activeIndex -= 1; }}><ArrowLeft size={22} aria-hidden="true" /></button>
    <button type="button" class="viewer-step next" aria-label="Fotografia seguinte" aria-disabled={activeIndex === photos.length - 1} onclick={() => { if (activeIndex < photos.length - 1) activeIndex += 1; }}><ArrowRight size={22} aria-hidden="true" /></button>
  {/if}
</dialog>

<style>
  .photo-preview { position: relative; }
  .edit-photos {display:inline-flex;align-items:center;min-height:44px;padding:8px 12px;border:1px solid var(--color-border);border-radius:var(--radius-btn);font-size:12px;}
  .saved-visibility {padding:10px 14px;font-size:13px;font-weight:600;background:var(--color-bg-2);border-bottom:1px solid var(--color-border);}
  .saved-visibility.on-site {background:color-mix(in srgb,#1e9c67 20%,var(--color-bg-1));}
  .thumb-visibility {position:absolute;bottom:2px;left:2px;padding:2px 4px;background:#111c;color:white;font-size:9px;pointer-events:none;}
  .photo-open { display: block; width: 100%; height: 100%; border: 0; padding: 0; background: transparent; cursor: zoom-in; }
  .photo-step,.viewer-step,.viewer-close { display: grid; place-items: center; position: absolute; min-width: 44px; min-height: 44px; background: #1119; color: white; border: 1px solid #ffffff70; border-radius: 50%; cursor: pointer; z-index: 2; }
  .photo-step,.viewer-step { top: 50%; transform: translateY(-50%); }
  .previous {left: 8px;} .next {right: 8px;} .viewer-close {top: 4px;right: 4px;}
  .photo-step[aria-disabled='true'],.viewer-step[aria-disabled='true'] {opacity:.35;cursor:default;}
  .photo-count {position:absolute;bottom:10px;left:50%;transform:translateX(-50%);padding:4px 10px;background:#1119;color:white;border-radius:12px;font-size:12px;pointer-events:none;}
  .photo-unavailable {display:grid;place-items:center;width:100%;height:100%;min-height:150px;color:var(--color-text-muted);font-size:14px;}
  :global(html:has(dialog.crm-photo-viewer[open])) {overflow:hidden;}
  .crm-photo-viewer {position:fixed;inset:auto;left:50vw;top:50dvh;transform:translate(-50%,-50%);margin:0;width:min(1500px,calc(100vw - 24px));height:min(1000px,calc(100dvh - 24px));max-width:calc(100vw - 24px);max-height:calc(100dvh - 24px);padding:56px 60px 16px;background:transparent;border:0;overflow:hidden;box-sizing:border-box;color:white;}
  .crm-photo-viewer[open] {display:grid;grid-template-rows:minmax(0,1fr) auto;gap:10px;}
  .crm-photo-viewer::backdrop {background:rgb(8 8 12 / 62%);backdrop-filter:blur(4px);}
  .crm-photo-viewer>img {display:block;width:100%;height:100%;min-height:0;object-fit:contain;}
  .crm-photo-viewer>p {text-align:center;font-size:13px;margin:0;padding:6px;}
  .crm-photo-viewer .photo-unavailable {min-height:0;}
  .photo-open:focus-visible,.photo-step:focus-visible,.crm-photo-viewer button:focus-visible {outline:2px solid var(--color-red);outline-offset:3px;}
  @media(max-width:600px){.crm-photo-viewer{width:calc(100vw - 8px);height:calc(100dvh - 8px);max-width:calc(100vw - 8px);max-height:calc(100dvh - 8px);padding:54px 48px 10px;}}
  .photo-workspace {
    display: grid;
    grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr);
  }
  .photo-editor {
    padding: 18px;
    border-left: 1px solid var(--color-border);
    max-height: 700px;
    overflow: auto;
  }
  .with-editor .photo-preview {
    max-height: 560px;
  }
  .with-editor .photo-preview img {
    object-fit: contain;
  }
  .with-editor .photo-empty {
    aspect-ratio: auto;
    min-height: 260px;
    height: 100%;
  }
  @media (max-width: 1050px) {
    .photo-workspace {
      grid-template-columns: 1fr;
    }
    .photo-editor {
      border-left: 0;
      border-top: 1px solid var(--color-border);
      max-height: none;
    }
    .with-editor .photo-preview {
      max-height: 440px;
    }
  }
</style>
