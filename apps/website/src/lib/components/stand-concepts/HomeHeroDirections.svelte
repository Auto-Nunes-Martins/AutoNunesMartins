<script lang="ts">
  import { ArrowUpRight, ArrowDown, ArrowLeft, ArrowRight } from 'lucide-svelte';
  import type { PublicHighlights } from '$lib/homepageHighlights';
  import { publicPhoto, publicHref, publicPrice, fuelLabels } from '$lib/publicVehicles';
  import { sizedPhoto, vehiclePhotoSet } from '$lib/vehiclePhotoSources';
  import { catalogPlaceholder } from '$lib/localAssets';
  import { usePublicTheme } from '$lib/publicTheme';
  import roadWide from '$lib/assets/images/hero-directions/road-approved-1860.webp?url&no-inline';
  import roadWideSmall from '$lib/assets/images/hero-directions/road-approved-1280.webp?url&no-inline';
  import roadPortrait from '$lib/assets/images/hero-directions/road-approved-mobile-1086.webp?url&no-inline';
  import roadPortraitSmall from '$lib/assets/images/hero-directions/road-approved-mobile-640.webp?url&no-inline';
  import { heroBackgrounds } from './homeHeroBackgrounds';
  import './homeHeroDirections.css';
  import './homeHeroVariants.css';
  import './featuredHover.css';
  import './featuredCard.css';
  import { hoveringCard } from './v5HoveringCard';
  import FeaturedPriceWave from './FeaturedPriceWave.svelte';
  import FeaturedBacklight from './FeaturedBacklight.svelte';
  import { featuredAutoplay } from './featuredAutoplay';

  let { version, homeHighlights }: { version: number; homeHighlights?: PublicHighlights } =
    $props();
  const { dark } = usePublicTheme();
  const items = $derived(homeHighlights?.items ?? []);
  let index = $state(0);
  let selection = $state(0);
  let automaticChange = $state(false);
  let failed = $state(false);
  const active = $derived(items[index] ?? items[0]);
  const car = $derived(active?.vehicle);
  const image = $derived(active ? publicPhoto(active.vehicle.slug, active.photoIndex) : '');
  const copy = [
    'Há mais caminho',
    'pela frente.',
    'Encontre o carro que acompanha os seus planos. Sem pressas.',
  ];
  const background = $derived(heroBackgrounds[version]);
  function anchorStart(node: HTMLElement) {
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const measure = () => {
      const bounds = node.getBoundingClientRect();
      const side = version === 7 ? 18 : 0;
      node.style.setProperty('--v1-anchor-start', `${bounds.top + scrollY}px`);
      node.style.setProperty('--v1-canvas-left', `${bounds.left - side}px`);
      node.style.setProperty('--v1-canvas-width', `${bounds.width + side * 2}px`);
      node.style.setProperty('--v1-canvas-height', `${bounds.height}px`);
      const photo = node.querySelector<HTMLElement>('.hd-photo-stage');
      if (photo) {
        let left = 0;
        let top = 0;
        let element: HTMLElement | null = photo;
        while (element && element !== node) {
          left += element.offsetLeft;
          top += element.offsetTop;
          element = element.offsetParent as HTMLElement | null;
        }
        node.style.setProperty('--v5-photo-left', `${left}px`);
        node.style.setProperty('--v5-photo-top', `${top}px`);
        node.style.setProperty('--v5-photo-width', `${photo.offsetWidth}px`);
        node.style.setProperty('--v5-photo-height', `${photo.offsetHeight}px`);
      }
      node.dataset.canvasPinned = String(!reduced.matches && CSS.supports('clip-path', 'inset(0)'));
    };
    const resize = new ResizeObserver(measure);
    resize.observe(node);
    window.addEventListener('resize', measure);
    reduced.addEventListener('change', measure);
    measure();
    return {
      destroy() {
        resize.disconnect();
        window.removeEventListener('resize', measure);
        reduced.removeEventListener('change', measure);
      },
    };
  }
  $effect(() => {
    if (index >= items.length) index = 0;
  });
  $effect(() => {
    image;
    failed = false;
  });
  function select(next: number, automatic = false) {
    if (items.length) {
      index = (next + items.length) % items.length;
      automaticChange = automatic;
      selection += 1;
    }
  }
  function keyboard(event: KeyboardEvent) {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    if (event.key === 'Home') select(0);
    else if (event.key === 'End') select(items.length - 1);
    else select(index + (event.key === 'ArrowRight' ? 1 : -1));
  }
</script>

{#snippet introduction()}
  <div class="hd-copy">
    <span class="hd-eyebrow"><i aria-hidden="true"></i> Auto Nunes Martins</span>
    <h1 id="hd-title">
      <span class="hd-v1-title-line"><span>{copy[0]}</span></span>
      <span class="hd-v1-title-line"><em>{copy[1]}</em></span>
    </h1>
    <p>{copy[2]}</p>
    <a class="hd-explore" href="/viaturas"
      >Explorar viaturas <ArrowUpRight size={19} aria-hidden="true" /></a
    >
  </div>
{/snippet}

{#snippet vehicle()}
  {#if car}
    {#snippet featuredContent()}
      <div class="hd-feature-top">
        <span class="hd-eyebrow">Em destaque<span class="hd-label-glint" aria-hidden="true">Em destaque</span></span><span class="hd-edition" aria-hidden="true"
          >{String(index + 1).padStart(2, '0')} / {String(items.length).padStart(2, '0')}</span
        >
      </div>
      {#snippet photoDetails()}
        {#if failed}<span class="hd-photo-note">Fotografia temporariamente indisponível</span>{/if}
        <span class="hd-photo-arrow" aria-hidden="true"><ArrowUpRight size={22} strokeWidth={1.5} /></span>
      {/snippet}
      {#snippet photograph()}
      <a
        class="hd-photo"
        class:hd-photo-failed={failed}
        href={publicHref(car.slug)}
        aria-label={`Conhecer ${car.brand} ${car.model}`}
      >
        {#key image}
          <img
            src={failed ? catalogPlaceholder : sizedPhoto(image, 1600)}
            srcset={failed ? undefined : vehiclePhotoSet(image)}
            sizes="(max-width: 700px) 100vw, 55vw"
            width="1600"
            height="1067"
            alt={`${car.brand} ${car.model}`}
            fetchpriority="high"
            decoding="async"
            onerror={() => {
              failed = true;
            }}
          />
        {/key}
      </a>
      {/snippet}
      <div class="hd-photo-stage">
        <div class="hd-photo-motion"><div class="hd-idle-plane">{@render photograph()}</div></div>
        <div class="hd-photo-ui">{@render photoDetails()}</div>
      </div>
      <div class="hd-caption" id="hd-vehicle-caption">
        <div class="hd-identity">
          <span class="hd-brand">{car.brand}</span>
          <h2><a href={publicHref(car.slug)}>{car.model}</a></h2>
          <p>
            {car.year} <span>·</span>
            {new Intl.NumberFormat('pt-PT').format(car.mileage)} km <span>·</span>
            {fuelLabels[car.fuel]}
          </p>
        </div>
        <div class="hd-price">
          <strong><FeaturedPriceWave value={publicPrice(car.price)} /></strong>{#if car.availability === 'RESERVED'}<span
              >Reservada</span
            >{/if}<a href={publicHref(car.slug)}
            >Conhecer viatura <ArrowUpRight size={15} aria-hidden="true" /></a
          >
        </div>
      </div>
      {#if items.length > 1}
        <div class="hd-controls" role="group" aria-label="Navegar pelos destaques">
          <button
            type="button"
            aria-label="Destaque anterior"
            aria-controls="hd-vehicle-caption"
            onclick={() => select(index - 1)}
            onkeydown={keyboard}><ArrowLeft size={17} aria-hidden="true" /></button
          >
          <div class="hd-progress" aria-hidden="true">
            {#each items as _, position}<span class:hd-current={position === index}></span>{/each}
          </div>
          <button
            type="button"
            aria-label="Destaque seguinte"
            aria-controls="hd-vehicle-caption"
            onclick={() => select(index + 1)}
            onkeydown={keyboard}><ArrowRight size={17} aria-hidden="true" /></button
          >
        </div>
      {/if}
      <span class="hd-sr" role="status" aria-live={automaticChange ? 'off' : 'polite'} aria-atomic="true"
        >Destaque {index + 1} de {items.length}: {car.brand}
        {car.model}. {publicPrice(car.price)}{car.availability === 'RESERVED'
          ? '. Reservada'
          : ''}.</span
      >
    {/snippet}
    <div
      class="hd-feature"
      use:hoveringCard={true}
      use:featuredAutoplay={{ count: items.length, revision: selection, next: () => select(index + 1, true) }}
      role="region"
      aria-label="Viaturas em destaque"
      aria-roledescription="carrossel"
    >
      {@render featuredContent()}
    </div>
  {:else}
    <div class="hd-empty">
      <span class="hd-eyebrow">A sua próxima escolha</span>
      <h2>Vamos descobrir?</h2>
      <p>Consulte o catálogo para conhecer as viaturas disponíveis.</p>
      <a class="hd-explore" href="/viaturas"
        >Ver viaturas <ArrowUpRight size={19} aria-hidden="true" /></a
      >
    </div>
  {/if}
{/snippet}

<section
  class="hero-v1 hd-root hd-1"
  data-photo-variant={version}
  data-featured-card="v5"
  style:--road-focus={background?.focus}
  style:--road-mobile-focus={background?.mobileFocus}
  class:hd-dark={$dark}
  aria-labelledby="hd-title"
  use:anchorStart
>
  <div class="hd-landscape" aria-hidden="true">
    <picture>
      <source
        media="(max-width: 700px)"
        srcset={background?.portrait ?? `${roadPortraitSmall} 640w, ${roadPortrait} 1086w`}
        sizes="max(100vw, 90vh)"
      />
      <img
        src={background?.src ?? roadWide}
        srcset={background?.desktop ?? `${roadWideSmall} 1280w, ${roadWide} 1860w`}
        sizes="max(100vw, 200vh)"
        width={background?.width ?? 1860}
        height={background?.height ?? 846}
        alt=""
        fetchpriority="high"
        decoding="async"
      />
    </picture>
  </div>
  {#if car}<div class="hd-feature-light" aria-hidden="true"><FeaturedBacklight /></div>{/if}
  <div class="hd-composition">
    {@render introduction()}
    {@render vehicle()}
  </div>
  <a class="hd-scroll" href="#selecao"
    ><span>Continue a descobrir</span><ArrowDown
      size={16}
      strokeWidth={1.5}
      aria-hidden="true"
    /></a
  >
</section>
