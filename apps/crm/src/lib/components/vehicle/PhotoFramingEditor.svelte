<script lang="ts">
  import {reusablePhoto} from '$lib/reusablePhoto';
  import type { PhotoFraming } from '@anm/types';
  let {
    src,
    photo,
    value,
    context,
    disabled = false,
    onchange,
  }: {
    src: string;
    photo?:{url:string|null;width?:number;height?:number;variants?:{url:string;width:number;height?:number}[]};
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
        y: number;
        position: { x: number; y: number };
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
      y: event.clientY,
      position: { ...position },
      overflowY: image.naturalHeight * scale - frame.clientHeight,
    };
    frame.setPointerCapture(event.pointerId);
  }
  function move(event: PointerEvent) {
    if (!start || disabled || event.pointerId !== start.id) return;
    set(
      start.position.x,
      start.position.y -
        (start.overflowY > 0.5 ? ((event.clientY - start.y) / start.overflowY) * 100 : 0),
    );
  }
  function keydown(event: KeyboardEvent) {
    if (disabled) return;
    const step = event.shiftKey ? 10 : 2;
    const y =
      event.key === 'ArrowUp'
        ? position.y + step
        : event.key === 'ArrowDown'
          ? position.y - step
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
  <p>Arraste a fotografia para cima ou para baixo, até o carro ficar bem enquadrado.</p>
  <div
    class="preview"
    style:aspect-ratio={ratio}
    class:mobile={device === 'mobile'}
    role="slider"
    tabindex={disabled ? -1 : 0}
    aria-label="Posição da fotografia"
    aria-valuemin="0"
    aria-valuemax="100"
    aria-valuenow={position.y}
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
      src={photo?undefined:src}
      use:reusablePhoto={{photo:photo??{url:src}}}
      alt=""
      draggable="false"
      style:object-position={`${position.x}% ${position.y}%`}
    />
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
  .preview:focus-visible {
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
  .note {
    font-size: 11px;
    margin-bottom: 0;
  }
</style>
