<script lang="ts">
  import { ArrowUpRight, ArrowLeft, ChevronRight } from 'lucide-svelte';
  import type { UnavailableVehicle } from '$lib/unavailableVehicle';
  import OrbitBackLink from './OrbitBackLink.svelte';
  let { vehicle }: { vehicle: UnavailableVehicle } = $props();
  let failedPhoto = $state<string | null>(null);
  const hasPhoto = $derived(!!vehicle.photo && failedPhoto !== vehicle.photo);
</script>

<section class="unavailable-vehicle" class:without-photo={!hasPhoto}>
  <div class="top-home"><OrbitBackLink href="/" label="Página inicial" /></div>
  <nav class="unavailable-breadcrumbs" aria-label="Percurso de navegação">
    <ol>
      <li><a href="/">Início</a></li>
      <li><ChevronRight size={12} aria-hidden="true" /><a href="/viaturas">Viaturas</a></li>
      <li>
        <ChevronRight size={12} aria-hidden="true" /><span aria-current="page"
          >{vehicle.brand} {vehicle.model}</span
        >
      </li>
    </ol>
  </nav>
  {#if hasPhoto}
    <div class="inactive-image">
      <img
        src={vehicle.photo!}
        alt={`${vehicle.brand} ${vehicle.model}, ${vehicle.year}`}
        onerror={() => (failedPhoto = vehicle.photo)}
      />
      <span class="inactive-badge"><span aria-hidden="true"></span>Já não disponível</span>
      <span class="image-caption" aria-hidden="true">{vehicle.year}</span>
    </div>
  {/if}
  <div class="inactive-copy">
    <p class="eyebrow">JÁ NÃO ESTÁ DISPONÍVEL</p>
    <h1>{vehicle.brand}<br /><span>{vehicle.model}</span></h1>
    <p class="year">{vehicle.year}</p>
    {#if vehicle.summary}<p class="summary">{vehicle.summary}</p>{/if}
  </div>
  <div class="inactive-next">
    <h2>Esta viatura já não está disponível.</h2>
    <p class="explanation">
      Explore a seleção atual e descubra outras opções para a sua próxima escolha.
    </p>
    <div class="next-actions">
      <a class="home" href="/"><ArrowLeft size={14} aria-hidden="true" />Página inicial</a>
      <a class="explore" href="/viaturas"
        >Explorar viaturas <ArrowUpRight size={18} aria-hidden="true" /></a
      >
    </div>
  </div>
</section>

<style>
  .top-home {
    grid-column: 1 / -1;
    margin-bottom: -22px;
  }
  .unavailable-breadcrumbs {
    grid-column: 1 / -1;
    min-width: 0;
    color: var(--muted);
    font-size: 12px;
    line-height: 1.6;
  }
  .unavailable-breadcrumbs ol {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px 12px;
    padding: 0;
    margin: 0;
    list-style: none;
  }
  .unavailable-breadcrumbs li {
    display: inline-flex;
    align-items: center;
    gap: 12px;
    min-width: 0;
  }
  .unavailable-breadcrumbs :global(svg) {
    flex-shrink: 0;
  }
  .unavailable-breadcrumbs a {
    color: inherit;
    text-decoration: none;
  }
  .unavailable-breadcrumbs a:hover {
    color: var(--text);
    text-decoration: underline;
    text-underline-offset: 3px;
  }
  .unavailable-breadcrumbs span {
    color: var(--text);
    overflow-wrap: anywhere;
  }
  .unavailable-vehicle {
    display: grid;
    grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr);
    align-items: center;
    column-gap: clamp(32px, 6vw, 90px);
    row-gap: 38px;
    max-width: 1120px;
    margin: 0;
    padding-block: 0 30px;
  }
  .inactive-image {
    position: relative;
    aspect-ratio: 16/11;
    overflow: hidden;
    border-radius: 6px;
    background: var(--surface);
  }
  .inactive-image img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    opacity: 0.48;
  }
  .inactive-badge {
    position: absolute;
    z-index: 1;
    top: 16px;
    left: 16px;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 8px 11px;
    border-radius: 3px;
    background: #141414dc;
    color: #eeeee9;
    font-size: 11px;
    line-height: 1.4;
  }
  .inactive-badge > span {
    width: 5px;
    height: 5px;
    background: #a8a8a4;
    border-radius: 50%;
  }
  .image-caption {
    position: absolute;
    z-index: 1;
    bottom: 18px;
    left: 20px;
    color: #f4f4ef;
    font-size: 12px;
  }
  .eyebrow {
    color: var(--muted);
    font-size: 10px;
    letter-spacing: 0.14em;
    margin: 0 0 20px;
  }
  h1 {
    margin: 0;
    font-size: clamp(34px, 4vw, 56px);
    font-weight: 500;
    line-height: 1.08;
    letter-spacing: -0.05em;
    color: var(--text);
    overflow-wrap: anywhere;
  }
  h1 span {
    color: var(--muted);
  }
  .year {
    margin: 14px 0 0;
    font-size: 13px;
    color: var(--muted);
  }
  .explanation {
    margin: 0 0 22px;
    font-size: 15px;
    line-height: 1.8;
    color: var(--muted);
  }
  .explore {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 20px;
    min-height: 46px;
    padding: 12px 20px;
    border-radius: 999px;
    background: var(--red);
    color: #fff;
    font-size: 13px;
    font-weight: 500;
    text-decoration: none;
    transition:
      background-color 160ms,
      transform 160ms;
  }
  .explore:hover {
    background: color-mix(in oklab, var(--red) 85%, black);
    transform: translateY(-2px);
  }
  .home {
    display: flex;
    width: fit-content;
    align-items: center;
    gap: 12px;
    min-height: 46px;
    padding: 12px 20px;
    background: #fff;
    border-radius: 999px;
    margin-top: 0;
    color: #171717;
    font-size: 13px;
    text-decoration: none;
  }
  .home:hover {
    color: #171717;
    background: #e9e9e5;
  }
  a:focus-visible {
    outline: 2px solid var(--red);
    outline-offset: 4px;
  }
  .without-photo {
    grid-template-columns: minmax(0, 1fr);
    max-width: 700px;
  }
  .summary {
    max-width: 38ch;
    margin: 24px 0 0;
    color: var(--muted);
    font-size: 15px;
    line-height: 1.8;
  }
  .inactive-next {
    grid-column: 1/-1;
    text-align: left;
    padding-top: 28px;
    border-top: 1px solid var(--line);
  }
  .next-actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: flex-start;
    gap: 12px 28px;
  }
  .inactive-next h2 {
    margin: 0 0 12px;
    font-size: clamp(24px, 2.6vw, 34px);
    font-weight: 500;
    line-height: 1.2;
    letter-spacing: -0.035em;
    color: var(--text);
  }
  @media (max-width: 700px) {
    .unavailable-vehicle {
      grid-template-columns: minmax(0, 1fr);
      gap: 30px;
      padding-block: 0 20px;
    }
    .inactive-image {
      aspect-ratio: 16/10;
      max-height: 300px;
    }
    h1 {
      font-size: 36px;
    }
    .eyebrow {
      margin-bottom: 15px;
    }
    .explanation {
      margin-block: 18px;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .explore {
      transition: none;
    }
    .explore:hover {
      transform: none;
    }
  }
</style>
