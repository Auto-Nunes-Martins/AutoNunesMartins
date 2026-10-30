<script lang="ts">
  import type { PhotoFraming } from '@anm/types';
  let {
    src,
    value,
    context,
    disabled = false,
    onchange,
  }: {
    src: string;
    value?: PhotoFraming;
    context: 'gallery' | 'featured';
    disabled?: boolean;
    onchange: (value: PhotoFraming | undefined) => void;
  } = $props();
  let device = $state<'desktop' | 'mobile'>('desktop');
  const position = $derived(value?.[device] ?? { x: 50, y: context === 'featured' ? 53 : 50 });
  const ratio = $derived(
    context === 'featured'
      ? device === 'desktop'
        ? 1.65
        : 1.85
      : device === 'desktop'
        ? 1.4
        : 4 / 3,
  );
  let image: HTMLImageElement;
  let start:
    | {
        id: number;
        x: number;
        y: number;
        position: { x: number; y: number };
        overflowX: number;
        overflowY: number;
      }
    | undefined;
  const clamp = (n: number) => Math.round(Math.max(0, Math.min(100, n)) * 100) / 100;
  function set(x: number, y: number) {
    const fallback = { x: 50, y: context === 'featured' ? 53 : 50 };
    onchange({
      desktop: value?.desktop ?? { ...fallback },
      mobile: value?.mobile ?? { ...fallback },
      [device]: { x: clamp(x), y: clamp(y) },
    });
  }
  function begin(event: PointerEvent) {
    if (disabled || !image?.naturalWidth || event.button !== 0) return;
    const frame = event.currentTarget as HTMLElement;
    const scale = Math.max(
      frame.clientWidth / image.naturalWidth,
      frame.clientHeight / image.naturalHeight,
    );
    start = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      position: { ...position },
      overflowX: image.naturalWidth * scale - frame.clientWidth,
      overflowY: image.naturalHeight * scale - frame.clientHeight,
    };
    frame.setPointerCapture(event.pointerId);
  }
  function move(event: PointerEvent) {
    if (!start || disabled || event.pointerId !== start.id) return;
    set(
      start.position.x -
        (start.overflowX > 0.5 ? ((event.clientX - start.x) / start.overflowX) * 100 : 0),
      start.position.y -
        (start.overflowY > 0.5 ? ((event.clientY - start.y) / start.overflowY) * 100 : 0),
    );
  }
</script>

<section
  class="framing"
  aria-label={context === 'featured'
    ? 'Enquadramento do destaque'
    : 'Enquadramento na ficha pública'}
>
  <div class="heading">
    <strong
      >{context === 'featured'
        ? 'Enquadramento do destaque'
        : 'Enquadramento na ficha pública'}</strong
    ><button type="button" {disabled} onclick={() => onchange(undefined)}>Repor original</button>
  </div>
  <div class="devices" role="group" aria-label="Pré-visualização por dispositivo">
    <button type="button" aria-pressed={device === 'desktop'} onclick={() => (device = 'desktop')}
      >Computador</button
    >
    <button type="button" aria-pressed={device === 'mobile'} onclick={() => (device = 'mobile')}
      >Telemóvel</button
    >
  </div>
  <p>Arraste a fotografia para manter o carro visível. Cada dispositivo tem o seu ajuste.</p>
  <div
    class="preview"
    style:aspect-ratio={ratio}
    class:mobile={device === 'mobile'}
    role="img"
    aria-label="Pré-visualização do recorte"
    onpointerdown={begin}
    onpointermove={move}
    onpointerup={() => (start = undefined)}
    onpointercancel={() => (start = undefined)}
    onlostpointercapture={() => (start = undefined)}
  >
    <img
      bind:this={image}
      {src}
      alt=""
      draggable="false"
      style:object-position={`${position.x}% ${position.y}%`}
    />
  </div>
  <div class="sliders">
    <label
      >Horizontal <input
        type="range"
        min="0"
        max="100"
        step="0.1"
        value={position.x}
        {disabled}
        oninput={(event) => set(Number(event.currentTarget.value), position.y)}
      /></label
    >
    <label
      >Vertical <input
        type="range"
        min="0"
        max="100"
        step="0.1"
        value={position.y}
        {disabled}
        oninput={(event) => set(position.x, Number(event.currentTarget.value))}
      /></label
    >
  </div>
  <p class="note">
    {context === 'featured'
      ? 'Só altera o destaque da homepage.'
      : 'Só altera a imagem grande da ficha pública. A ampliação mostra a fotografia inteira.'} Pré-visualização
    de referência; o espaço disponível varia com o ecrã.
  </p>
</section>

<style>
  .framing {
    padding: 16px;
    border: 1px solid var(--color-border);
    border-radius: 10px;
    background: var(--color-bg-2);
    min-width: 0;
  }
  .heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    flex-wrap: wrap;
  }
  strong {
    font-size: 13px;
  }
  button {
    min-height: 36px;
    padding: 6px 10px;
    border: 1px solid var(--color-border);
    border-radius: 6px;
    color: var(--color-text);
    background: var(--color-bg-1);
    cursor: pointer;
    font-size: 12px;
  }
  button:disabled {
    opacity: 0.5;
    cursor: default;
  }
  button:focus-visible,
  input:focus-visible {
    outline: 2px solid var(--color-red);
    outline-offset: 3px;
  }
  .devices {
    display: flex;
    gap: 6px;
    margin-top: 12px;
  }
  [aria-pressed='true'] {
    border-color: var(--color-red);
    color: var(--color-red);
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
  img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
    pointer-events: none;
  }
  .sliders {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
    margin-top: 12px;
  }
  label {
    font-size: 12px;
    color: var(--color-text-muted);
  }
  input {
    display: block;
    width: 100%;
    min-height: 32px;
    accent-color: var(--color-red);
  }
  .note {
    font-size: 11px;
    margin-bottom: 0;
  }
</style>
