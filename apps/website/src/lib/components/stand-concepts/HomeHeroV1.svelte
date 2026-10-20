<script lang="ts">
  import { tick } from 'svelte';
  import { ArrowUpRight, ArrowLeft, ArrowRight } from 'lucide-svelte';
  import type { PublicHighlights } from '$lib/homepageHighlights';
  import { publicPhoto, publicHref, publicPrice } from '$lib/publicVehicles';
  import { usePublicTheme } from '$lib/publicTheme';
  import HomeHeroV1Photo from './HomeHeroV1Photo.svelte';
  import backgroundAvif1280 from '$lib/assets/images/hero-v1/ambience-1280.avif?url&no-inline';
  import backgroundAvif1920 from '$lib/assets/images/hero-v1/ambience-1920.avif?url&no-inline';
  import backgroundAvif2172 from '$lib/assets/images/hero-v1/ambience-2172.avif?url&no-inline';
  import backgroundWebp1280 from '$lib/assets/images/hero-v1/ambience-1280.webp?url&no-inline';
  import backgroundWebp1920 from '$lib/assets/images/hero-v1/ambience-1920.webp?url&no-inline';
  import backgroundWebp2172 from '$lib/assets/images/hero-v1/ambience-2172.webp?url&no-inline';
  import './homeHeroV1.css';

  let { homeHighlights }: { homeHighlights?: PublicHighlights } = $props();
  const { dark } = usePublicTheme();
  const items = $derived(homeHighlights?.items ?? []);
  let index = $state(0);
  const active = $derived(items[index] ?? items[0]);
  const current = $derived(active?.vehicle);
  const demo = $derived(current?.description?.includes('[DADOS FICTÍCIOS DE TESTE]') ?? false);
  const selectors: HTMLButtonElement[] = [];
  const ordinal = (value: number) => String(value).padStart(2, '0');
  const backgroundSizes = '(max-width: 700px) 2400px, (max-width: 1050px) 2340px, 100vw';
  let touchStart: { x: number; y: number } | null = null;
  let swiped = false;

  $effect(() => {
    if (index >= items.length) index = 0;
  });
  function select(next: number) {
    if (items.length) index = (next + items.length) % items.length;
  }
  async function keyboard(event: KeyboardEvent, moveFocus = false) {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key) || items.length < 2) return;
    event.preventDefault();
    if (event.key === 'Home') select(0);
    else if (event.key === 'End') select(items.length - 1);
    else select(index + (event.key === 'ArrowRight' ? 1 : -1));
    if (moveFocus) {
      await tick();
      selectors[index]?.focus({ preventScroll: true });
    }
  }
  function touchDown(event: PointerEvent) {
    swiped = false;
    touchStart = event.pointerType === 'touch' ? { x: event.clientX, y: event.clientY } : null;
  }
  function touchUp(event: PointerEvent) {
    if (!touchStart) return;
    const x = event.clientX - touchStart.x,
      y = event.clientY - touchStart.y;
    touchStart = null;
    if (Math.abs(x) > 55 && Math.abs(x) > Math.abs(y) * 1.5 && items.length > 1) {
      swiped = true;
      select(index + (x < 0 ? 1 : -1));
    }
  }
</script>

<section class="hero-v1" class:v1-dark={$dark} aria-labelledby="v1-home-title">
  <h1 id="v1-home-title" class="v1-sr-only">Auto Nunes Martins — viaturas em destaque</h1>
  <picture class="v1-background" aria-hidden="true">
    <source
      type="image/avif"
      srcset={`${backgroundAvif1280} 1280w, ${backgroundAvif1920} 1920w, ${backgroundAvif2172} 2172w`}
      sizes={backgroundSizes}
    />
    <img
      src={backgroundWebp2172}
      srcset={`${backgroundWebp1280} 1280w, ${backgroundWebp1920} 1920w, ${backgroundWebp2172} 2172w`}
      sizes={backgroundSizes}
      width="2172"
      height="724"
      alt=""
      fetchpriority="high"
      decoding="async"
    />
  </picture>
  <div class="v1-inner">
    {#if current}
      <div
        class="v1-showcase"
        role="region"
        aria-roledescription="carrossel"
        aria-label="Viaturas em destaque"
      >
        <div class="v1-card-heading">
          <span class="v1-feature-label"><span aria-hidden="true"></span> Em destaque</span>
          <a class="v1-catalog-link" href="/viaturas"
            >Ver todas <ArrowUpRight size={14} strokeWidth={1.6} aria-hidden="true" /></a
          >
        </div>
        <a
          class="v1-image-link"
          href={publicHref(current.slug)}
          aria-label={`Ver ${current.brand} ${current.model}`}
          onpointerdown={touchDown}
          onpointerup={touchUp}
          onpointercancel={() => {
            touchStart = null;
          }}
          onclick={(event) => {
            if (swiped && event.detail > 0) event.preventDefault();
            swiped = false;
          }}
          onkeydown={(event) => keyboard(event)}
        >
          {#each items as item, position (`${item.vehicle.slug}:${item.photoIndex}`)}
            <span class="v1-image-layer" class:v1-active={position === index} aria-hidden="true">
              <HomeHeroV1Photo
                src={publicPhoto(item.vehicle.slug, item.photoIndex)}
                main
                eager={position === 0}
              />
            </span>
          {/each}
          {#if demo}<span class="v1-demo-note">Fotografia ilustrativa</span>{/if}
        </a>
        <div class="v1-information" id="v1-feature-details">
          <div class="v1-identity">
            <span class="v1-brand">{current.brand}</span>
            <h2><a href={publicHref(current.slug)}>{current.model}</a></h2>
            {#if current.specifications?.version}<p class="v1-version">
                {current.specifications.version}
              </p>{/if}
          </div>
          <div class="v1-price">
            {#if current.availability === 'RESERVED'}<span>Reservada</span>{/if}
            <strong>{publicPrice(current.price)}</strong>
            <span>{demo ? 'Demonstração' : current.year}</span>
          </div>
        </div>
        <div class="v1-card-footer">
          {#if items.length > 1}
            <div class="v1-arrows" role="group" aria-label="Navegar pelos destaques">
              <button
                type="button"
                aria-label="Destaque anterior"
                aria-controls="v1-feature-details"
                onclick={() => select(index - 1)}
                onkeydown={(event) => keyboard(event)}
                ><ArrowLeft size={17} strokeWidth={1.5} aria-hidden="true" /></button
              >
              <span class="v1-counter" aria-hidden="true"
                >{ordinal(index + 1)} <span>/ {ordinal(items.length)}</span></span
              >
              <button
                type="button"
                aria-label="Destaque seguinte"
                aria-controls="v1-feature-details"
                onclick={() => select(index + 1)}
                onkeydown={(event) => keyboard(event)}
                ><ArrowRight size={17} strokeWidth={1.5} aria-hidden="true" /></button
              >
            </div>
          {/if}
          <a class="v1-detail-link" href={publicHref(current.slug)}
            >Conhecer viatura <ArrowUpRight size={17} strokeWidth={1.5} aria-hidden="true" /></a
          >
        </div>
        {#if items.length > 1}
          <div
            class="v1-selection"
            role="group"
            aria-label="Escolher viatura em destaque"
            style={`--v1-total:${items.length}`}
          >
            {#each items as item, position (item.vehicle.slug)}
              <button
                bind:this={selectors[position]}
                type="button"
                class="v1-selection-item"
                class:v1-selected={position === index}
                aria-label={`Mostrar ${item.vehicle.brand} ${item.vehicle.model}, destaque ${position + 1} de ${items.length}`}
                aria-pressed={position === index}
                aria-controls="v1-feature-details"
                onclick={() => select(position)}
                onkeydown={(event) => keyboard(event, true)}
                ><span aria-hidden="true"></span></button
              >
            {/each}
          </div>
        {/if}
        <p class="v1-sr-only" role="status" aria-live="polite" aria-atomic="true">
          Destaque {index + 1} de {items.length}: {current.brand}
          {current.model}. {publicPrice(current.price)}.
        </p>
      </div>
    {:else}
      <div class="v1-showcase v1-empty">
        <span class="v1-feature-label"><span aria-hidden="true"></span> Auto Nunes Martins</span>
        <h2>O próximo é seu.</h2>
        <a class="v1-detail-link" href="/viaturas"
          >Explorar viaturas <ArrowUpRight size={18} aria-hidden="true" /></a
        >
      </div>
    {/if}
  </div>
</section>
