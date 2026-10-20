<script lang="ts">
  import { onMount, tick, type Snippet } from 'svelte';
  import { ArrowLeft, ArrowRight } from 'lucide-svelte';
  import { publicCard, type PublicCard, type PublicVehicle } from '$lib/publicVehicles';

  let {
    vehicles,
    card,
  }: { vehicles: PublicVehicle[]; card: Snippet<[PublicCard, number, boolean?]> } = $props();
  const items = $derived([...new Map(vehicles.map((v) => [v.slug, v])).values()].slice(0, 5));
  let first = $state(0);
  let indicated = $state(0);
  let capacity = $state(3);
  let step = $state(0);
  let busy = $state(false);
  let announcement = $state('');
  const loops = $derived(items.length > capacity);
  const ordered = $derived(items.map((_, i) => items[(first + i) % items.length]!));
  let viewport: HTMLDivElement = $state(null!);
  let track: HTMLDivElement = $state(null!);
  let animation: Animation | undefined;
  let cardFades: Animation[] = [];
  function clearCardFades() {
    for (const fade of cardFades) fade.cancel();
    cardFades = [];
    track
      ?.querySelectorAll<HTMLElement>('.slide')
      .forEach((slide) => slide.style.removeProperty('opacity'));
  }
  let movementDuration = $state(360);
  let movementEasing = $state('cubic-bezier(.22,.61,.36,1)');
  // Keep rapid navigation sequential, with at most three pending movements.
  const pending: number[] = [];
  let requestedPosition: number | undefined;
  let generation = 0;
  let pointer = $state<
    | {
        id: number;
        x: number;
        y: number;
        delta: number;
        dragging: boolean;
        lastX: number;
        lastTime: number;
        velocity: number;
      }
    | undefined
  >(undefined);
  let suppressClick = false;
  let reduced = false;
  let refresh: (() => Promise<void>) | undefined;
  $effect(() => {
    items;
    first = 0;
    indicated = 0;
    void refresh?.();
  });

  const base = () => (loops ? -items.length * step : 0);
  const reset = () => {
    if (track) track.style.transform = `translateX(${base()}px)`;
  };
  async function move(direction: number, from = base(), velocity = 0) {
    if (!loops || !step) return;
    if (busy) {
      if (pending.length < 3) pending.push(direction);
      else pending[pending.length - 1] = direction;
      return;
    }
    busy = true;
    const remaining = Math.abs(base() - direction * step - from);
    movementDuration =
      velocity && direction
        ? Math.max(240, Math.min(460, (remaining / Math.max(Math.abs(velocity), 0.45)) * 1.25))
        : Math.min(560, 300 + Math.abs(direction) * 60);
    const tangent = Math.max(
      0.25,
      Math.min(0.85, ((Math.abs(velocity) * movementDuration) / Math.max(1, remaining)) * 0.22),
    );
    movementEasing =
      velocity && direction ? `cubic-bezier(.22,${tangent},.35,1)` : 'cubic-bezier(.22,.61,.36,1)';
    indicated = (first + direction + items.length) % items.length;
    animation?.cancel();
    const version = ++generation;
    // Commit the indicator's new state in the same frame as the card movement.
    await tick();
    if (version !== generation) return;
    const focused =
      document.activeElement instanceof HTMLElement && track.contains(document.activeElement)
        ? document.activeElement
        : null;
    const bounds = viewport.getBoundingClientRect(),
      displacement = base() - direction * step - from;
    const duration = reduced ? 0 : direction === 0 ? 160 : movementDuration;
    if (direction && !reduced) {
      for (const slide of track.querySelectorAll<HTMLElement>('.slide:not(.ghost)')) {
        const box = slide.getBoundingClientRect();
        const visible = box.right > bounds.left && box.left < bounds.right;
        const leaves =
          box.right + displacement <= bounds.left + 1 ||
          box.left + displacement >= bounds.right - 1;
        if (visible && leaves)
          cardFades.push(
            slide.animate(
              [
                { opacity: Number(getComputedStyle(slide).opacity), offset: 0 },
                { opacity: Number(getComputedStyle(slide).opacity), offset: 0.6 },
                { opacity: 0, offset: 1 },
              ],
              { duration, easing: movementEasing, fill: 'forwards' },
            ),
          );
      }
    }
    animation = track.animate(
      [
        { transform: `translateX(${from}px)` },
        { transform: `translateX(${base() - direction * step}px)` },
      ],
      { duration, easing: movementEasing, fill: 'forwards' },
    );
    try {
      await animation.finished;
      if (version !== generation) return;
      first = (first + direction + items.length) % items.length;
      await tick();
      reset();
      animation.cancel();
      clearCardFades();
      if (
        focused &&
        (document.activeElement === focused || document.activeElement === document.body)
      )
        focused.focus({ preventScroll: true });
      announcement = `Viatura ${first + 1} de ${items.length}`;
    } catch {
      /* Resize or unmount cancels the in-flight movement. */
    } finally {
      if (version === generation) {
        busy = false;
        if (requestedPosition !== undefined) {
          const target = requestedPosition;
          requestedPosition = undefined;
          pending.length = 0;
          void selectPosition(target);
        } else {
          const next = pending.shift();
          if (next !== undefined) void move(next);
        }
      }
    }
  }
  function selectPosition(index: number) {
    if (!loops || !step) return;
    if (busy) {
      requestedPosition = index;
      return;
    }
    if (index === first) return;
    pending.length = 0;
    requestedPosition = undefined;
    const forward = (index - first + items.length) % items.length;
    void move(forward <= items.length / 2 ? forward : forward - items.length);
  }
  function down(event: PointerEvent) {
    if (!loops || busy || event.button !== 0) return;
    if (event.target instanceof Element && event.target.closest('button, input, select, textarea'))
      return;
    if (event.pointerType === 'mouse') event.preventDefault();
    suppressClick = false;
    pointer = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      delta: 0,
      dragging: false,
      lastX: event.clientX,
      lastTime: performance.now(),
      velocity: 0,
    };
  }
  function drag(event: PointerEvent) {
    if (!pointer || event.pointerId !== pointer.id) return;
    const dx = event.clientX - pointer.x;
    const dy = event.clientY - pointer.y;
    const now = performance.now(),
      elapsed = now - pointer.lastTime;
    if (elapsed > 0)
      pointer.velocity = pointer.velocity * 0.3 + ((event.clientX - pointer.lastX) / elapsed) * 0.7;
    pointer.lastX = event.clientX;
    pointer.lastTime = now;
    if (!pointer.dragging && Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy)) {
      pointer.dragging = true;
      viewport.setPointerCapture(event.pointerId);
    }
    if (!pointer.dragging) return;
    event.preventDefault();
    const limit = (items.length - 1) * step;
    pointer.delta = Math.max(-limit, Math.min(limit, dx));
    const outgoing = track.querySelector<HTMLElement>('.slide:not(.ghost)');
    if (outgoing)
      outgoing.style.opacity =
        pointer.delta < 0
          ? String(Math.max(0, Math.min(1, (step + pointer.delta) / (step * 0.35))))
          : '';
    track.style.transform = `translateX(${base() + pointer.delta}px)`;
    suppressClick = true;
  }
  function up(event: PointerEvent) {
    if (!pointer || event.pointerId !== pointer.id) return;
    const gesture = pointer;
    pointer = undefined;
    if (viewport.hasPointerCapture(event.pointerId))
      viewport.releasePointerCapture(event.pointerId);
    if (!gesture.dragging) return;
    const velocity = performance.now() - gesture.lastTime < 80 ? gesture.velocity : 0;
    const limit = items.length - 1;
    const projected = gesture.delta + Math.max(-90, Math.min(90, velocity * 110));
    const nearest = Math.max(-limit, Math.min(limit, Math.round(-projected / step)));
    void move(nearest, base() + gesture.delta, velocity);
  }
  function cancel() {
    pointer = undefined;
    suppressClick = false;
    clearCardFades();
    reset();
  }
  function click(event: MouseEvent) {
    if (suppressClick) {
      event.preventDefault();
      event.stopPropagation();
      suppressClick = false;
    }
  }
  function key(event: KeyboardEvent) {
    if (event.target !== viewport || !['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    event.preventDefault();
    void move(event.key === 'ArrowRight' ? 1 : -1);
  }
  async function focused(event: FocusEvent) {
    if (busy || !loops || !(event.target instanceof HTMLElement)) return;
    const slide = event.target.closest<HTMLElement>('[data-vehicle]');
    if (!slide) return;
    const index = ordered.findIndex((v) => v.slug === slide.dataset.vehicle);
    if (index < capacity) return;
    const target = event.target;
    first = (first + index) % items.length;
    indicated = first;
    await tick();
    reset();
    target.focus({ preventScroll: true });
  }
  onMount(() => {
    if (!viewport || !items.length) return;
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const preference = () => {
      reduced = media.matches;
    };
    preference();
    media.addEventListener('change', preference);
    const measure = async () => {
      ++generation;
      animation?.cancel();
      clearCardFades();
      pending.length = 0;
      requestedPosition = undefined;
      busy = false;
      pointer = undefined;
      capacity = innerWidth <= 700 ? 1 : innerWidth <= 1000 ? 2 : 3;
      await tick();
      indicated = first;
      const slide = track.querySelector<HTMLElement>('.slide');
      step =
        (slide?.getBoundingClientRect().width ?? 0) +
        Number.parseFloat(getComputedStyle(track).gap);
      reset();
    };
    let measuredWidth = viewport.getBoundingClientRect().width;
    const observer = new ResizeObserver(() => {
      const width = viewport.getBoundingClientRect().width;
      // Image loading can change height without changing the horizontal step.
      if (Math.abs(width - measuredWidth) < 0.5) return;
      measuredWidth = width;
      void measure();
    });
    refresh = measure;
    observer.observe(viewport);
    void measure();
    return () => {
      refresh = undefined;
      ++generation;
      pending.length = 0;
      requestedPosition = undefined;
      animation?.cancel();
      clearCardFades();
      observer.disconnect();
      media.removeEventListener('change', preference);
    };
  });
</script>

{#if items.length}
  <div
    class="carousel"
    class:looping={loops}
    role="region"
    aria-roledescription="carrossel"
    aria-label="Viaturas com preços próximos"
    style={`--count:${items.length};--movement-duration:${movementDuration}ms;--movement-easing:${movementEasing}`}
  >
    <div class="carousel-stage">
      <!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions (Arrow keys and swipe operate this carousel, alongside its explicit buttons.) -->
      <div
        class="viewport"
        bind:this={viewport}
        tabindex={loops ? 0 : undefined}
        role="group"
        aria-label="Sugestões; use as setas para navegar"
        onkeydown={key}
        onpointerdown={down}
        onpointermove={drag}
        onpointerup={up}
        onpointercancel={cancel}
        onclickcapture={click}
        onfocusin={focused}
        ondragstart={(e) => e.preventDefault()}
      >
        <div
          class="track"
          class:static={!loops}
          class:moving={busy || pointer?.dragging}
          bind:this={track}
        >
          {#if loops}{#each ordered as vehicle, index (vehicle.slug)}<div
                class="slide ghost"
                inert
                aria-hidden="true"
              >
                {@render card(publicCard(vehicle), index, false)}
              </div>{/each}{/if}
          {#each ordered as vehicle, index (vehicle.slug)}<div
              class="slide"
              data-vehicle={vehicle.slug}
              role="group"
              aria-roledescription="diapositivo"
              aria-label={`${items.findIndex((v) => v.slug === vehicle.slug) + 1} de ${items.length}`}
            >
              {@render card(publicCard(vehicle), index, false)}
            </div>{/each}
          {#if loops}{#each ordered as vehicle, index (vehicle.slug)}<div
                class="slide ghost"
                inert
                aria-hidden="true"
              >
                {@render card(publicCard(vehicle), index, false)}
              </div>{/each}{/if}
        </div>
      </div>
      {#if loops}<div
          class="integrated-controls"
          role="group"
          aria-label="Navegação integrada das sugestões"
        >
          <button
            type="button"
            aria-label="Viatura anterior · navegação integrada"
            onclick={() => move(-1)}><ArrowLeft size={19} aria-hidden="true" /></button
          >
          <button
            type="button"
            aria-label="Viatura seguinte · navegação integrada"
            onclick={() => move(1)}><ArrowRight size={19} aria-hidden="true" /></button
          >
        </div>{/if}
    </div>
    {#if loops}<div class="position-indicators" role="group" aria-label="Escolher viatura">
        {#each items as item, index (item.slug)}<button
            type="button"
            class:active={indicated === index}
            aria-label={`Mostrar viatura ${index + 1}: ${item.brand} ${item.model}`}
            aria-current={indicated === index ? 'true' : undefined}
            onclick={() => selectPosition(index)}><span></span></button
          >{/each}
      </div>{/if}
    <span class="sr-only" aria-live="polite" aria-atomic="true">{announcement}</span>
  </div>
{/if}

<style>
  .carousel {
    margin-top: 24px;
    --gap: 20px;
  }
  .position-indicators {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    width: calc(68px + (var(--count) - 1) * 46px);
    max-width: 100%;
    min-height: 24px;
    margin: 8px auto 0;
  }
  .position-indicators button {
    display: grid;
    place-items: center;
    flex-shrink: 0;
    width: 38px;
    min-height: 44px;
    padding: 0;
    border: 0;
    border-radius: 0;
    background: transparent;
    cursor: pointer;
  }
  .position-indicators button > span {
    display: block;
    width: 100%;
    height: 2px;
    border-radius: 2px;
    background: color-mix(in srgb, var(--text) 22%, transparent);
  }
  .position-indicators button.active {
    width: 68px;
  }
  .position-indicators button.active > span {
    height: 4px;
    background: var(--red);
  }
  .position-indicators button:focus-visible {
    outline: 2px solid var(--red);
    outline-offset: 2px;
    border-radius: 4px;
  }
  @media (hover: hover) {
    .position-indicators button:hover > span {
      transform: scale(1.08);
    }
  }
  @media (prefers-reduced-motion: no-preference) {
    .position-indicators button,
    .position-indicators button > span {
      transition:
        width var(--movement-duration) var(--movement-easing),
        height var(--movement-duration) var(--movement-easing),
        background-color var(--movement-duration) var(--movement-easing);
    }
    .position-indicators button > span {
      transition-property: width, height, background-color, transform;
    }
  }
  .carousel-stage {
    position: relative;
    container-type: inline-size;
    --related-slot: calc((100cqw - 3 * var(--gap)) / 3.22);
    --related-photo-ratio: 1.4;
  }
  .looping .viewport {
    margin-inline: 0;
    padding-inline: 0;
  }
  .integrated-controls {
    position: absolute;
    z-index: 3;
    inset: 0;
    pointer-events: none;
  }
  /* The viewport's 16px padding is offset by its -12px outer margin. */
  .integrated-controls button {
    position: absolute;
    top: calc(
      4px +
        (var(--related-slot) / var(--related-photo-ratio) + var(--vehicle-card-photo-extra, 32px)) /
        2
    );
    transform: translateY(-50%);
    pointer-events: auto;
  }
  .integrated-controls button:first-child {
    left: 8px;
  }
  .integrated-controls button:last-child {
    right: 8px;
  }
  .integrated-controls button {
    display: grid;
    place-items: center;
    width: 44px;
    height: 44px;
    border: 1px solid color-mix(in srgb, var(--text) 30%, transparent);
    border-radius: 50%;
    color: var(--text);
    background: var(--surface);
    cursor: pointer;
  }
  .integrated-controls button:last-child {
    background: var(--text);
    color: var(--bg);
    border-color: var(--text);
  }
  .integrated-controls button:hover {
    border-color: var(--text);
    background: color-mix(in srgb, var(--text) 12%, var(--surface));
  }
  .integrated-controls button:last-child:hover {
    background: var(--red);
    border-color: var(--red);
    color: #fff;
  }
  .integrated-controls button:focus-visible,
  .viewport:focus-visible {
    outline: 2px solid var(--text);
    outline-offset: 3px;
  }
  .viewport {
    position: relative;
    overflow: clip;
    touch-action: pan-y;
    margin: -12px -12px;
    padding: 16px 12px 24px;
  }
  /* Paint shadows/focus outside the frame without changing card geometry. */
  .looping .viewport {
    overflow-clip-margin: 32px;
  }
  .ghost {
    visibility: hidden;
  }
  .moving .ghost {
    visibility: visible;
  }
  .looping .viewport::after {
    content: '';
    position: absolute;
    z-index: 2;
    inset: 0 -32px 0 auto;
    width: calc(clamp(42px, 6vw, 86px) + 32px);
    pointer-events: none;
    background: linear-gradient(
      to right,
      transparent,
      color-mix(in srgb, var(--bg) 25%, transparent) 35%,
      color-mix(in srgb, var(--bg) 75%, transparent) 75%,
      var(--bg)
    );
  }
  .track {
    display: flex;
    align-items: stretch;
    gap: var(--gap);
  }
  .slide {
    flex: 0 0 calc((100% - 3 * var(--gap)) / 3.22);
    min-width: 0;
  }
  .slide :global(.vehicle-card) {
    height: 100%;
  }
  .static .slide {
    flex-basis: calc((100% - (var(--count) - 1) * var(--gap)) / var(--count));
    max-width: 440px;
  }
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
  }
  @media (min-width: 701px) and (max-width: 1000px) {
    .slide {
      flex-basis: calc((100% - 2 * var(--gap)) / 2.2);
    }
    .carousel-stage {
      --related-slot: calc((100cqw - 2 * var(--gap)) / 2.2);
    }
  }
  @media (max-width: 700px) {
    .carousel {
      --gap: 16px;
    }
    .carousel-stage {
      --related-slot: calc(100cqw * 0.86);
    }
    .slide {
      flex-basis: 86%;
    }
    .static .slide {
      flex-basis: 100%;
    }
  }
</style>
