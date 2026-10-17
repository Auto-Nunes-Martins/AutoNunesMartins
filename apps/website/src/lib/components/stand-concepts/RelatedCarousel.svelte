<script lang="ts">
  import { onMount, tick, type Snippet } from 'svelte';
  import { ArrowLeft, ArrowRight } from 'lucide-svelte';
  import { publicCard, type PublicCard, type PublicVehicle } from '$lib/publicVehicles';

  let { vehicles, card }: { vehicles: PublicVehicle[]; card: Snippet<[PublicCard, number, boolean?]> } = $props();
  const items = $derived([...new Map(vehicles.map(v => [v.slug, v])).values()].slice(0, 5));
  let first = $state(0);
  let capacity = $state(3);
  let step = $state(0);
  let busy = $state(false);
  let announcement = $state('');
  const loops = $derived(items.length > capacity);
  const ordered = $derived(items.map((_, i) => items[(first + i) % items.length]!));
  let viewport: HTMLDivElement = $state(null!);
  let track: HTMLDivElement = $state(null!);
  let animation: Animation | undefined;
  // Keep rapid navigation sequential, with at most three pending movements.
  const pending: number[] = [];
  let generation = 0;
  let pointer = $state<{ id: number; x: number; y: number; delta: number; dragging: boolean } | undefined>(undefined);
  let suppressClick = false;
  let reduced = false;
  let refresh: (() => Promise<void>) | undefined;
  $effect(() => { items; first = 0; void refresh?.(); });

  const base = () => loops ? -step : 0;
  const reset = () => { if (track) track.style.transform = `translateX(${base()}px)`; };
  async function move(direction: number, from = base()) {
    if (!loops || !step) return;
    if (busy) {
      if (pending.length < 3) pending.push(direction);
      else pending[pending.length - 1] = direction;
      return;
    }
    busy = true;
    animation?.cancel();
    const version = ++generation;
    const focused = document.activeElement instanceof HTMLElement && track.contains(document.activeElement) ? document.activeElement : null;
    animation = track.animate([
      { transform: `translateX(${from}px)` },
      { transform: `translateX(${base() - direction * step}px)` },
    ], { duration: reduced ? 0 : direction === 0 ? 160 : 360, easing: 'cubic-bezier(.22,.61,.36,1)', fill: 'forwards' });
    try {
      await animation.finished;
      if (version !== generation) return;
      first = (first + direction + items.length) % items.length;
      await tick();
      reset();
      animation.cancel();
      if (focused && (document.activeElement === focused || document.activeElement === document.body)) focused.focus({ preventScroll: true });
      announcement = `Viatura ${first + 1} de ${items.length}`;
    } catch { /* Resize or unmount cancels the in-flight movement. */ }
    finally {
      if (version === generation) {
        busy = false;
        const next = pending.shift();
        if (next !== undefined) void move(next);
      }
    }
  }
  function down(event: PointerEvent) {
    if (!loops || busy || event.button !== 0) return;
    suppressClick = false;
    pointer = { id: event.pointerId, x: event.clientX, y: event.clientY, delta: 0, dragging: false };
  }
  function drag(event: PointerEvent) {
    if (!pointer || event.pointerId !== pointer.id) return;
    const dx = event.clientX - pointer.x;
    const dy = event.clientY - pointer.y;
    if (!pointer.dragging && Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy)) {
      pointer.dragging = true;
      viewport.setPointerCapture(event.pointerId);
    }
    if (!pointer.dragging) return;
    pointer.delta = Math.max(-step, Math.min(step, dx));
    track.style.transform = `translateX(${base() + pointer.delta}px)`;
    suppressClick = true;
  }
  function up(event: PointerEvent) {
    if (!pointer || event.pointerId !== pointer.id) return;
    const gesture = pointer;
    pointer = undefined;
    if (viewport.hasPointerCapture(event.pointerId)) viewport.releasePointerCapture(event.pointerId);
    if (!gesture.dragging) return;
    if (Math.abs(gesture.delta) >= Math.min(45, step * .15)) void move(gesture.delta < 0 ? 1 : -1, base() + gesture.delta);
    else void move(0, base() + gesture.delta);
  }
  function cancel() { pointer = undefined; suppressClick = false; reset(); }
  function click(event: MouseEvent) {
    if (suppressClick) { event.preventDefault(); event.stopPropagation(); suppressClick = false; }
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
    const index = ordered.findIndex(v => v.slug === slide.dataset.vehicle);
    if (index < capacity) return;
    const target = event.target;
    first = (first + index) % items.length;
    await tick();
    reset();
    target.focus({ preventScroll: true });
  }
  onMount(() => {
    if (!viewport || !items.length) return;
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const preference = () => { reduced = media.matches; };
    preference();
    media.addEventListener('change', preference);
    const measure = async () => {
      ++generation;
      animation?.cancel();
      pending.length = 0;
      busy = false;
      pointer = undefined;
      capacity = innerWidth <= 700 ? 1 : innerWidth <= 1000 ? 2 : 3;
      await tick();
      const slide = track.querySelector<HTMLElement>('.slide');
      step = (slide?.getBoundingClientRect().width ?? 0) + Number.parseFloat(getComputedStyle(track).gap);
      reset();
    };
    let measuredWidth = viewport.getBoundingClientRect().width;
    const observer = new ResizeObserver(() => {
      const width = viewport.getBoundingClientRect().width;
      // Image loading can change height without changing the horizontal step.
      if (Math.abs(width - measuredWidth) < .5) return;
      measuredWidth = width;
      void measure();
    });
    refresh = measure;
    observer.observe(viewport);
    void measure();
    return () => { refresh = undefined; ++generation; pending.length = 0; animation?.cancel(); observer.disconnect(); media.removeEventListener('change', preference); };
  });
</script>

{#if items.length}
  <div class="carousel" class:looping={loops} role="region" aria-roledescription="carrossel" aria-label="Viaturas com preços próximos" style={`--count:${items.length}`}>
    {#if loops}<div class="controls">
      <span aria-hidden="true">{first + 1} / {items.length}</span>
      <button type="button" aria-label="Viatura anterior" onclick={() => move(-1)}><ArrowLeft size={19} aria-hidden="true" /></button>
      <button type="button" aria-label="Viatura seguinte" onclick={() => move(1)}><ArrowRight size={19} aria-hidden="true" /></button>
    </div>{/if}
    <div class="carousel-stage">
    <!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions (Arrow keys and swipe operate this carousel, alongside its explicit buttons.) -->
    <div class="viewport" bind:this={viewport} tabindex={loops ? 0 : undefined} role="group" aria-label="Sugestões; use as setas para navegar" onkeydown={key} onpointerdown={down} onpointermove={drag} onpointerup={up} onpointercancel={cancel} onclickcapture={click} onfocusin={focused} ondragstart={(e) => e.preventDefault()}>
      <div class="track" class:static={!loops} class:moving={busy || pointer?.dragging} bind:this={track}>
        {#if loops}<div class="slide ghost" inert aria-hidden="true">{@render card(publicCard(ordered[ordered.length - 1]!), 0, false)}</div>{/if}
        {#each ordered as vehicle, index (vehicle.slug)}<div class="slide" data-vehicle={vehicle.slug} role="group" aria-roledescription="diapositivo" aria-label={`${items.findIndex(v => v.slug === vehicle.slug) + 1} de ${items.length}`}>
          {@render card(publicCard(vehicle), index, false)}
        </div>{/each}
        {#if loops}<div class="slide ghost" inert aria-hidden="true">{@render card(publicCard(ordered[0]!), 0, false)}</div>{/if}
      </div>
    </div>
    {#if loops}<div class="integrated-controls" role="group" aria-label="Navegação integrada das sugestões">
      <button type="button" aria-label="Viatura anterior · navegação integrada" onclick={() => move(-1)}><ArrowLeft size={19} aria-hidden="true" /></button>
      <button type="button" aria-label="Viatura seguinte · navegação integrada" onclick={() => move(1)}><ArrowRight size={19} aria-hidden="true" /></button>
    </div>{/if}
    </div>
    <span class="sr-only" aria-live="polite" aria-atomic="true">{announcement}</span>
  </div>
{/if}

<style>
  .carousel { margin-top: 24px; --gap: 20px; }
  .controls { display: flex; align-items: center; justify-content: flex-end; gap: 10px; margin-bottom: 18px; }
  .controls > span { margin-right: 8px; color: var(--muted); font-size: 12px; font-variant-numeric: tabular-nums; }
  .carousel-stage {position:relative;container-type:inline-size;--related-slot:calc((100cqw - 3 * var(--gap)) / 3.22);--related-photo-ratio:1.55;}
  .looping .viewport {margin-inline:0;padding-inline:0;}
  .integrated-controls {position:absolute;z-index:3;inset:0;pointer-events:none;}
  .integrated-controls button {position:absolute;top:calc(16px + var(--related-slot) / var(--related-photo-ratio) / 2);transform:translateY(-50%);pointer-events:auto;}
  .integrated-controls button:first-child {left:8px;}
  .integrated-controls button:last-child {right:8px;}
  button { display: grid; place-items: center; width: 44px; height: 44px; border: 1px solid color-mix(in srgb, var(--text) 30%, transparent); border-radius: 50%; color: var(--text); background: var(--surface); cursor: pointer; }
  button:last-child { background: var(--text); color: var(--bg); border-color: var(--text); }
  button:hover { border-color: var(--text); background: color-mix(in srgb, var(--text) 12%, var(--surface)); }
  button:last-child:hover { background: var(--red); border-color: var(--red); color: #fff; }
  button:focus-visible, .viewport:focus-visible { outline: 2px solid var(--text); outline-offset: 3px; }
  .viewport { position: relative; overflow: clip; touch-action: pan-y; margin: -12px -12px; padding: 16px 12px 24px; }
  /* Paint shadows/focus outside the frame without changing card geometry. */
  .looping .viewport {overflow-clip-margin:32px;}
  .ghost {visibility:hidden;}
  .moving .ghost {visibility:visible;}
  .looping .viewport::after { content: ''; position: absolute; z-index: 2; inset: 0 -32px 0 auto; width: calc(clamp(42px, 6vw, 86px) + 32px); pointer-events: none; background: linear-gradient(to right, transparent, color-mix(in srgb, var(--bg) 25%, transparent) 35%, color-mix(in srgb, var(--bg) 75%, transparent) 75%, var(--bg)); }
  .track { display: flex; align-items: stretch; gap: var(--gap); }
  .slide { flex: 0 0 calc((100% - 3 * var(--gap)) / 3.22); min-width: 0; }
  .slide :global(.vehicle-card) { height: 100%; }
  .static .slide { flex-basis: calc((100% - (var(--count) - 1) * var(--gap)) / var(--count)); max-width: 440px; }
  .sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }
  @media (min-width: 701px) and (max-width: 1000px) { .slide { flex-basis: calc((100% - 2 * var(--gap)) / 2.2); } .carousel-stage {--related-slot:calc((100cqw - 2 * var(--gap)) / 2.2);} }
  @media (max-width: 700px) { .carousel { --gap: 16px; } .carousel-stage {--related-slot:calc(100cqw * .86);--related-photo-ratio:1.45;} .slide { flex-basis: 86%; } .static .slide { flex-basis: 100%; } }
</style>
