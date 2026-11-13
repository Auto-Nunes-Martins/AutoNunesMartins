<script lang="ts">
  import type { Snippet } from 'svelte';
  import { Monitor, Smartphone, RotateCcw } from 'lucide-svelte';
  import { reusablePhoto } from '$lib/reusablePhoto';
  import { featuredFramingPosition, featuredFramingRatio } from '$lib/homepageHighlights';
  import { photoFraming, photoGeometry, type PhotoFraming, type PhotoPosition } from '@anm/types';
  let {
    src,
    photo,
    value,
    context,
    destinations,
    actions,
    disabled = false,
    loading = false,
    onchange,
  }: {
    src: string;
    photo?: {
      url: string | null;
      width?: number;
      height?: number;
      variants?: { url: string; width: number; height?: number }[];
    };
    value?: PhotoFraming;
    context: 'gallery' | 'featured' | 'card' | 'campaign';
    destinations?: Snippet;
    actions?: Snippet;
    disabled?: boolean;
    loading?: boolean;
    onchange: (value: PhotoFraming | undefined) => void;
  } = $props();
  let device = $state<'desktop' | 'mobile'>('desktop');
  const position: PhotoPosition = $derived(
    context === 'featured'
      ? featuredFramingPosition(value, device)
      : (value?.[device] ?? { x: 50, y: 50 }),
  );
  const ratio = $derived(
    context === 'campaign'
      ? device === 'desktop'
        ? 1.8
        : 1.4
      : context === 'featured'
        ? featuredFramingRatio[device]
        : device === 'desktop'
          ? 1.4
          : 4 / 3,
  );
  let image: HTMLImageElement;
  let naturalSize = $state({ width: 0, height: 0 });
  const defaultFit = 'cover';
  const fit = $derived(
    position.fit === 'auto'
      ? naturalSize.height > naturalSize.width ? 'contain' : 'cover'
      : position.fit ?? defaultFit,
  );
  const horizontalLocked = $derived(fit === 'contain' && naturalSize.height > naturalSize.width);
  const verticalLocked = $derived(fit === 'contain' && naturalSize.width > naturalSize.height);
  const horizontalPosition = $derived(horizontalLocked ? 50 : position.x);
  const verticalPosition = $derived(verticalLocked ? 50 : position.y);
  const zoom = $derived(position.zoom ?? 1);
  const title = $derived(
    context === 'featured'
      ? 'Destaque da homepage'
      : context === 'card'
        ? 'Cartão da viatura'
        : context === 'campaign'
          ? 'Oferta por tempo limitado'
          : 'Imagem na galeria',
  );
  let start:
    | {
        id: number;
        x: number;
        y: number;
        position: { x: number; y: number };
        overflowY: number;
        overflowX: number;
      }
    | undefined;
  const clamp = (n: number) => Math.round(Math.max(0, Math.min(100, n)) * 100) / 100;
  function set(x: number, y: number, changes: Partial<PhotoPosition> = {}) {
    if (disabled) return;
    const fallback = { x: 50, y: context === 'featured' ? 53 : 50 };
    const next = { ...position, fit, x: clamp(x), y: clamp(y), ...changes };
    if (next.fit === 'contain' && naturalSize.height > naturalSize.width) next.x = 50;
    if (next.fit === 'contain' && naturalSize.width > naturalSize.height) next.y = 50;
    onchange({
      desktop: value?.desktop ?? { ...fallback },
      mobile: value?.mobile ?? { ...fallback },
      [device]: next,
    });
  }
  function begin(event: PointerEvent) {
    if (disabled || !image?.naturalWidth || event.button !== 0) return;
    const frame = event.currentTarget as HTMLElement;
    const geometry = photoGeometry(
      { width: image.naturalWidth, height: image.naturalHeight },
      { width: frame.clientWidth, height: frame.clientHeight },
      position,
      defaultFit,
    );
    if (!geometry) return;
    start = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      position: { ...position },
      overflowY: geometry.height - frame.clientHeight,
      overflowX: geometry.width - frame.clientWidth,
    };
    frame.setPointerCapture(event.pointerId);
  }
  function move(event: PointerEvent) {
    if (!start || disabled || event.pointerId !== start.id) return;
    set(
      start.position.x -
        (Math.abs(start.overflowX) > 0.5 ? ((event.clientX - start.x) / start.overflowX) * 100 : 0),
      start.position.y -
        (Math.abs(start.overflowY) > 0.5 ? ((event.clientY - start.y) / start.overflowY) * 100 : 0),
    );
  }
  function keydown(event: KeyboardEvent) {
    if (disabled) return;
    const step = event.shiftKey ? 10 : 2;
    const geometry =
      image &&
      photoGeometry(
        { width: image.naturalWidth, height: image.naturalHeight },
        { width: image.clientWidth, height: image.clientHeight },
        position,
        defaultFit,
      );
    const horizontalSign = geometry && geometry.width < image.clientWidth ? -1 : 1;
    const verticalSign = geometry && geometry.height < image.clientHeight ? -1 : 1;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      set(position.x + (event.key === 'ArrowLeft' ? step : -step) * horizontalSign, position.y);
      return;
    }
    const y =
      event.key === 'ArrowUp'
        ? position.y + step * verticalSign
        : event.key === 'ArrowDown'
          ? position.y - step * verticalSign
          : event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? 100
              : undefined;
    if (y !== undefined) {
      event.preventDefault();
      set(position.x, y);
    }
  }
</script>

<section
  class="framing"
  aria-label={context === 'featured'
    ? 'Enquadramento do destaque'
    : context === 'card'
      ? 'Enquadramento do cartão'
      : context === 'campaign'
        ? 'Enquadramento da oferta'
        : 'Enquadramento da imagem na galeria'}
>
  {#if destinations}<div class="destination-selector">{@render destinations()}</div>{/if}
  <div class="heading">
    <div class="editing-title"><span>A editar</span><strong>{title}</strong></div>
    <button
      class="reset"
      type="button"
      aria-label="Repor original"
      {disabled}
      onclick={() => onchange(undefined)}><RotateCcw size={14} aria-hidden="true" /> Repor</button
    >
  </div>
  <div class="toolbar">
    <div class="devices" role="group" aria-label="Pré-visualização por dispositivo">
      <button type="button" aria-pressed={device === 'desktop'} onclick={() => (device = 'desktop')}
        ><Monitor size={15} aria-hidden="true" /> Computador</button
      >
      <button type="button" aria-pressed={device === 'mobile'} onclick={() => (device = 'mobile')}
        ><Smartphone size={15} aria-hidden="true" /> Telemóvel</button
      >
    </div>
    <div class="modes" role="group" aria-label="Apresentação">
      <button
        type="button"
        {disabled}
        aria-pressed={fit === 'cover'}
        onclick={() => set(position.x, position.y, { fit: 'cover' })}>Preencher</button
      >
      <button
        type="button"
        {disabled}
        aria-pressed={fit === 'contain'}
        onclick={() => set(position.x, position.y, { fit: 'contain', zoom: 1 })}
        >Foto inteira</button
      >
    </div>
  </div>
  <div class="preview-shell" class:mobile={device === 'mobile'}>
    <div
      class="preview"
      class:card={context === 'card'}
      style:aspect-ratio={context === 'card' ? undefined : ratio}
      class:mobile={device === 'mobile'}
      role="slider"
      tabindex={disabled ? -1 : 0}
      aria-label="Posição da fotografia"
      aria-valuemin="0"
      aria-valuemax="100"
      aria-valuenow={verticalPosition}
      aria-valuetext={`Horizontal ${Math.round(horizontalPosition)}%, vertical ${Math.round(verticalPosition)}%, zoom ${Math.round(zoom * 100)}%`}
      aria-disabled={disabled}
      onkeydown={keydown}
      onpointerdown={begin}
      onpointermove={move}
      onpointerup={() => (start = undefined)}
      onpointercancel={() => (start = undefined)}
      onlostpointercapture={() => (start = undefined)}
    >
      <img
        bind:this={image}
        src={photo ? undefined : src}
        use:reusablePhoto={{ photo: photo ?? { url: src } }}
        use:photoFraming={{
          framing: value,
          defaultFit,
          defaultY: context === 'featured' ? 53 : 50,
          device,
        }}
        onload={() => (naturalSize = { width: image.naturalWidth, height: image.naturalHeight })}
        alt=""
        draggable="false"
      />
      {#if loading}<span class="loading-photo" role="status">A carregar fotografias…</span>{/if}
    </div>
  </div>
  <p class="hint">
    {horizontalLocked
      ? 'Centrada na horizontal · arraste para ajustar a altura.'
      : verticalLocked
        ? 'Centrada na vertical · arraste para ajustar os lados.'
      : 'Arraste a fotografia para ajustar o enquadramento.'}
  </p>
  <div class="zoom-control">
    <label class="range-label"
      >Zoom <output>{Math.round(zoom * 100)}%</output>
      <input
        aria-label="Zoom"
        type="range"
        min="1"
        max="3"
        step="0.01"
        value={zoom}
        {disabled}
        oninput={(event) =>
          set(position.x, position.y, { zoom: Number(event.currentTarget.value) })}
      />
    </label>
  </div>
  <p class="note">
    Pré-visualização de referência para {device === 'desktop' ? 'computador' : 'telemóvel'}. O
    recorte adapta-se ao espaço disponível.
  </p>
  {#if actions}<div class="editor-actions">{@render actions()}</div>{/if}
</section>

<style>
  .loading-photo { position: absolute; inset: 0; display: grid; place-items: center; background: #16191bb8; color: white; font-size: 12px; pointer-events: none; }
  .editor-actions {
    margin-top: 20px;
    padding-top: 18px;
    border-top: 1px solid var(--color-border);
  }
  .framing {
    padding: clamp(14px, 3vw, 24px);
    border: 1px solid var(--color-border);
    border-radius: 12px;
    background: var(--color-bg-1);
    min-width: 0;
  }
  .heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    flex-wrap: wrap;
  }
  .editing-title {
    display: grid;
    gap: 4px;
    padding-left: 10px;
    border-left: 2px solid var(--color-red);
  }
  .editing-title > span {
    color: var(--color-text-muted);
    font-size: 11px;
  }
  strong {
    font-size: 14px;
    font-weight: 600;
  }
  button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 7px;
    min-height: 36px;
    padding: 6px 10px;
    border: 1px solid transparent;
    border-radius: 6px;
    color: var(--color-text);
    background: transparent;
    cursor: pointer;
    font-size: 12px;
  }
  button:disabled {
    opacity: 0.5;
    cursor: default;
  }
  button:focus-visible,
  input:focus-visible,
  .preview:focus-visible {
    outline: 2px solid var(--color-text-muted);
    outline-offset: 3px;
  }
  .devices,
  .modes {
    display: flex;
    gap: 2px;
    padding: 3px;
    border-radius: 8px;
    background: var(--color-bg-2);
  }
  .toolbar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-block: 18px 14px;
  }
  .reset {
    color: var(--color-text-muted);
    padding-inline: 6px;
  }
  .reset:hover {
    color: var(--color-text);
    background: var(--color-bg-2);
  }
  .destination-selector {
    margin-bottom: 20px;
    border-bottom: 1px solid var(--color-border);
  }
  .zoom-control {
    margin-block: 18px 14px;
  }
  .range-label {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 6px 12px;
    color: var(--color-text);
    font-size: 12px;
  }
  output {
    color: var(--color-text-muted);
    font-variant-numeric: tabular-nums;
  }
  input[type='range'] {
    grid-column: 1 / -1;
    width: 100%;
    accent-color: var(--color-text-muted);
    cursor: pointer;
  }
  input:disabled {
    opacity: 0.35;
    cursor: default;
  }
  [aria-pressed='true'] {
    background: var(--color-bg-elevated);
    border-color: var(--color-border);
    box-shadow: 0 1px 3px #00000012;
    color: var(--color-text);
  }
  p {
    font-size: 12px;
    line-height: 1.6;
    color: var(--color-text-muted);
    margin: 10px 0;
  }
  .preview {
    position: relative;
    width: 100%;
    overflow: hidden;
    background: #191b1c;
    border-radius: 6px;
    touch-action: none;
    cursor: grab;
    user-select: none;
  }
  .preview:active {
    cursor: grabbing;
  }
  .preview.mobile {
    max-width: 390px;
    margin-inline: auto;
  }
  .preview-shell {
    container-type: inline-size;
    min-width: 0;
    max-width: 680px;
    margin-inline: auto;
  }
  .preview-shell.mobile {
    max-width: 390px;
    margin-inline: auto;
  }
  .preview.card {
    height: calc(100cqw / 1.4 + 60px);
  }
  img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
    pointer-events: none;
  }
  .note {
    font-size: 11px;
    margin-bottom: 0;
  }
  .hint {
    text-align: center;
    font-size: 11px;
    margin-block: 9px 0;
  }
  @media (max-width: 500px) {
    .toolbar {
      align-items: stretch;
    }
    .devices,
    .modes {
      width: 100%;
    }
    .devices button,
    .modes button {
      flex: 1;
    }
  }
</style>
