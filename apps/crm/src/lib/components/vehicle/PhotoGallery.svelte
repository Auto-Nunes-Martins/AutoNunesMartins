<script lang="ts">
  import { crmPath } from '$lib/paths';
  import type { Snippet } from 'svelte';
  import { Camera, Plus, Star, Trash2, Upload } from 'lucide-svelte';
  import { invalidateAll } from '$app/navigation';
  import { toast } from 'svelte-sonner';
  import PanelHeader from '$lib/components/brand/PanelHeader.svelte';

  interface SignedPhoto {
    path: string;
    url: string;
  }

  interface Props {
    vehicleId: string;
    photos: SignedPhoto[];
    busy?: boolean;
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

  let { vehicleId, photos, editor, busy = $bindable(false) }: Props = $props();
  // All photo ops go through SvelteKit proxy endpoints so the user's Clerk
  // session is forwarded server-side as a Bearer token to the Express backend.
  const apiBase = $derived(crmPath(`/viaturas/${vehicleId}/photos`));

  let uploading = $state(false);
  let activeIndex = $state(0);

  async function uploadFiles(files: FileList) {
    if (busy || files.length === 0) return;
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
      if (uploaded) toast.success(`${uploaded} fotografia(s) carregada(s).`);
      await invalidateAll();
    } finally {
      uploading = false;
      busy = false;
    }
  }

  async function setPrimary(path: string) {
    await reorder([path, ...photos.filter((p) => p.path !== path).map((p) => p.path)]);
  }

  async function reorder(next: string[]) {
    if (busy) return false;
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
        toast.success('Ordem das fotografias guardada.');
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
    if (busy || !window.confirm('Eliminar esta foto?')) return;
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

  const primary = $derived(photos[activeIndex] ?? photos[0] ?? null);
</script>

<section
  class:with-editor={!!editor}
  class="overflow-hidden border border-[var(--color-border)] bg-[var(--color-bg-1)]"
  style="border-radius: var(--radius-card);"
>
  <PanelHeader icon={Camera} title="Fotografias" meta={`${photos.length} / 20`}>
    {#snippet actions()}
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
          disabled={busy}
          onchange={pickFile}
          class="hidden"
        />
      </label>
    {/snippet}
  </PanelHeader>
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
            Sem fotografias · carregar acima
          </span>
        </div>
      {:else}
        <!-- Primary photo -->
        <div class="photo-preview aspect-[16/10] bg-[var(--color-bg-2)] overflow-hidden">
          {#if primary}
            <img
              src={primary.url}
              alt="Foto principal"
              class="h-full w-full object-cover"
              loading="lazy"
            />
          {/if}
        </div>

        {#if !editor}
          <!-- Thumbnail strip -->
          <div class="flex gap-2 p-3 overflow-x-auto border-t border-[var(--color-border)]">
            {#each photos as p, i (p.path)}
              {@const isActive = i === activeIndex}
              {@const isPrimary = i === 0}
              <div class="relative flex-shrink-0">
                <button
                  type="button"
                  onclick={() => (activeIndex = i)}
                  class="block h-16 w-24 overflow-hidden border-2 transition-colors {isActive
                    ? 'border-[var(--color-red)]'
                    : 'border-transparent hover:border-[var(--color-border-strong)]'}"
                  style="border-radius: 4px;"
                >
                  <img
                    src={p.url}
                    alt="Miniatura"
                    class="h-full w-full object-cover"
                    loading="lazy"
                  />
                </button>
                {#if isPrimary}
                  <span
                    class="absolute top-0.5 left-0.5 px-1 py-0.5 bg-[var(--color-red)] text-white font-mono text-[8px] uppercase tracking-[0.15em]"
                    style="border-radius: 2px;"
                  >
                    Principal
                  </span>
                {/if}
                <div class="absolute bottom-0.5 right-0.5 flex gap-0.5">
                  {#if !isPrimary}
                    <button
                      type="button"
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
                    onclick={() => deletePhoto(p.path)}
                    title="Eliminar"
                    class="bg-black/60 hover:bg-[var(--color-red)] text-white p-1"
                    style="border-radius: 2px;"
                  >
                    <Trash2 class="h-3 w-3" />
                  </button>
                </div>
              </div>
            {/each}
            <label
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
                onchange={pickFile}
                class="hidden"
              />
            </label>
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

<style>
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
