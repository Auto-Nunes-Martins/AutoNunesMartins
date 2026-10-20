<script lang="ts">
  import { logoLight, logoDark, logoLightSrcset, logoDarkSrcset } from '$lib/localAssets';
  import { highlightSlides, type PublicHighlights } from '$lib/homepageHighlights';
  import { usePublicTheme } from '$lib/publicTheme';
  import { vehiclePhoto } from '$lib/vehiclePhoto';
  import { photo, number } from './data';
  import { responsivePhoto, heroImageSizes } from './images';
  import { ArrowUpRight, ArrowLeft, ArrowRight } from 'lucide-svelte';
  import HomeHeroV2Backdrop from './HomeHeroV2Backdrop.svelte';
  import { homeHeroV2Motion } from './homeHeroV2Motion';
  import './homeHeroV2.css';
  let {
    homeHighlights,
    hasAddress = false,
  }: { homeHighlights?: PublicHighlights; hasAddress?: boolean } = $props();
  const { dark } = usePublicTheme();
  const isDark = $derived($dark);
  let heroIndex = $state(0);
  const heroSlides = $derived(homeHighlights ? highlightSlides(homeHighlights) : []);
  const heroCar = $derived(heroSlides[heroIndex] ?? heroSlides[0]);
  $effect(() => {
    if (heroIndex >= heroSlides.length) heroIndex = 0;
  });
  function changeHeroSlide(direction: number) {
    if (heroSlides.length)
      heroIndex = (heroIndex + direction + heroSlides.length) % heroSlides.length;
  }
  function heroKeydown(event: KeyboardEvent) {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    if (event.key === 'Home') heroIndex = 0;
    else if (event.key === 'End') heroIndex = Math.max(0, heroSlides.length - 1);
    else changeHeroSlide(event.key === 'ArrowRight' ? 1 : -1);
  }
</script>

<!-- V2 is active, independently styled and independently animated. No V1 scene hooks. -->
<div class="hero-v2" class:hero-v2-has-address={hasAddress} use:homeHeroV2Motion>
  <section
    class="v2-orbit-intro"
    data-v2-scene
    data-v2-scroll-hero
    aria-label="Viaturas em destaque"
    aria-roledescription="carrossel"
  >
    <div class="v2-orbit-stage" data-v2-hero-stage>
      <HomeHeroV2Backdrop />
      <div class="v2-orbit-topline">
        <span class="v2-kicker v2-hero-kicker"
          ><span class="v2-hero-kicker-dot"
            ><span class="v2-red-dot" aria-hidden="true"></span></span
          ><span
            >AUTOMÓVEIS USADOS.<span class="v2-hero-kicker-complement">NOVAS HISTÓRIAS.</span></span
          ></span
        ><span class="v2-kicker">PORTUGAL / SELEÇÃO AUTOMÓVEL</span>
      </div>
      <div class="v2-orbit-copy">
        <img
          class="v2-orbit-hero-signature"
          data-logo-light={logoLight}
          data-logo-dark={logoDark}
          data-logo-light-srcset={logoLightSrcset}
          data-logo-dark-srcset={logoDarkSrcset}
          data-theme-logo=""
          src={isDark ? logoDark : logoLight}
          srcset={isDark ? logoDarkSrcset : logoLightSrcset}
          sizes="(max-width: 700px) 336px, (min-width: 1477px) 572px, (min-width: 973px) 38.7vw, 377px"
          alt="Auto Nunes Martins"
          width="1881"
          height="836"
        />
        <h1 class="v2-orbit-title">
          O próximo<br /><span>é seu<span class="v2-hero-period">.</span></span>
        </h1>
        <p class="v2-orbit-title-note">
          O carro certo para os seus dias.<br />Escolhido ao seu ritmo.
        </p>
      </div>
      <div class="v2-orbit-object">
        <div class="v2-object-edge"></div>
        {#if heroCar}
          <a
            class="v2-orbit-main-photo"
            id="v2-orbit-featured"
            href={heroCar.href}
            aria-labelledby="v2-featured-vehicle-caption"
            aria-describedby={heroCar.illustrative ? 'v2-featured-image-note' : undefined}
          >
            {#each heroSlides as featured, index (featured.id)}
              <img
                use:vehiclePhoto={{
                  src: photo(featured.image, 1800),
                  srcset: responsivePhoto(featured.image),
                }}
                class:v2-active={heroIndex === index}
                src={photo(featured.image, 1800)}
                srcset={responsivePhoto(featured.image)}
                sizes={heroImageSizes}
                alt=""
                aria-hidden="true"
                loading={index === 0 ? 'eager' : 'lazy'}
                fetchpriority={index === 0 ? 'high' : 'low'}
                decoding="async"
              />
            {/each}
            <span id="v2-featured-image-note" hidden
              >{heroCar.illustrative ? 'Fotografia ilustrativa.' : ''}</span
            >
            <span class="v2-featured-badge" aria-hidden="true">EM DESTAQUE</span>
            <div>
              <span id="v2-featured-vehicle-caption"
                >{heroCar.brand}
                {heroCar.model}{' '}<small>{heroCar.year} · {number(heroCar.km)} KM</small></span
              >
              <ArrowUpRight size={24} aria-hidden="true" />
            </div></a
          ><span class="v2-object-coordinate v2-coordinate-a" aria-hidden="true">EM DESTAQUE</span>
        {:else}
          <a class="v2-orbit-main-photo v2-hero-empty" id="v2-orbit-featured" href="/viaturas">
            <span>O seu próximo carro começa com uma escolha.</span>
            <div>
              <span>Conheça as nossas viaturas<small>CONSULTE O CATÁLOGO</small></span><ArrowUpRight
                size={24}
                aria-hidden="true"
              />
            </div>
          </a>
        {/if}
      </div>
      {#if heroCar}
        <div
          class="v2-orbit-side"
          role="group"
          aria-label="Navegar pelos destaques"
          style={`--v2-hero-progress:${(heroIndex + 1) / heroSlides.length}`}
        >
          <button
            type="button"
            aria-label="Destaque anterior"
            disabled={heroSlides.length < 2}
            aria-controls="v2-orbit-featured"
            onclick={() => changeHeroSlide(-1)}
            onkeydown={heroKeydown}><ArrowLeft size={18} aria-hidden="true" /></button
          >
          <div class="v2-hero-slide-index" aria-hidden="true">
            <span>{String(heroIndex + 1).padStart(2, '0')}</span>
            <span class="v2-hero-index-track"></span>
            <span>{String(heroSlides.length).padStart(2, '0')}</span>
          </div>
          <button
            type="button"
            aria-label="Destaque seguinte"
            disabled={heroSlides.length < 2}
            aria-controls="v2-orbit-featured"
            onclick={() => changeHeroSlide(1)}
            onkeydown={heroKeydown}><ArrowRight size={18} aria-hidden="true" /></button
          >
          <span class="v2-hero-status" role="status" aria-live="polite" aria-atomic="true">
            Destaque {heroIndex + 1} de {heroSlides.length}: {heroCar.brand}
            {heroCar.model}.
          </span>
        </div>
      {/if}
    </div>
  </section>
</div>
