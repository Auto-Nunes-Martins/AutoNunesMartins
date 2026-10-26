<script lang="ts">
  import { ArrowUpRight, ArrowDown, ArrowLeft, ArrowRight } from 'lucide-svelte';
  import type { PublicHighlights } from '$lib/homepageHighlights';
  import { publicPhoto, publicHref, publicPrice, fuelLabels } from '$lib/publicVehicles';
  import FeaturedPhoto from './FeaturedPhoto.svelte';
  import { sizedPhoto, vehiclePhotoSet } from '$lib/vehiclePhotoSources';
  import { usePublicTheme } from '$lib/publicTheme';
  import { heroBackgrounds } from './homeHeroBackgrounds';
  import './homeHeroDirections.css';
  import './homeHeroVariants.css';
  import './featuredHover.css';
  import './featuredCard.css';
  import { hoveringCard } from './v5HoveringCard';
  import FeaturedPriceWave from './FeaturedPriceWave.svelte';
  import FeaturedBacklight from './FeaturedBacklight.svelte';
  import { featuredAutoplay } from './featuredAutoplay';
  import { scrollCue } from './scrollCue';
  import { featuredPhotoSizes } from './images';
  import { scrollFrame, setScrollStyle } from './scrollFrame';
  import { mobileHeroImages } from '$lib/mobileHeroImages';
  import {
    narrowHeroMedia,
    compactHeroMedia,
    fullHeroMedia,
    narrowHeroSizes,
    compactHeroSizes,
    portraitHeroSizes,
  } from './mobileHero';

  const version = 5;
  let { homeHighlights }: { homeHighlights?: PublicHighlights } = $props();
  const { dark } = usePublicTheme();
  const items = $derived(homeHighlights?.items ?? []);
  let index = $state(0);
  let displayedIndex = $state(0);
  let selection = $state(0);
  let automaticChange = $state(false);
  let failed = $state(false);
  const active = $derived(items[displayedIndex] ?? items[0]);
  const requested = $derived(items[index] ?? items[0]);
  const car = $derived(active?.vehicle);
  const image = $derived(requested ? publicPhoto(requested.vehicle, requested.photoIndex) : '');
  const firstImage = $derived(items[0] ? publicPhoto(items[0].vehicle, items[0].photoIndex) : '');
  const copy = [
    'Há mais caminho',
    'pela frente.',
    'Encontre o carro que acompanha os seus planos. Sem pressas.',
  ];
  const background = heroBackgrounds[5];
  function anchorStart(node: HTMLElement) {
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const task = scrollFrame(() => {
      // Complete geometry reads before changing canvas styles or any label pivot.
      const bounds = node.getBoundingClientRect();
      const writes: [HTMLElement, string, string][] = [
        [node, '--v1-anchor-start', `${bounds.top + scrollY}px`],
        [node, '--v1-canvas-left', `${bounds.left}px`],
        [node, '--v1-canvas-width', `${bounds.width}px`],
        [node, '--v1-canvas-height', `${bounds.height}px`],
      ];
      const offset = (plane: HTMLElement) => {
        let left = 0;
        let top = 0;
        let element: HTMLElement | null = plane;
        while (element && element !== node) {
          left += element.offsetLeft;
          top += element.offsetTop;
          element = element.offsetParent as HTMLElement | null;
        }
        return { left, top };
      };
      const photo = node.querySelector<HTMLElement>('.hd-photo-stage');
      if (photo) {
        const { left, top } = offset(photo);
        const width = photo.offsetWidth;
        const height = photo.offsetHeight;
        writes.push(
          [node, '--v5-photo-left', `${left}px`],
          [node, '--v5-photo-top', `${top}px`],
          [node, '--v5-photo-width', `${width}px`],
          [node, '--v5-photo-height', `${height}px`],
        );
        for (const plane of node.querySelectorAll<HTMLElement>(
          '.hd-price-motion, .hd-label-motion',
        )) {
          const position = offset(plane);
          writes.push([
            plane,
            '--featured-pivot',
            `${left + width / 2 - position.left}px ${top + height / 2 - position.top}px`,
          ]);
        }
      }
      const pinned = String(!reduced.matches && CSS.supports('clip-path', 'inset(0)'));
      return () => {
        for (const [target, name, value] of writes) setScrollStyle(target, name, value);
        if (node.dataset.canvasPinned !== pinned) node.dataset.canvasPinned = pinned;
      };
    });
    const measure = () => task.schedule();
    const resize = new ResizeObserver(measure);
    resize.observe(node);
    for (const plane of node.querySelectorAll<HTMLElement>('.hd-price-motion, .hd-label-motion'))
      resize.observe(plane);
    window.addEventListener('resize', measure);
    reduced.addEventListener('change', measure);
    task.runNow(performance.now());
    return {
      destroy() {
        task.cancel();
        resize.disconnect();
        window.removeEventListener('resize', measure);
        reduced.removeEventListener('change', measure);
      },
    };
  }
  $effect(() => {
    if (index >= items.length) index = 0;
    if (displayedIndex >= items.length) displayedIndex = 0;
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

<svelte:head>
  <!-- Match each picture source exactly so preload discovery cannot download two variants. -->
  {#if car}
    <link
      rel="preload"
      as="image"
      type="image/avif"
      media={narrowHeroMedia}
      imagesrcset={mobileHeroImages[1200].avif}
      imagesizes={narrowHeroSizes}
      fetchpriority="high"
    />
    <link
      rel="preload"
      as="image"
      type="image/avif"
      media={compactHeroMedia}
      imagesrcset={mobileHeroImages[1440].avif}
      imagesizes={compactHeroSizes}
      fetchpriority="high"
    />
  {/if}
  <link
    rel="preload"
    as="image"
    type="image/avif"
    media={car ? fullHeroMedia : '(max-width: 700px)'}
    imagesrcset={background.avifPortrait}
    imagesizes={portraitHeroSizes}
    fetchpriority="high"
  />
  <link
    rel="preload"
    as="image"
    type="image/avif"
    media="(min-width: 701px)"
    imagesrcset={background.avifDesktop}
    imagesizes="(max-width: 1050px) max(105.5vw, 158.25vh), max(105.5vw, 131.875vh)"
    fetchpriority="high"
  />
  {#if firstImage}
    <link
      rel="preload"
      as="image"
      href={sizedPhoto(firstImage, 1600)}
      imagesrcset={vehiclePhotoSet(firstImage)}
      imagesizes={featuredPhotoSizes}
      fetchpriority="high"
    />
  {/if}
</svelte:head>

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
        <div class="hd-label-motion">
          <div class="hd-idle-plane"><span class="hd-eyebrow">Em destaque</span></div>
        </div>
        <span class="hd-edition" aria-hidden="true"
          >{String(displayedIndex + 1).padStart(2, '0')} / {String(items.length).padStart(
            2,
            '0',
          )}</span
        >
      </div>
      {#snippet photoDetails()}
        {#if failed}<span class="hd-photo-note">Fotografia temporariamente indisponível</span>{/if}
      {/snippet}
      {#snippet photograph()}
        <a
          class="hd-photo"
          class:hd-photo-failed={failed}
          href={publicHref(car.slug)}
          data-photo-count={car.photos.length}
          aria-label={`Conhecer ${car.brand} ${car.model}`}
        >
          <FeaturedPhoto
            source={image}
            alt={requested ? `${requested.vehicle.brand} ${requested.vehicle.model}` : ''}
            onfailure={(value) => (failed = value)}
            ondisplay={(source) => {
              if (source === image) displayedIndex = index;
            }}
          />
        </a>
      {/snippet}
      <div class="hd-photo-stage">
        <div class="hd-photo-motion"><div class="hd-idle-plane">{@render photograph()}</div></div>
        <div class="hd-photo-ui">{@render photoDetails()}</div>
        {#if items.length > 1}
          <button
            class="hd-photo-prev"
            type="button"
            aria-label="Ver viatura em destaque anterior"
            aria-controls="hd-vehicle-caption"
            disabled={index !== displayedIndex}
            onclick={() => select(displayedIndex - 1)}
            onkeydown={keyboard}
          >
            <svg
              class="featured-chevron"
              viewBox="0 0 24 32"
              width="36"
              height="48"
              fill="none"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                d="M16 5 8 16 16 27"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                vector-effect="non-scaling-stroke"
              />
            </svg>
          </button>
          <button
            class="hd-photo-next"
            type="button"
            aria-label="Ver próxima viatura em destaque"
            aria-controls="hd-vehicle-caption"
            disabled={index !== displayedIndex}
            onclick={() => select(displayedIndex + 1)}
            onkeydown={keyboard}
          >
            <svg
              class="featured-chevron"
              viewBox="0 0 24 32"
              width="36"
              height="48"
              fill="none"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                d="m8 5 8 11-8 11"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                vector-effect="non-scaling-stroke"
              />
            </svg>
          </button>
        {/if}
      </div>
      <div class="hd-caption" id="hd-vehicle-caption">
        <div class="hd-identity">
          <span class="hd-brand">{car.brand}</span>
          <h2>
            <a href={publicHref(car.slug)} data-photo-count={car.photos.length}>{car.model}</a>
          </h2>
          <p>
            {car.year} <span>·</span>
            {new Intl.NumberFormat('pt-PT').format(car.mileage)} km <span>·</span>
            {fuelLabels[car.fuel]}
          </p>
        </div>
        <div class="hd-price">
          <div class="hd-price-motion">
            <div class="hd-idle-plane">
              <strong
                ><FeaturedPriceWave value={publicPrice(car.price)} vehicle={car.slug} /></strong
              >
            </div>
          </div>
          {#if car.availability === 'RESERVED'}<span>Reservada</span>{/if}<a
            href={publicHref(car.slug)}
            data-photo-count={car.photos.length}
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
            disabled={index !== displayedIndex}
            onclick={() => select(index - 1)}
            onkeydown={keyboard}><ArrowLeft size={17} aria-hidden="true" /></button
          >
          <div class="hd-progress">
            {#each items as item, position}
              <button
                type="button"
                aria-label={`Ver destaque ${position + 1}: ${item.vehicle.brand} ${item.vehicle.model}`}
                aria-pressed={position === displayedIndex}
                aria-controls="hd-vehicle-caption"
                onclick={() => select(position)}
                onkeydown={keyboard}
              >
                <span class:hd-current={position === displayedIndex} aria-hidden="true"></span>
              </button>
            {/each}
          </div>
          <button
            type="button"
            aria-label="Destaque seguinte"
            aria-controls="hd-vehicle-caption"
            disabled={index !== displayedIndex}
            onclick={() => select(index + 1)}
            onkeydown={keyboard}><ArrowRight size={17} aria-hidden="true" /></button
          >
        </div>
      {/if}
      <span
        class="hd-sr"
        role="status"
        aria-live={automaticChange ? 'off' : 'polite'}
        aria-atomic="true"
        >Destaque {displayedIndex + 1} de {items.length}: {car.brand}
        {car.model}. {publicPrice(car.price)}{car.availability === 'RESERVED'
          ? '. Reservada'
          : ''}.</span
      >
    {/snippet}
    <div
      class="hd-feature"
      use:hoveringCard={true}
      use:featuredAutoplay={{
        count: items.length,
        revision: selection,
        ready: index === displayedIndex,
        next: () => select(displayedIndex + 1, true),
      }}
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
    <!-- Resolve the responsive source in the initial HTML. Include the entry's
         maximum 1.055 scale, without measuring its changing transformed bounds.
         The portrait also covers the stacked content on short phone screens. -->
    <picture>
      {#if car}
        <source
          type="image/avif"
          media={narrowHeroMedia}
          srcset={mobileHeroImages[1200].avif}
          sizes={narrowHeroSizes}
        />
        <source
          type="image/webp"
          media={narrowHeroMedia}
          srcset={mobileHeroImages[1200].webp}
          sizes={narrowHeroSizes}
        />
        <source
          type="image/avif"
          media={compactHeroMedia}
          srcset={mobileHeroImages[1440].avif}
          sizes={compactHeroSizes}
        />
        <source
          type="image/webp"
          media={compactHeroMedia}
          srcset={mobileHeroImages[1440].webp}
          sizes={compactHeroSizes}
        />
      {/if}
      <source
        type="image/avif"
        media="(max-width: 700px)"
        srcset={background.avifPortrait}
        sizes={portraitHeroSizes}
      />
      <source media="(max-width: 700px)" srcset={background.portrait} sizes={portraitHeroSizes} />
      <source
        type="image/avif"
        srcset={background.avifDesktop}
        sizes="(max-width: 1050px) max(105.5vw, 158.25vh), max(105.5vw, 131.875vh)"
      />
      <img
        src={background.src}
        srcset={background.desktop}
        sizes="(max-width: 1050px) max(105.5vw, 158.25vh), max(105.5vw, 131.875vh)"
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
  <a class="hd-scroll" href="#selecao" data-cue-paused="true" use:scrollCue
    ><span>Continue a descobrir</span><ArrowDown
      size={16}
      strokeWidth={1.5}
      aria-hidden="true"
    /></a
  >
</section>
