<script lang="ts">
  import { crmPath } from '$lib/paths';
  import { PUBLIC_BACKEND_URL } from '$env/static/public';
  import { publicVehiclePhotoUrl } from '$lib/publicVehiclePhoto';
  import { ArrowLeft, ArrowRight, Calendar, Fuel, Gauge, Star, Tag } from 'lucide-svelte';
  import type { DashboardHighlight } from '$lib/server/dashboard';
  import { formatEUR, formatInt } from '$lib/utils/format';
  import type { Snippet } from 'svelte';
  let {
    highlights,
    stockCount,
    salesThisMonth,
    revenueYtd,
    metrics,
  }: {
    highlights: DashboardHighlight[];
    stockCount?: number;
    salesThisMonth?: number;
    revenueYtd?: string | null;
    metrics?: Snippet;
  } = $props();
  let index = $state(0);
  let failedImages = $state<Record<string, boolean>>({});
  const current = $derived(highlights[index] ?? highlights[0]);
  const vehicle = $derived(current?.vehicle);
  const fuelLabels: Record<string, string> = {
    GASOLINE: 'Gasolina',
    DIESEL: 'Gasóleo',
    HYBRID: 'Híbrido',
    PLUGIN_HYBRID: 'Híbrido Plug-in',
    ELECTRIC: 'Elétrico',
    LPG: 'GPL',
  };
  $effect(() => {
    if (index >= highlights.length) index = 0;
  });
  function move(direction: number) {
    if (highlights.length) index = (index + direction + highlights.length) % highlights.length;
  }
  function compactEUR(value: string) {
    const n = Number(value);
    if (!Number.isFinite(n)) return '—';
    return Math.abs(n) >= 1_000_000
      ? `€${(n / 1_000_000).toFixed(1)}M`
      : Math.abs(n) >= 1_000
        ? `€${Math.round(n / 1_000)}k`
        : formatEUR(value);
  }
</script>

<section class="hero-block" aria-label="Destaques da homepage" aria-roledescription="carrossel">
  <div class="hero-copy">
    <p class="eyebrow"><span></span>Montra · Site público</p>
    {#if current && vehicle}
      <h2>{vehicle.brand}<br /><span>{vehicle.model}</span></h2>
      <p class="description">{vehicle.description || 'Viatura em destaque na homepage.'}</p>
      <div class="specs">
        <div>
          <Calendar size={21} /><span
            ><strong>{vehicle.year}</strong><small>Ano da viatura</small></span
          >
        </div>
        <div>
          <Gauge size={21} /><span
            ><strong>{formatInt(vehicle.mileage)} km</strong><small>Quilometragem anunciada</small
            ></span
          >
        </div>
        <div>
          <Tag size={21} /><span
            ><strong>{vehicle.price ? formatEUR(vehicle.price) : 'Preço sob consulta'}</strong
            ><small>Preço no site público</small></span
          >
        </div>
        <div>
          <Fuel size={21} /><span
            ><strong>{fuelLabels[vehicle.fuel] ?? vehicle.fuel}</strong><small
              >{vehicle.availability === 'RESERVED' ? 'Reservada' : 'Disponível'}</small
            ></span
          >
        </div>
      </div>
      <div class="links">
        <a class="primary" href={crmPath(`/viaturas/${current.id}`)}
          >Ver ficha completa <ArrowRight size={15} /></a
        ><a href={crmPath('/site/destaques')}>Gerir destaques</a>
      </div>
    {:else}
      <h2>Sem<br /><span>destaques.</span></h2>
      <p class="description">
        Escolha as viaturas e fotografias em «Site público». A mesma seleção aparece aqui e na
        homepage.
      </p>
      <div class="links">
        <a class="primary" href={crmPath('/site/destaques')}
          >Escolher destaques <ArrowRight size={15} /></a
        >
      </div>
    {/if}
  </div>
  <div class="hero-photo">
    {#if highlights.length}
      {#each highlights as entry, slide (entry.id)}
        {@const image = entry.vehicle.photos[entry.photoIndex]}
        {#if image}<img
            src={publicVehiclePhotoUrl(PUBLIC_BACKEND_URL, image, 1600)}
            srcset={[320, 800, 1600, 2560]
              .map(
                (width) => `${publicVehiclePhotoUrl(PUBLIC_BACKEND_URL, image, width)} ${width}w`,
              )
              .join(', ')}
            sizes="(max-width:1050px) 100vw, 800px"
            alt={`${entry.vehicle.brand} ${entry.vehicle.model}`}
            class:is-active={slide === index}
            aria-hidden={slide !== index}
            onerror={() => (failedImages[entry.id] = true)}
            onload={() => (failedImages[entry.id] = false)}
          />{/if}
      {/each}
    {:else}<div class="empty-photo">
        <Star size={52} /><span>A sua montra começa aqui</span>
      </div>{/if}
    <div class="photo-shade"></div>
    {#if current && failedImages[current.id]}<div class="empty-photo">
        <Star size={42} /><span>Fotografia indisponível</span>
      </div>{/if}
    <div class="photo-top">
      <span class="photo-label">Mesmas fotografias da homepage</span>
      <div class="stats">
        {#if metrics}{@render metrics()}{/if}
        {#if stockCount !== undefined}<span
            ><strong>{formatInt(stockCount)}</strong><small>Em stock</small></span
          >{/if}
        {#if salesThisMonth !== undefined}<span
            ><strong>{formatInt(salesThisMonth)}</strong><small>Vendas · Mês</small></span
          >{/if}
        {#if revenueYtd}<span
            ><strong>{compactEUR(revenueYtd)}</strong><small>Faturação YTD</small></span
          >{/if}
      </div>
    </div>
    {#if current && vehicle}<div class="photo-bottom">
        <span
          class="registration-plate"
          aria-label={current.licensePlate
            ? `Matrícula ${current.licensePlate}`
            : 'Matrícula não registada'}
        >
          <span class="plate-country" aria-hidden="true"
            ><span class="eu-stars"></span><span>P</span></span
          >
          <span class="plate-number" class:unregistered={!current.licensePlate}
            >{current.licensePlate ?? 'POR REGISTAR'}</span
          >
        </span>
        <div class="carousel-controls">
          <button
            type="button"
            aria-label="Destaque anterior"
            disabled={highlights.length < 2}
            onclick={() => move(-1)}><ArrowLeft size={18} /></button
          ><span
            >{String(index + 1).padStart(2, '0')}<small>
              / {String(highlights.length).padStart(2, '0')}</small
            ></span
          ><button
            type="button"
            aria-label="Destaque seguinte"
            disabled={highlights.length < 2}
            onclick={() => move(1)}><ArrowRight size={18} /></button
          >
        </div>
      </div>{/if}
  </div>
  <p class="sr-only" aria-live="polite" aria-atomic="true">
    {#if vehicle}Destaque {index + 1} de {highlights.length}: {vehicle.brand} {vehicle.model}{/if}
  </p>
</section>

<style>
  .hero-block {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1.55fr);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-card);
    overflow: hidden;
    background: var(--color-bg-1);
    position: relative;
  }
  .hero-copy {
    padding: 32px;
    display: flex;
    flex-direction: column;
    min-width: 0;
  }
  .eyebrow {
    display: flex;
    align-items: center;
    gap: 12px;
    font-family: var(--font-mono);
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.2em;
    color: var(--color-red);
    margin-bottom: 18px;
  }
  .eyebrow span {
    width: 20px;
    height: 1px;
    background: currentColor;
  }
  h2 {
    font-family: var(--font-display);
    font-size: clamp(30px, 3.3vw, 52px);
    font-style: italic;
    font-weight: 900;
    text-transform: uppercase;
    line-height: 0.96;
    letter-spacing: -0.025em;
    overflow-wrap: anywhere;
  }
  h2 > span {
    color: var(--color-red);
  }
  .description {
    font-size: 14px;
    line-height: 1.6;
    color: var(--color-text-muted);
    margin: 15px 0 24px;
    display: -webkit-box;
    -webkit-line-clamp: 3;
    line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .specs {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px 16px;
    margin: auto 0 0;
  }
  .specs > div {
    display: flex;
    gap: 12px;
    align-items: center;
    color: var(--color-red);
  }
  .specs > div > span {
    border-left: 1px solid var(--color-red);
    padding-left: 12px;
    min-width: 0;
  }
  strong {
    font-family: var(--font-display);
    font-size: 17px;
    font-weight: 600;
    color: var(--color-text);
  }
  small {
    display: block;
    font-size: 11px;
    line-height: 1.5;
    color: var(--color-text-muted);
    margin-top: 3px;
  }
  .links {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    margin-top: 28px;
  }
  .links a {
    display: inline-flex;
    align-items: center;
    gap: 9px;
    padding: 11px 14px;
    border: 1px solid var(--color-border-strong);
    border-radius: var(--radius-btn);
    font-family: var(--font-display);
    font-size: 12px;
    font-weight: 700;
    text-transform: uppercase;
    font-style: italic;
    letter-spacing: 0.05em;
  }
  .links a:hover {
    border-color: var(--color-red);
  }
  .links .primary {
    background: var(--color-red);
    border-color: var(--color-red);
    color: white;
  }
  .hero-photo {
    position: relative;
    min-height: 460px;
    background: var(--color-bg-2);
    isolation: isolate;
  }
  .hero-photo > img {
    position: absolute;
    width: 100%;
    height: 100%;
    inset: 0;
    object-fit: cover;
    object-position: center;
    opacity: 0;
    transition: opacity 180ms ease;
  }
  .hero-photo > img.is-active {
    opacity: 1;
  }
  .photo-shade {
    position: absolute;
    inset: 0;
    background: linear-gradient(180deg, #0008, transparent 32%, transparent 65%, #0009);
    pointer-events: none;
  }
  .photo-top,
  .photo-bottom {
    position: absolute;
    left: 24px;
    right: 24px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 20px;
    color: white;
  }
  .photo-top {
    top: 24px;
    align-items: flex-start;
  }
  .photo-label {
    font-family: var(--font-mono);
    font-size: 9px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    max-width: 180px;
    line-height: 1.7;
  }
  .stats {
    display: flex;
    gap: 22px;
    text-align: right;
  }
  .stats :global(strong) {
    font-family: var(--font-display);
    font-weight: 600;
    font-size: 21px;
    color: white;
  }
  .stats :global(small) {
    display: block;
    line-height: 1.5;
    margin-top: 3px;
    color: #fffb;
    text-transform: uppercase;
    font-family: var(--font-mono);
    font-size: 8px;
    letter-spacing: 0.12em;
  }
  .photo-bottom {
    bottom: 24px;
  }
  .registration-plate {
    display: inline-flex;
    align-items: stretch;
    overflow: hidden;
    background: #f5f5f0;
    border: 2px solid #252527;
    border-radius: 5px;
    box-shadow:
      0 2px 5px #0004,
      inset 0 0 0 1px white;
    flex-shrink: 0;
  }
  .plate-country {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 3px;
    width: 23px;
    padding: 4px 0;
    background: #003399;
    color: white;
    font: 700 10px/1 sans-serif;
  }
  .eu-stars {
    width: 10px;
    height: 10px;
    border: 2px dotted #ffdc32;
    border-radius: 50%;
  }
  .plate-number {
    display: flex;
    align-items: center;
    padding: 6px 12px;
    font-family: var(--font-mono);
    font-size: 18px;
    line-height: 1;
    font-weight: 800;
    letter-spacing: 0.07em;
    color: #151517;
    white-space: nowrap;
  }
  .plate-number.unregistered {
    font-size: 10px;
    letter-spacing: 0.08em;
  }
  .carousel-controls {
    display: flex;
    align-items: center;
    gap: 14px;
    background: #0007;
    border: 1px solid #fff3;
    border-radius: var(--radius-btn);
    padding: 4px;
  }
  .carousel-controls button {
    display: grid;
    place-items: center;
    width: 40px;
    height: 40px;
    cursor: pointer;
    border-radius: var(--radius-btn);
  }
  .carousel-controls button:hover {
    background: #fff2;
  }
  .carousel-controls button:disabled {
    opacity: 0.35;
    cursor: default;
  }
  .carousel-controls > span {
    font-family: var(--font-mono);
    font-size: 12px;
    white-space: nowrap;
  }
  .carousel-controls small {
    display: inline;
    color: #fff9;
    font-size: 10px;
  }
  .empty-photo {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 20px;
    color: var(--color-text-faint);
    background: var(--color-bg-2);
    font-size: 13px;
  }
  :is(button, a):focus-visible {
    outline: 2px solid var(--color-red);
    outline-offset: 3px;
  }
  @media (max-width: 1200px) {
    .hero-copy {
      padding: 24px;
    }
    .specs {
      grid-template-columns: 1fr;
      gap: 15px;
    }
    .photo-label {
      display: none;
    }
  }
  @media (max-width: 900px) {
    .hero-block {
      grid-template-columns: 1fr;
    }
    .hero-photo {
      min-height: 360px;
    }
    .specs {
      grid-template-columns: 1fr 1fr;
    }
    .description {
      max-width: 600px;
    }
  }
  @media (max-width: 480px) {
    .hero-copy {
      padding: 20px;
    }
    .hero-photo {
      min-height: 280px;
    }
    .photo-top,
    .photo-bottom {
      left: 16px;
      right: 16px;
    }
    .stats {
      gap: 16px;
    }
    .plate-number {
      font-size: 16px;
      padding-inline: 9px;
    }
    .carousel-controls {
      gap: 7px;
    }
    .carousel-controls button {
      width: 34px;
      height: 36px;
    }
    .specs {
      gap: 16px 10px;
    }
    strong {
      font-size: 15px;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .hero-photo > img {
      transition: none;
    }
  }
</style>
