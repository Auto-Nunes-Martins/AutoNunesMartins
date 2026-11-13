<script lang="ts">
  import PromotionRibbonFabric from './PromotionRibbonFabric.svelte';
  import { dev } from '$app/environment';
  import { onMount } from 'svelte';
  import {
    ArrowLeft,
    ArrowRight,
    ArrowDownRight,
    ArrowUpRight,
    TicketPercent,
    Sparkles,
  } from 'lucide-svelte';
  import { campaignFraming, photoFraming } from '@anm/types';
  import { catalogPlaceholder } from '$lib/localAssets';
  import {
    publicHref,
    publicPhoto,
    formatVehiclePrice,
    promotionSaving,
    publicMileage,
    fuelLabels,
    type PublicVehicle,
  } from '$lib/publicVehicles';
  import { sizedPhoto, vehiclePhotoSet } from '$lib/vehiclePhotoSources';
  import { perspectiveMotion } from './perspectiveMotion';
  import { campaignMotion } from './campaignMotion';
  import { visibleClock } from './visibleClock';

  let { vehicles }: { vehicles: PublicVehicle[] } = $props();
  let now = $state<number | null>(null);
  let rail = $state<HTMLDivElement>();
  let campaignElement = $state<HTMLElement>();
  let atStart = $state(true);
  let atEnd = $state(false);
  const offers = $derived(
    vehicles
      .filter(
        (vehicle) =>
          vehicle.promotion && (now === null || Date.parse(vehicle.promotion.endsAt) > now),
      )
      .slice(0, 4),
  );
  const endDate = new Intl.DateTimeFormat('pt-PT', {
    timeZone: 'Europe/Lisbon',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
  onMount(() => {
    if (!dev) return;
    now = Date.now();
  });
  function remaining(endsAt: string) {
    if (now === null) return endDate.format(new Date(endsAt));
    const seconds = Math.max(0, Math.floor((Date.parse(endsAt) - now) / 1000));
    const pad = (value: number) => String(value).padStart(2, '0');
    return `${Math.floor(seconds / 86400)}d ${pad(Math.floor(seconds / 3600) % 24)}:${pad(Math.floor(seconds / 60) % 60)}:${pad(seconds % 60)}`;
  }
  function countdownParts(endsAt: string) {
    const seconds = Math.max(0, Math.floor((Date.parse(endsAt) - (now ?? Date.now())) / 1000));
    return [
      { value: Math.floor(seconds / 86400), label: 'dias' },
      { value: Math.floor(seconds / 3600) % 24, label: 'horas' },
      { value: Math.floor(seconds / 60) % 60, label: 'min' },
      { value: seconds % 60, label: 'seg' },
    ];
  }
  function updateNavigation() {
    if (!rail) return;
    atStart = rail.scrollLeft <= 2;
    atEnd = rail.scrollLeft + rail.clientWidth >= rail.scrollWidth - 2;
  }
  function move(direction: number) {
    if (!rail) return;
    const card = rail.querySelector('article');
    rail.scrollBy({
      left:
        direction *
        ((card?.getBoundingClientRect().width ?? rail.clientWidth) +
          parseFloat(getComputedStyle(rail).columnGap)),
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
        ? 'instant'
        : 'smooth',
    });
  }
  $effect(() => {
    offers.length;
    if (!rail) return;
    const observer = new ResizeObserver(updateNavigation);
    observer.observe(rail);
    updateNavigation();
    return () => observer.disconnect();
  });
  $effect(() => {
    if (campaignElement) return perspectiveMotion(campaignElement, true);
  });
  $effect(() => {
    if (campaignElement) return campaignMotion(campaignElement);
  });
  $effect(() => {
    if (!campaignElement) return;
    return visibleClock(campaignElement, (time) => {
      now = time;
    });
  });
</script>

{#if dev && offers.length}
  <section
    bind:this={campaignElement}
    class="campaign-strip spacious-heading"
    id="campanhas"
    aria-labelledby="campaign-heading"
  >
    <div class="campaign-art" aria-hidden="true">
      <span>%</span><span class="percent-placeholder"></span><span>%</span><i></i>
      <b class="art-ticket"><TicketPercent size={132} strokeWidth={0.8} /></b>
    </div>
    <div class="campaign-orbit-reveal" aria-hidden="true"><b class="art-orbit"></b></div>
    <div class="falling-percent-layer" aria-hidden="true"><span>%</span></div>
    <div class="campaign-motifs" aria-hidden="true">
      <b class="art-spark"><Sparkles size={44} strokeWidth={1} /></b>
      <b class="art-key">
        <svg width="118" height="54" viewBox="0 0 132 60" fill="none" aria-hidden="true">
          <path
            d="M58 27h61l8 7-7 7h-10v-5h-8v6h-9v-6h-9v5H58"
            fill="currentColor"
            fill-opacity="0.1"
            stroke="currentColor"
            stroke-width="2"
            stroke-linejoin="round"
          />
          <path d="M63 32h52" stroke="currentColor" stroke-width="1" />
          <rect
            x="15"
            y="12"
            width="47"
            height="42"
            rx="14"
            fill="var(--bg)"
            stroke="currentColor"
            stroke-width="2.5"
          />
          <path d="M22 17c-19-8-23 27-6 23" stroke="currentColor" stroke-width="2" />
          <rect
            x="24"
            y="21"
            width="29"
            height="25"
            rx="6"
            stroke="currentColor"
            stroke-width="1"
            opacity="0.6"
          />
          <path d="M25 33h27" stroke="currentColor" opacity="0.45" />
          <rect
            x="35"
            y="26"
            width="8"
            height="5"
            rx="1"
            stroke="currentColor"
            stroke-width="1.1"
          /><path d="M37 26v-2a2 2 0 0 1 4 0v2" stroke="currentColor" stroke-width="1.1" />
          <path
            d="m32 40 3-4h8l3 4v3H32zm0 0h14"
            stroke="currentColor"
            stroke-width="1.1"
            stroke-linejoin="round"
          />
        </svg>
      </b>
      <b class="art-car">
        <svg width="104" height="44" viewBox="0 0 132 60" fill="none">
          <path
            d="m13 38 5-15 26-3 16-12h33l18 16 12 5 4 17h-14M16 46H7l3-8h10m23 8h46"
            fill="currentColor"
            fill-opacity="0.08"
            stroke="currentColor"
            stroke-width="2"
            stroke-linejoin="round"
          />
          <path
            d="m43 23 19-12h28l13 13H43zm30-11v12m-20 8h8m36 0h8M12 35h12m88-5h9"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linejoin="round"
          />
          <circle
            cx="31"
            cy="45"
            r="11"
            fill="var(--bg)"
            stroke="currentColor"
            stroke-width="2.5"
          /><circle
            cx="101"
            cy="45"
            r="11"
            fill="var(--bg)"
            stroke="currentColor"
            stroke-width="2.5"
          />
          <circle cx="31" cy="45" r="5" stroke="currentColor" /><circle
            cx="101"
            cy="45"
            r="5"
            stroke="currentColor"
          />
        </svg>
      </b>
    </div>
    <div class="campaign-lower-tint" aria-hidden="true"></div>
    <div class="campaign-local-shade" aria-hidden="true"></div>
    <div class="campaign-entry-shade" aria-hidden="true"></div>
    <div class="campaign-inner" class:three-offers={offers.length === 3}>
      <div class="campaign-intro">
        <h2 id="campaign-heading">
          <span class="sr-only">Campanhas. </span><span class="campaign-heading-lead read-a"
            >{offers.length === 1 ? 'Oferta' : 'Ofertas'}</span
          >
          <span class="campaign-offer-phrase"
            ><span class="heading-preposition">por</span>{' '}<em
              >tempo limitado.<span class="line-window" aria-hidden="true"
                ><span class="travelling-line"></span></span
              ></em
            ></span
          >
        </h2>
        {#if offers.length > 1}<div class="rail-controls" aria-label="Percorrer campanhas">
            <button
              type="button"
              aria-label="Campanha anterior"
              disabled={atStart}
              onclick={() => move(-1)}><ArrowLeft size={20} aria-hidden="true" /></button
            >
            <button
              type="button"
              aria-label="Campanha seguinte"
              disabled={atEnd}
              onclick={() => move(1)}><ArrowRight size={20} aria-hidden="true" /></button
            >
          </div>{/if}
      </div>
      <div
        class="campaign-rail"
        class:single={offers.length === 1}
        class:pair={offers.length === 2}
        class:three={offers.length === 3}
        class:four={offers.length === 4}
        bind:this={rail}
        onscroll={updateNavigation}
      >
        {#each offers as vehicle (vehicle.slug)}
          {@const promotion = vehicle.promotion!}
          {@const photo = vehicle.photos.length ? publicPhoto(vehicle, 0) : catalogPlaceholder}
          {@const reduction = promotionSaving(promotion.referencePrice, vehicle.price)}
          {@const framing = campaignFraming(vehicle.galleryFraming?.[0])}
          <article>
            <a class="campaign-link" href={publicHref(vehicle.slug)}>
              <div class="campaign-photo">
                <img
                  src={sizedPhoto(photo, 800)}
                  srcset={vehiclePhotoSet(photo)}
                  sizes={offers.length === 1
                    ? '(max-width: 700px) 90vw, (max-width: 899px) 92vw, 56vw'
                    : offers.length <= 2
                      ? '(max-width: 700px) 90vw, 46vw'
                      : offers.length === 3
                        ? '(max-width: 700px) 82vw, (max-width: 1100px) 46vw, 32vw'
                        : '(max-width: 700px) 82vw, (max-width: 1100px) 46vw, 23vw'}
                  style:--photo-desktop={framing ? `${framing.desktop.x}% ${framing.desktop.y}%` : undefined}
                  style:--photo-mobile={framing ? `${framing.mobile.x}% ${framing.mobile.y}%` : undefined}
                  use:photoFraming={{
                    framing: framing ?? undefined,
                    defaultFit: 'cover',
                  }}
                  alt={`${vehicle.brand} ${vehicle.model}`}
                  loading="lazy"
                />
                {#if reduction > 0}
                  <span class="photo-discount" aria-hidden="true">
                    <PromotionRibbonFabric />
                    <strong class:long-amount={formatVehiclePrice(reduction).length > 9}
                      >−{formatVehiclePrice(reduction)}</strong
                    >
                  </span>
                {/if}
                <div class="photo-caption">
                  <h3><span>{vehicle.brand}</span> {vehicle.model}</h3>
                  <p class="specs">
                    <span>{vehicle.year}</span>{#if vehicle.mileage !== null}<span
                        >{publicMileage(vehicle.mileage)}</span
                      >{/if}<span>{fuelLabels[vehicle.fuel]}</span>
                  </p>
                </div>
              </div>
              <div class="campaign-copy">
                {#if offers.length <= 2}
                  <div class="offer-details">
                    <p class="offer-brand">{vehicle.brand}</p>
                    <h3>{vehicle.model}</h3>
                    <p class="specs">
                      <span>{vehicle.year}</span>{#if vehicle.mileage !== null}<span
                          >{publicMileage(vehicle.mileage)}</span
                        >{/if}<span>{fuelLabels[vehicle.fuel]}</span>
                    </p>
                  </div>
                {/if}
                <div class="price-row">
                  <div class="prices">
                    <span class="before"
                      >Preço anterior <s>{formatVehiclePrice(promotion.referencePrice)}</s></span
                    >
                    <span class="now"
                      ><span class="current-price-label"
                        >Agora {#if reduction > 0}<span
                            class="reduction"
                            aria-label={`Desconto de ${formatVehiclePrice(reduction)}`}
                            >−{formatVehiclePrice(reduction)}</span
                          >{/if}</span
                      ><strong>{formatVehiclePrice(vehicle.price)}</strong></span
                    >
                  </div>
                </div>
                <div class="countdown">
                  <span class="countdown-label">{now === null ? 'Até' : 'Termina em'}</span><time
                    datetime={promotion.endsAt}
                    title={`Fim da campanha: ${endDate.format(new Date(promotion.endsAt))} (Lisboa)`}
                    aria-label={now === null
                      ? remaining(promotion.endsAt)
                      : countdownParts(promotion.endsAt)
                          .map((part) => `${part.value} ${part.label}`)
                          .join(', ')}
                  >
                    {#if now === null}{remaining(promotion.endsAt)}{:else}
                      {#each countdownParts(promotion.endsAt) as part}
                        <span class="countdown-unit"
                          ><strong>{String(part.value).padStart(2, '0')}</strong><small
                            >{{ dias: 'd', horas: 'h', min: 'min', seg: 's' }[part.label]}</small
                          ></span
                        >
                      {/each}
                    {/if}
                  </time>
                </div>
                <span class="offer-action"
                  >Ver oferta <ArrowUpRight size={15} aria-hidden="true" /></span
                >
              </div>
            </a>
          </article>
        {/each}
      </div>
      <div class="campaign-ticker">
        <div class="ticker-window" aria-hidden="true">
          <div class="ticker-track">
            {#each [0, 1] as group}
              <div class="ticker-group">
                {#each [0, 1, 2, 3, 4, 5, 6, 7] as item}
                  <span
                    >Viaturas com desconto <ArrowDownRight size={18} strokeWidth={1.5} /><span
                      class="ticker-dot">✳</span
                    >
                    Campanhas por tempo limitado <span class="ticker-dot">✳</span></span
                  >
                {/each}
              </div>
            {/each}
          </div>
        </div>
      </div>
    </div>
    <div class="campaign-blend" aria-hidden="true"></div>
  </section>
{/if}

<style>
  .campaign-strip {
    position: relative;
    isolation: isolate;
    background: #0c0c0e;
    color: #f6f4f1;
    margin-block: 0 36px;
    scroll-margin-top: 88px;
    overflow: clip;
  }
  .campaign-strip::before {
    content: '';
    position: absolute;
    z-index: -2;
    inset: 0;
    background:
      radial-gradient(ellipse at 0% 100%, #b6263659, transparent 57%),
      radial-gradient(ellipse at 100% 0%, #b43a2952, transparent 60%), #211315;
    background-size: 150% 120%;
    animation: campaign-glow 18s ease-in-out infinite alternate;
  }
  .campaign-art {
    position: absolute;
    z-index: -1;
    inset: 0;
    overflow: hidden;
    pointer-events: none;
  }
  .campaign-art > span {
    position: absolute;
    font-family: 'Inter', sans-serif;
    font-weight: 750;
    line-height: 1;
    color: transparent;
    -webkit-text-stroke: 1px #dba8b34d;
    animation: campaign-symbol 12s ease-in-out infinite;
  }
  .campaign-art > span:nth-child(1) {
    font-size: 250px;
    top: 25px;
    left: -45px;
    transform: rotate(-18deg);
  }
  .campaign-art > span:nth-child(2) {
    font-size: 330px;
    bottom: -100px;
    right: -20px;
    animation-delay: -4s;
    -webkit-text-stroke-color: #b6a0cf3b;
  }
  .campaign-art > span:nth-child(3) {
    font-size: 135px;
    top: -25px;
    left: 56%;
    animation-delay: -8s;
  }
  .campaign-art > i {
    position: absolute;
    inset: 0;
    opacity: 0.7;
    background:
      repeating-linear-gradient(125deg, transparent 0 95px, #ffffff08 96px, transparent 97px 192px),
      radial-gradient(ellipse at 50% 50%, #ffffff12 0.5px, transparent 1px);
    background-size:
      auto,
      5px 5px;
    mask-image: linear-gradient(110deg, #000, transparent 48%, #000);
  }
  .campaign-inner {
    position: relative;
    width: 92%;
    max-width: 1440px;
    margin-inline: auto;
    padding-block: 30px 34px;
  }
  .campaign-intro {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 24px;
    margin-bottom: 22px;
  }
  h2 {
    --perspective-base: var(--text);
    margin: 0;
    font-family: 'Orbit Inter', 'Inter', sans-serif;
    font-size: clamp(28px, 3vw, 42px);
    font-weight: 550;
    letter-spacing: -0.055em;
    line-height: 1.08;
  }
  h2 em {
    color: #ffad94;
    font-style: normal;
  }
  .rail-controls {
    display: flex;
    flex-shrink: 0;
    gap: 8px;
  }
  .rail-controls button {
    display: grid;
    place-items: center;
    width: 40px;
    height: 40px;
    border: 1px solid #ffffff40;
    border-radius: 50%;
    background: #ffffff09;
    color: white;
    cursor: pointer;
    transition: background 180ms;
  }
  .rail-controls button:hover:not(:disabled) {
    background: #ffffff20;
  }
  .rail-controls button:disabled {
    opacity: 0.25;
    cursor: default;
  }
  .campaign-rail {
    position: relative;
    display: flex;
    gap: 24px;
    overflow-x: auto;
    scroll-snap-type: x mandatory;
    padding: 8px 6px 24px;
    margin-inline: -6px;
    scrollbar-width: thin;
    scrollbar-color: #8f6674 #ffffff12;
  }
  article {
    flex: 0 0 39%;
    min-width: 0;
    border-radius: 12px;
    background: #252329;
    border: 1px solid #ffffff24;
    box-shadow: 0 10px 25px #00000030;
    scroll-snap-align: start;
  }
  .campaign-link {
    display: flex;
    flex-direction: column;
    height: 100%;
    color: inherit;
    text-decoration: none;
    border-radius: inherit;
  }
  .campaign-photo {
    position: relative;
    aspect-ratio: 5 / 4;
    border-radius: 11px 11px 0 0;
    overflow: hidden;
    background: #343338;
  }
  .campaign-photo::after {
    content: '';
    position: absolute;
    inset: 36% 0 0;
    background: linear-gradient(transparent 0%, #0a0a0b26 30%, #080809e8 100%);
    pointer-events: none;
  }
  img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: var(--photo-desktop, 50% 50%);
    transition: transform 500ms ease;
  }
  .reduction {
    position: absolute;
    z-index: 1;
    top: 20px;
    right: 20px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-width: 105px;
    padding: 12px 14px 10px;
    background: #faf3e9;
    color: #a71029;
    border-radius: 4px;
    transform: rotate(4deg);
    box-shadow:
      3px 5px 0 #a71029,
      0 6px 20px #00000030;
  }
  .photo-caption {
    position: absolute;
    color: #f6f4f1;
    z-index: 1;
    bottom: 22px;
    left: 24px;
    right: 24px;
  }
  h3 {
    margin: 0;
    font-size: clamp(23px, 2.2vw, 33px);
    font-weight: 600;
    letter-spacing: -0.045em;
    line-height: 1.1;
    overflow-wrap: anywhere;
    text-shadow: 0 1px 9px #00000038;
  }
  h3 > span {
    color: #f4f0ed;
    font-weight: 400;
  }
  .specs {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 0;
    margin: 9px 0 0;
    color: #e2dfe2;
    font-size: 11px;
    line-height: 1.4;
  }
  .specs span + span::before {
    content: '·';
    padding-inline: 9px;
    color: #cfaca4;
  }
  .campaign-copy {
    display: flex;
    flex: 1;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 19px 24px 21px;
    background: linear-gradient(120deg, #43262a, #2d1b1f 80%);
    border-radius: 0 0 11px 11px;
  }
  .prices {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .before {
    font-size: 12px;
    color: #d5b9b2;
    white-space: nowrap;
  }
  s {
    margin-left: 5px;
    text-decoration-thickness: 1px;
  }
  .now {
    display: inline-flex;
    align-items: baseline;
    gap: 8px;
  }
  .now > span {
    font-size: 10px;
    color: #f2ded7;
  }
  .now > strong {
    color: #fff;
    font-size: clamp(30px, 3vw, 42px);
    font-weight: 600;
    line-height: 1.05;
    letter-spacing: -0.055em;
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
  }
  .countdown {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    flex-shrink: 0;
    gap: 8px;
    padding-left: 16px;
    border-left: 1px solid #ffffff20;
  }
  .countdown > span {
    color: #d4b5af;
    font-size: 9px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }
  .countdown time {
    color: #ffd3bc;
    font-size: 14px;
    font-weight: 550;
    font-family: 'Inter', sans-serif;
    font-variant-numeric: tabular-nums;
    letter-spacing: 0.015em;
    white-space: nowrap;
  }
  a:focus-visible,
  .rail-controls button:focus-visible {
    outline: 2px solid #f48690;
    outline-offset: 4px;
  }
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
  .campaign-ticker {
    cursor: default;
    user-select: none;
    position: relative;
    display: flex;
    height: 33px;
    background: #1c1112;
    color: #dfc7c0;
    border-block: 1px solid #ffffff0c;
  }
  .ticker-window {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    mask-image: linear-gradient(to right, transparent, #000 3%, #000 97%, transparent);
  }
  .campaign-strip:global([data-motion-active='false']) .ticker-track {
    animation-play-state: paused;
  }
  .ticker-track {
    display: flex;
    width: max-content;
    animation: campaign-ticker 100s linear infinite;
  }
  .ticker-group {
    display: flex;
    flex-shrink: 0;
    min-width: 100vw;
  }
  .ticker-group > span {
    display: flex;
    flex: 1 0 auto;
    align-items: center;
    height: 31px;
    gap: 24px;
    padding-right: 24px;
    font-size: 9px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    white-space: nowrap;
    font-weight: 550;
  }
  .ticker-group :global(svg),
  .ticker-dot {
    color: #fa8b72;
  }
  .ticker-dot {
    font-size: 14px;
  }
  @keyframes campaign-ticker {
    to {
      transform: translateX(-50%);
    }
  }
  @keyframes campaign-glow {
    from {
      background-position: 0% 50%;
    }
    to {
      background-position: 100% 50%;
    }
  }
  @keyframes campaign-symbol {
    0%,
    100% {
      translate: 0 0;
      rotate: -13deg;
    }
    50% {
      translate: 0 -12px;
      rotate: -7deg;
    }
  }
  @media (max-width: 1100px) and (min-width: 701px) {
    article {
      flex-basis: 55%;
    }
  }
  @media (max-width: 700px) {
    .campaign-strip {
      margin-block: 0 28px;
    }
    .campaign-inner {
      width: 100%;
      padding-block: 24px 16px;
    }
    .campaign-intro {
      margin: 0 5% 20px;
      align-items: flex-end;
      gap: 12px;
    }
    h2 {
      font-size: clamp(27px, 7.5vw, 38px);
      max-width: 230px;
    }
    h2 em {
      display: block;
    }
    .rail-controls {
      gap: 6px;
    }
    .rail-controls button {
      width: 34px;
      height: 34px;
    }
    .campaign-art > span:nth-child(1) {
      font-size: 190px;
      top: 45px;
      left: -65px;
    }
    .campaign-art > span:nth-child(2) {
      font-size: 240px;
      bottom: -40px;
      right: -85px;
    }
    .campaign-rail {
      gap: 16px;
      scroll-padding-inline: 5vw;
      padding: 6px 5% 20px;
      margin-inline: 0;
    }
    article {
      flex-basis: 88%;
    }
    .campaign-photo {
      width: 100%;
      aspect-ratio: 1 / 1;
      max-height: none;
      border-radius: 11px 11px 0 0;
    }
    img {
      object-position: var(--photo-mobile, 50% 50%);
    }
    .reduction {
      top: 16px;
      right: 16px;
      min-width: 88px;
      padding: 10px 12px 9px;
    }
    .photo-caption {
      bottom: 20px;
      left: 18px;
      right: 18px;
    }
    h3 {
      font-size: 27px;
    }
    .specs {
      font-size: 10px;
    }
    .specs span + span::before {
      padding-inline: 7px;
    }
    .campaign-copy {
      flex-direction: row;
      padding: 17px 18px;
      gap: 10px;
      border-radius: 0 0 11px 11px;
    }
    .now > strong {
      font-size: 30px;
    }
    .before {
      font-size: 10px;
    }
    .now > span {
      font-size: 9px;
    }
    .countdown {
      align-items: flex-end;
      padding: 0 0 0 10px;
      border-top: 0;
      border-left: 1px solid #ffffff20;
      gap: 6px;
    }
    .countdown time {
      font-size: 11px;
    }
    .countdown > span {
      font-size: 8px;
    }
  }
  @media (max-width: 360px) {
    .campaign-copy {
      flex-wrap: wrap;
    }
    .countdown {
      width: 100%;
      flex-direction: row;
      align-items: center;
      justify-content: space-between;
      border-left: 0;
      border-top: 1px solid #ffffff20;
      padding: 10px 0 0;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .ticker-track,
    .campaign-art > span,
    .campaign-strip::before {
      animation: none;
    }
    img {
      transition: none;
    }
  }
  .campaign-strip::before {
    background:
      radial-gradient(ellipse at 4% 105%, #e3061380, transparent 48%),
      radial-gradient(ellipse at 96% -12%, #e3061366, transparent 42%),
      var(
        --campaign-diagonal,
        linear-gradient(125deg, transparent 22%, #ffffff06 22.1%, #ffffff01 38%, transparent 38.1%)
      ),
      radial-gradient(ellipse at 45% 0%, #2a2b30, transparent 60%), #0c0c0e;
    background-size: 115% 115%;
  }
  .campaign-strip::after {
    content: '';
    position: absolute;
    pointer-events: none;
    z-index: -1;
    width: 95%;
    height: 160%;
    top: -55%;
    right: -45%;
    border: 1px solid #e3061340;
    border-radius: 50%;
    transform: rotate(-30deg);
    box-shadow:
      0 0 0 24px #e3061307,
      0 0 0 80px #ffffff03,
      0 0 90px #e3061312;
  }
  .campaign-art > span {
    -webkit-text-stroke-color: #ed647351;
    filter: drop-shadow(0 3px 0 #08080b) drop-shadow(0 0 14px #e3061320);
  }
  .campaign-art > b {
    position: absolute;
    display: block;
    animation: campaign-symbol 14s ease-in-out infinite;
  }
  .art-ticket {
    top: 36px;
    right: 12%;
    color: #ed74806b;
    filter: drop-shadow(3px 5px 0 #09090c) drop-shadow(0 0 12px #e3061320);
    rotate: 14deg;
    animation-delay: -6s !important;
  }
  .art-spark {
    bottom: 4px;
    left: 25%;
    color: #efadb389;
    filter: drop-shadow(0 0 15px #e3061340);
    animation-delay: -3s !important;
  }
  .art-orbit {
    width: 160px;
    height: 160px;
    border: 1px solid #e3061340;
    border-radius: 50%;
    left: 14%;
    top: -70px;
    box-shadow:
      0 0 0 18px #e3061310,
      0 0 0 36px #e3061308;
  }
  .campaign-inner {
    width: 94%;
    max-width: 1520px;
  }
  h2 em {
    color: var(--red);
    text-shadow: 0 2px 22px #e3061330;
  }
  .campaign-rail {
    gap: 20px;
    scrollbar-width: none;
  }
  .campaign-rail::-webkit-scrollbar {
    display: none;
  }
  article {
    flex-basis: calc((100% - 60px) / 4);
    background: #17171a;
    border-color: #ffffff29;
    box-shadow:
      0 16px 32px #00000070,
      0 1px 0 #ffffff15 inset;
    transition:
      translate 220ms ease,
      box-shadow 220ms ease,
      border-color 220ms ease;
  }
  .campaign-photo {
    aspect-ratio: 1 / 1.03;
  }
  .reduction {
    top: 17px;
    right: 16px;
    min-width: 82px;
    padding: 10px 11px 9px;
    background: linear-gradient(145deg, #fffdfa, #eae7e3);
    color: #bc0611;
    border: 1px solid #fffdfa;
    box-shadow:
      3px 5px 0 var(--red, #e30613),
      0 8px 20px #00000040;
  }
  .photo-caption {
    bottom: 18px;
    left: 18px;
    right: 18px;
  }
  h3 {
    font-size: clamp(22px, 1.8vw, 29px);
    font-weight: 650;
  }
  .specs {
    font-size: 10px;
  }
  .specs span + span::before {
    padding-inline: 7px;
    color: #efb7a8;
  }
  .campaign-copy {
    flex-direction: column;
    align-items: stretch;
    gap: 16px;
    padding: 17px;
    background:
      radial-gradient(ellipse at 0 0, #e3061333, transparent 85%),
      linear-gradient(130deg, #222226, #141416);
    border-top: 1px solid #ffffff0d;
  }
  .before {
    color: #e0c0ba;
    font-size: 11px;
  }
  .now > strong {
    font-size: clamp(29px, 2.7vw, 39px);
    color: #fff8f1;
    font-weight: 650;
  }
  .countdown {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 9px;
    margin-top: auto;
    padding: 12px 10px 10px;
    border: 1px solid #e24b5850;
    border-radius: 8px;
    background: linear-gradient(115deg, #e3061329, #e306130b);
    box-shadow: 0 1px 0 #ffffff08 inset;
  }
  .countdown > .countdown-label {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    color: #ffccba;
    font-size: 9px;
    letter-spacing: 0.13em;
    text-transform: uppercase;
  }
  .countdown time {
    display: flex;
    justify-content: center;
    gap: 5px;
    color: #fff1e6;
    font-size: 15px;
    font-variant-numeric: tabular-nums;
  }
  .countdown-unit {
    flex: 1;
    max-width: 64px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 5px;
  }
  .countdown-unit strong {
    position: relative;
    display: grid;
    place-items: center;
    width: 100%;
    padding: 10px 2px;
    border-radius: 6px;
    background: linear-gradient(175deg, #843039 0%, #4b1821 48%, #2c0d14 49%, #43121c 100%);
    border: 1px solid #f5b6c033;
    border-bottom-color: #110c10;
    box-shadow:
      0 3px 0 #100c0e,
      0 5px 8px #00000066,
      inset 0 1px 0 #ffe2e53b,
      inset 0 -1px 0 #ef63701a;
    font-size: clamp(24px, 2.1vw, 31px);
    line-height: 1;
    font-weight: 750;
    letter-spacing: -0.03em;
    perspective: 180px;
    text-shadow:
      0 2px 1px #00000080,
      0 0 12px #ff667529;
  }
  .countdown-unit strong::after {
    content: '';
    position: absolute;
    top: 49%;
    inset-inline: 0;
    height: 1px;
    background: #05040660;
    box-shadow: 0 1px 0 #ffffff08;
    pointer-events: none;
  }
  .countdown-unit small {
    color: #f0c6b5;
    font-size: 8px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  .ticker-group :global(svg),
  .ticker-dot {
    color: #ff9d85;
  }
  @media (hover: hover) {
    article:hover {
      translate: 0 -4px;
      border-color: #ffb6a284;
      box-shadow:
        0 18px 28px #1b050560,
        0 0 20px #e85c3918;
    }
  }
  @media (min-width: 1101px) {
    .campaign-rail {
      justify-content: center;
      container-type: inline-size;
    }
    .three article {
      flex-basis: calc((100% - 40px) / 3);
    }
    .campaign-photo {
      height: calc((min(300px, (100cqw - 60px) / 4) - 2px) * 1.03);
      aspect-ratio: auto;
      flex-shrink: 0;
    }
    .rail-controls {
      display: none;
    }
  }
  @media (max-width: 1100px) and (min-width: 701px) {
    article {
      flex-basis: calc((100% - 20px) / 2);
    }
    .campaign-photo {
      aspect-ratio: 5 / 4;
    }
  }
  @media (max-width: 700px) {
    .campaign-inner {
      width: 100%;
    }
    .art-ticket {
      right: -30px;
      top: 30px;
    }
    .campaign-rail {
      gap: 16px;
    }
    article {
      flex-basis: 88%;
    }
    .campaign-photo {
      aspect-ratio: 1 / 1;
    }
    h3 {
      font-size: 27px;
    }
    .campaign-copy {
      padding: 17px 18px;
      gap: 15px;
    }
    .now > strong {
      font-size: 34px;
    }
    .countdown-unit strong {
      font-size: 29px;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .campaign-art > b {
      animation: none;
    }
    article {
      transition: none;
    }
    article:hover {
      translate: none;
    }
  }
  h2 em {
    position: relative;
    display: inline-block;
  }
  h2 em::after {
    content: none;
    position: absolute;
    bottom: -0.08em;
    left: 2px;
    width: 100%;
    height: 2px;
    border-radius: 2px;
    background: var(--red);
    opacity: 0.95;
    filter: var(--orbit-line-glow);
  }
  .campaign-art::after {
    content: '';
    position: absolute;
    right: -7%;
    top: 18%;
    width: 35%;
    height: 2px;
    transform: rotate(-36deg);
    background: var(--red);
    opacity: 0.95;
    filter: var(--orbit-line-glow);
  }
  .campaign-copy {
    position: relative;
  }
  .campaign-copy::before {
    content: '';
    position: absolute;
    top: -1px;
    left: 18px;
    width: 36px;
    height: 1px;
    background: var(--red);
    opacity: 0.95;
    filter: var(--orbit-line-glow);
    pointer-events: none;
  }
  .countdown {
    position: relative;
    border: 1px solid #e3061380;
    background:
      radial-gradient(ellipse at 50% 0, #c3092470, transparent 85%),
      linear-gradient(135deg, #64101d, #2e0f17);
    box-shadow:
      inset 0 1px 0 #ff849548,
      0 5px 14px #00000040;
    padding-bottom: 13px;
  }
  .countdown::before {
    content: '';
    position: absolute;
    top: -1px;
    left: 28%;
    right: 28%;
    height: 2px;
    background: var(--red);
    opacity: 0.95;
    filter: var(--orbit-line-glow);
    pointer-events: none;
  }
  .countdown > .countdown-label {
    color: #fff0f1;
    font-weight: 650;
  }
  .countdown time {
    color: #fff8f7;
  }
  .countdown-unit small {
    color: #ffd5da;
  }
  :global(html[data-theme='light']) .campaign-strip {
    background: var(--bg);
    color: var(--text);
  }
  :global(html[data-theme='light']) .campaign-strip::before {
    background:
      radial-gradient(ellipse at 2% 100%, #e3061340, transparent 52%),
      radial-gradient(ellipse at 100% 0%, #e3061333, transparent 48%),
      var(
        --campaign-diagonal,
        linear-gradient(125deg, transparent 22%, #ffffff70 22.1%, #ffffff10 38%, transparent 38.1%)
      ),
      #e9e3e1;
    background-size: 115% 115%;
  }
  :global(html[data-theme='light']) .campaign-art > span {
    -webkit-text-stroke-color: #e306133b;
    filter: drop-shadow(0 2px 0 #ffffff80);
  }
  :global(html[data-theme='light']) .art-ticket,
  :global(html[data-theme='light']) .art-spark {
    color: #e3061352;
    filter: drop-shadow(0 2px 0 #ffffff80);
  }
  :global(html[data-theme='light']) .campaign-art > i {
    background: radial-gradient(ellipse at 50% 50%, #24242626 0.5px, transparent 1px);
    background-size: 5px 5px;
    opacity: 0.35;
  }
  :global(html[data-theme='light']) article {
    background: var(--surface);
    border-color: #17171920;
    box-shadow:
      0 12px 28px #32121b16,
      0 1px 0 #ffffff inset;
  }
  :global(html[data-theme='light']) .campaign-copy {
    background:
      radial-gradient(ellipse at 0 0, #e306130e, transparent 85%),
      linear-gradient(135deg, #f7eeeb, #eae3e0);
  }
  :global(html[data-theme='light']) .now > strong,
  :global(html[data-theme='light']) .now > span {
    color: var(--text);
  }
  :global(html[data-theme='light']) .before {
    color: #62575b;
  }
  :global(html[data-theme='light']) .campaign-ticker {
    background: #ded1cd;
    color: #65252e;
    border-color: #e306131c;
  }
  :global(html[data-theme='light']) .ticker-group :global(svg),
  :global(html[data-theme='light']) .ticker-dot {
    color: var(--red);
  }
  :global(html[data-theme='light']) .rail-controls button {
    color: var(--text);
    border-color: #17171933;
    background: #ffffff80;
  }
  @media (prefers-reduced-motion: reduce) {
  }
  .campaign-strip {
    background: var(--bg);
    margin-bottom: 0;
  }
  .campaign-inner {
    padding-bottom: 76px;
  }
  .campaign-blend {
    position: absolute;
    z-index: 1;
    pointer-events: none;
    bottom: 0;
    inset-inline: 0;
    height: 78px;
    background: linear-gradient(transparent, var(--bg) 92%);
  }
  .campaign-art > span {
    text-shadow:
      2px 3px 0 #a51b2b26,
      4px 6px 0 #20091135;
  }
  .reduction {
    padding: 10px 11px 0;
    border: 1px solid #fff;
    border-radius: 5px 5px 7px 5px;
    background: linear-gradient(140deg, #fffefa 10%, #eee9e5 100%);
    box-shadow:
      1px 2px 0 #e0d6d2,
      3px 5px 0 #ba0714,
      5px 8px 0 #790a1540,
      0 14px 22px #00000050;
    animation: discount-float 8s ease-in-out infinite;
    transform-origin: 80% 10%;
  }
  @keyframes discount-float {
    0%,
    100% {
      transform: perspective(400px) rotate(4deg) rotateY(-7deg);
    }
    50% {
      transform: perspective(400px) translateY(-4px) rotate(1deg) rotateY(3deg);
    }
  }
  .campaign-copy {
    gap: 18px;
  }
  .prices {
    gap: 8px;
  }
  .before {
    display: flex;
    align-items: baseline;
    gap: 8px;
    font-size: 12px;
    color: #d4bec2;
  }
  .before s {
    margin: 0;
    font-size: 19px;
    font-weight: 550;
    text-decoration-color: #f26c78;
  }
  .now {
    justify-content: space-between;
    gap: 10px;
  }
  .now > span {
    color: #ff929b;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.09em;
    text-transform: uppercase;
  }
  .now > strong {
    font-size: clamp(34px, 3.1vw, 46px);
    font-weight: 750;
    letter-spacing: -0.065em;
    color: #fff;
  }
  .countdown {
    padding: 13px 12px 14px;
    gap: 11px;
  }
  .countdown time {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 7px;
  }
  .countdown-unit {
    max-width: none;
    min-width: 0;
    gap: 7px;
  }
  .countdown-unit strong {
    padding: 10px 2px;
    background: linear-gradient(175deg, #fffefa, #eae3df 48%, #f7f2ec 49%, #e3d9d3);
    border-color: #fff9f1;
    border-bottom-color: #9f8881;
    box-shadow:
      0 3px 0 #92756b,
      0 5px 9px #20070d50,
      inset 0 1px 0 #fff;
    color: #33131b;
    text-shadow: 0 1px 0 #fff;
    font-size: clamp(25px, 2.2vw, 32px);
  }
  .countdown-unit strong::after {
    background: #3a182b20;
    box-shadow: 0 1px 0 #ffffff70;
  }
  .countdown-unit small {
    color: #ffe5e8;
    letter-spacing: 0.04em;
  }
  :global(html[data-theme='light']) .now > span {
    color: #b20716;
  }
  :global(html[data-theme='light']) .before {
    color: #665356;
  }
  :global(html[data-theme='light']) .campaign-art > span {
    text-shadow:
      2px 3px 0 #e306130e,
      4px 6px 0 #e3061309;
  }
  @media (max-width: 700px) {
    .campaign-inner {
      padding-bottom: 62px;
    }
    .campaign-blend {
      height: 65px;
    }
    .now > strong {
      font-size: 38px;
    }
    .before s {
      font-size: 17px;
    }
    .countdown-unit strong {
      font-size: 27px;
    }
    .reduction {
      padding-inline: 11px;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .reduction {
      animation: none;
    }
  }
  .campaign-strip {
    padding-bottom: 38px;
  }
  .campaign-inner {
    padding-bottom: 32px;
  }
  .campaign-ticker {
    z-index: 2;
    background: transparent;
    border: 0;
  }
  :global(html[data-theme='light']) .campaign-ticker {
    background: transparent;
  }
  @media (max-width: 700px) {
    .campaign-inner {
      padding-bottom: 24px;
    }
  }
  .campaign-strip {
    padding-bottom: 0;
  }
  .campaign-inner {
    padding-block: 24px 40px;
  }
  .campaign-intro {
    gap: 16px;
    margin-bottom: 18px;
  }
  h2 {
    flex: 1;
    font-size: calc((clamp(28px, 3vw, 42px) + var(--orbit-title-section)) / 2);
    line-height: 1.12;
    letter-spacing: -0.05em;
    max-width: none;
  }
  @media (max-width: 700px) {
    h2 {
      font-size: calc((clamp(27px, 7.5vw, 38px) + var(--orbit-title-section)) / 2);
    }
    .campaign-intro {
      position: relative;
    }
    .rail-controls {
      position: absolute;
      right: 0;
      top: 0;
    }
    .campaign-heading-lead {
      padding-right: 80px;
    }
  }
  .campaign-ticker {
    flex: 0 1 330px;
    height: 28px;
    min-width: 0;
    opacity: 0.85;
  }
  .ticker-group > span {
    height: 28px;
    font-size: 8px;
    gap: 18px;
  }
  .campaign-copy {
    padding: 14px 16px;
    gap: 12px;
  }
  .prices {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 8px;
    align-items: end;
  }
  .before {
    flex-direction: column;
    gap: 3px;
    font-size: 10px;
  }
  .before s {
    font-size: clamp(14px, 1.2vw, 18px);
  }
  .now {
    flex-direction: column;
    align-items: flex-end;
    gap: 3px;
  }
  .now > span {
    font-size: 9px;
  }
  .now > strong {
    font-size: clamp(30px, 2.7vw, 38px);
  }
  .countdown {
    padding: 9px 10px 10px;
    gap: 8px;
  }
  .countdown > .countdown-label {
    font-size: 8px;
  }
  .countdown-unit {
    gap: 5px;
  }
  .countdown-unit strong {
    padding: 6px 2px;
    font-size: 25px;
  }
  .countdown-unit small {
    font-size: 7px;
  }
  .campaign-blend {
    height: 52px;
  }
  @media (min-width: 1101px) {
    .campaign-photo {
      height: calc((min(300px, (100cqw - 60px) / 4) - 2px) * 1.04);
    }
  }
  @media (max-width: 1100px) and (min-width: 701px) {
    .campaign-ticker {
      flex-basis: 210px;
    }
    .campaign-photo {
      aspect-ratio: 5 / 4;
    }
  }
  @media (max-width: 700px) {
    .campaign-inner {
      padding-block: 20px 34px;
    }
    .campaign-intro {
      flex-wrap: wrap;
      gap: 12px;
      margin-bottom: 12px;
    }
    .campaign-ticker {
      order: 3;
      flex: 1 0 100%;
      height: 22px;
    }
    .ticker-group > span {
      height: 22px;
      font-size: 7px;
    }
    .campaign-photo {
      aspect-ratio: 1.08;
    }
    .campaign-copy {
      padding: 13px 14px;
      gap: 11px;
    }
    .before s {
      font-size: 16px;
    }
    .now > strong {
      font-size: clamp(30px, 9vw, 36px);
    }
    .countdown-unit strong {
      font-size: 25px;
    }
    .campaign-blend {
      height: 45px;
    }
  }
  .campaign-ticker {
    height: 28px;
    width: 100%;
    opacity: 0.8;
  }
  .ticker-group > span {
    height: 28px;
    font-size: 8px;
  }
  .campaign-inner {
    padding-top: 18px;
  }
  .campaign-strip::before {
    mask-image: linear-gradient(
      to bottom,
      transparent,
      #000 70px,
      #000 calc(100% - 55px),
      transparent
    );
  }
  .campaign-art {
    mask-image: linear-gradient(
      to bottom,
      transparent,
      #000 55px,
      #000 calc(100% - 55px),
      transparent
    );
  }
  .campaign-strip::after {
    opacity: 0.55;
  }
  .campaign-inner {
    padding-bottom: 150px;
  }
  .campaign-art > span:nth-child(2) {
    bottom: 65px;
  }
  @media (max-width: 700px) {
    .campaign-ticker {
      height: 24px;
    }
    .ticker-group > span {
      height: 24px;
      font-size: 7px;
    }
    .campaign-inner {
      padding-top: 14px;
      padding-bottom: 134px;
    }
    .campaign-art > span:nth-child(2) {
      bottom: 60px;
    }
  }
  .campaign-copy {
    background: linear-gradient(135deg, #242427, #161619);
  }
  .campaign-copy::before {
    display: none;
  }
  .before {
    color: #aaa4a6;
  }
  .before s {
    text-decoration-color: #aaa4a6;
  }
  .now > span {
    color: #dedadc;
    font-size: 9px;
    letter-spacing: 0.12em;
  }
  .now > strong {
    color: #fff;
    font-size: clamp(34px, 3.1vw, 46px);
    font-weight: 750;
    text-shadow: 0 2px 12px #ffffff0c;
  }
  .countdown {
    border: 1px solid #ffffff20;
    background: linear-gradient(140deg, #252327, #171619);
    box-shadow: inset 0 1px 0 #ffffff08;
  }
  .countdown::before {
    display: none;
  }
  .countdown > .countdown-label {
    color: #c3bbc0;
    font-weight: 500;
  }
  .countdown-unit strong {
    background: linear-gradient(175deg, #3a373d, #2b282e 48%, #252229 49%, #302c33);
    color: #f4f0f2;
    border-color: #ffffff1f;
    border-bottom-color: #151317;
    box-shadow:
      0 2px 0 #0f0d11,
      inset 0 1px 0 #ffffff16;
    text-shadow: 0 1px 2px #00000060;
    font-size: 23px;
  }
  .countdown-unit strong::after {
    background: #0000002b;
    box-shadow: 0 1px 0 #ffffff05;
  }
  .countdown-unit small {
    color: #b4abb1;
  }
  .reduction {
    min-width: 0;
    padding: 11px 14px 10px;
    border: 1px solid #ffffff3b;
    border-left: 2px solid var(--red);
    border-radius: 7px;
    background: linear-gradient(135deg, #17171af5, #28262bf2);
    color: #fff;
    box-shadow:
      0 7px 18px #00000035,
      inset 0 1px 0 #ffffff0c;
    transform: none;
    animation: none;
  }
  :global(html[data-theme='light']) .campaign-copy {
    background: linear-gradient(135deg, #f4f0ec, #e8e4df);
  }
  :global(html[data-theme='light']) .now > span {
    color: #62575c;
  }
  :global(html[data-theme='light']) .countdown {
    border-color: #27202920;
    background: linear-gradient(140deg, #e2dcda, #d5cecd);
    box-shadow: inset 0 1px 0 #ffffff70;
  }
  :global(html[data-theme='light']) .countdown > .countdown-label {
    color: #61555d;
  }
  :global(html[data-theme='light']) .countdown-unit strong {
    background: linear-gradient(175deg, #fffdf9, #eee9e5 48%, #f8f4ef 49%, #e9e2dc);
    color: #30252b;
    border-color: #ffffffb0;
    border-bottom-color: #c5bab4;
    box-shadow:
      0 2px 0 #b9aaa4,
      inset 0 1px 0 #fff;
    text-shadow: 0 1px 0 #ffffff80;
  }
  :global(html[data-theme='light']) .countdown-unit small {
    color: #675b61;
  }
  :global(.design.orbit-home .campaign-strip + .showroom) {
    padding-top: clamp(20px, 2vw, 28px);
    position: relative;
    isolation: isolate;
  }
  :global(.design.orbit-home .campaign-strip + .showroom::before) {
    content: '';
    position: absolute;
    z-index: -1;
    pointer-events: none;
    top: -105px;
    left: calc((100% - 100vw) / 2);
    width: 100vw;
    height: 290px;
    background:
      radial-gradient(ellipse 40% 80% at -4% 15%, #e3061333, transparent 88%),
      radial-gradient(ellipse 35% 100% at 105% 35%, #e3061324, transparent 88%);
    mask-image: linear-gradient(transparent, #000 24%, #000 64%, transparent);
  }
  :global(html[data-theme='light'] .design.orbit-home .campaign-strip + .showroom::before) {
    opacity: 0.6;
  }
  @media (max-width: 700px) {
    .now > strong {
      font-size: clamp(34px, 10vw, 40px);
    }
    .reduction {
      padding: 10px 12px 9px;
    }
  }
  h2 em {
    --perspective-base: var(--text);
    color: transparent;
    background-image:
      linear-gradient(
        0deg,
        color-mix(in srgb, var(--red) 70%, transparent) 0%,
        color-mix(in srgb, var(--red) 70%, transparent) 22%,
        color-mix(in srgb, var(--red) 42%, transparent) 65%,
        color-mix(in srgb, var(--red) 12%, transparent) 100%
      ),
      linear-gradient(var(--perspective-base), var(--perspective-base));
    background-clip: text;
    -webkit-background-clip: text;
    text-shadow: none;
  }
  h2 em::after {
    left: 0;
    width: 100%;
  }
  .campaign-strip::before {
    background:
      radial-gradient(ellipse at 96% -12%, #e306132a, transparent 44%),
      var(
        --campaign-diagonal,
        linear-gradient(125deg, transparent 22%, #ffffff06 22.1%, #ffffff01 38%, transparent 38.1%)
      ),
      radial-gradient(ellipse at 45% 0%, #292328, transparent 60%), #0c0c0e;
    background-size: 115% 115%;
  }
  .campaign-copy {
    background:
      radial-gradient(ellipse at 0 0, #e3061324, transparent 85%),
      linear-gradient(135deg, #292226, #19171b);
  }
  .countdown {
    border-color: #e3061366;
    background: linear-gradient(135deg, #50111e, #28161d);
  }
  .countdown > .countdown-label {
    color: #f5c7cd;
  }
  .countdown-unit strong {
    --flip-top: #493039;
    --flip-bottom: #2c1b23;
    padding: 0;
    background: transparent;
    color: #fff5f6;
    border-color: #fbc4ce30;
    box-shadow:
      0 2px 0 #160a10,
      inset 0 1px 0 #ffffff12;
  }
  .countdown-unit small {
    color: #d8b4bf;
  }
  .reduction {
    background: linear-gradient(135deg, #b80718, #730c1a);
    border-color: #ffb2bc50;
    border-left-color: #ff8c99;
    box-shadow:
      0 6px 16px #21030b50,
      inset 0 1px 0 #ffffff1a;
  }
  :global(html[data-theme='light']) .campaign-strip::before {
    background:
      radial-gradient(ellipse at 100% 0%, #e306131b, transparent 48%),
      var(
        --campaign-diagonal,
        linear-gradient(125deg, transparent 22%, #ffffff70 22.1%, #ffffff10 38%, transparent 38.1%)
      ),
      #e9e3e1;
    background-size: 115% 115%;
  }
  :global(html[data-theme='light']) .campaign-copy {
    background: linear-gradient(135deg, #f5ece9, #e8e4df);
  }
  :global(html[data-theme='light']) .countdown {
    border-color: #e3061333;
    background: linear-gradient(135deg, #e5ced0, #d8cece);
  }
  :global(html[data-theme='light']) .countdown > .countdown-label {
    color: #861d31;
  }
  :global(html[data-theme='light']) .countdown-unit strong {
    --flip-top: #fff7f1;
    --flip-bottom: #e9deda;
    background: transparent;
    color: #431b28;
  }
  :global(html[data-theme='light']) .countdown-unit small {
    color: #79555f;
  }
  .campaign-blend {
    height: 180px;
    background:
      radial-gradient(
        ellipse 46% 105% at 46% 106%,
        var(--bg) 28%,
        color-mix(in srgb, var(--bg) 92%, transparent) 46%,
        transparent 82%
      ),
      radial-gradient(
        ellipse 42% 65% at 103% 110%,
        var(--bg) 22%,
        color-mix(in srgb, var(--bg) 70%, transparent) 52%,
        transparent 92%
      ),
      linear-gradient(to bottom, transparent 55%, var(--bg) 100%);
  }
  @media (max-width: 700px) {
    .campaign-blend {
      height: 145px;
      background:
        radial-gradient(
          ellipse 65% 105% at 30% 110%,
          var(--bg) 25%,
          color-mix(in srgb, var(--bg) 85%, transparent) 50%,
          transparent 85%
        ),
        linear-gradient(to bottom, transparent 56%, var(--bg) 100%);
    }
  }
  h2 em {
    color: transparent;
    background-image:
      linear-gradient(
        color-mix(in srgb, var(--red) 70%, transparent),
        color-mix(in srgb, var(--red) 70%, transparent)
      ),
      linear-gradient(var(--perspective-base), var(--perspective-base));
    background-clip: text;
    -webkit-background-clip: text;
    filter: none;
  }
  .campaign-heading-lead {
    color: transparent;
    background-image:
      linear-gradient(
        90deg,
        transparent calc(100% - 1.8em),
        color-mix(in srgb, var(--red) 12%, transparent) calc(100% - 1.2em),
        color-mix(in srgb, var(--red) 42%, transparent) calc(100% - 0.6em),
        color-mix(in srgb, var(--red) 60%, transparent) 100%
      ),
      radial-gradient(ellipse 310px 180px at 100% 100%, var(--text), transparent 100%),
      linear-gradient(var(--perspective-base), var(--perspective-base));
    background-clip: text;
    -webkit-background-clip: text;
  }
  .line-window {
    position: absolute;
    height: 2px;
    bottom: -0.08em;
    left: 0;
    right: 0;
    overflow: hidden;
    pointer-events: none;
    opacity: 0.95;
    filter: var(--orbit-line-glow);
  }
  .travelling-line {
    display: block;
    width: 100%;
    height: 100%;
    background: var(--red);
  }
  @media (prefers-reduced-motion: no-preference) {
    .campaign-heading-lead {
      background-image:
        radial-gradient(
          ellipse 310px 180px at var(--tip-x, 0px) var(--tip-y, 0px),
          color-mix(in srgb, var(--text) calc(var(--line-light, 0) * 100%), transparent),
          transparent 100%
        ),
        linear-gradient(var(--perspective-base), var(--perspective-base));
    }
    h2 em {
      background-image:
        linear-gradient(
          90deg,
          transparent calc(var(--segment-start, 0px) - 1.8em),
          color-mix(in srgb, var(--red) calc(var(--accent-light, 0) * 12%), transparent)
            calc(var(--segment-start, 0px) - 1.2em),
          color-mix(in srgb, var(--red) calc(var(--accent-light, 0) * 42%), transparent)
            calc(var(--segment-start, 0px) - 0.6em),
          color-mix(in srgb, var(--red) calc(var(--accent-light, 0) * 70%), transparent)
            calc(var(--segment-start, 0px) + var(--light-inset, 0px)),
          color-mix(in srgb, var(--red) calc(var(--accent-light, 0) * 70%), transparent)
            calc(var(--segment-end, 0px) - var(--light-inset, 0px) + 35px),
          color-mix(in srgb, var(--red) calc(var(--accent-light, 0) * 42%), transparent)
            calc(var(--segment-end, 0px) - var(--light-inset, 0px) / 2 + 17.5px + 0.525em),
          color-mix(in srgb, var(--red) calc(var(--accent-light, 0) * 12%), transparent)
            calc(var(--segment-end, 0px) - var(--light-inset, 0px) / 2 + 17.5px + 1.05em),
          transparent calc(var(--segment-end, 0px) - var(--light-inset, 0px) / 2 + 17.5px + 1.575em)
        ),
        linear-gradient(var(--perspective-base), var(--perspective-base));
    }
    .travelling-line {
      transform: translateX(calc((var(--line-progress, 0) * 2 - 1) * 100%));
    }
  }
  .campaign-copy {
    container-type: inline-size;
  }
  .price-row {
    padding: 4px 0 8px;
    border-bottom: 1px solid #ffffff12;
  }
  .prices {
    gap: 12px;
    min-height: 78px;
  }
  .before {
    color: #c4b8bd;
    font-size: 11px;
    gap: 7px;
  }
  .before s {
    font-size: clamp(14px, 6cqw, 20px);
    font-weight: 600;
    text-decoration-color: #ed6678;
    text-decoration-thickness: 1px;
  }
  .now {
    gap: 7px;
  }
  .now > .current-price-label {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    font-size: 10px;
  }
  .now > strong {
    font-size: clamp(30px, 15cqw, 48px);
    font-weight: 750;
    text-shadow:
      0 1px 0 #c9c1c5,
      0 3px 0 #08080c,
      0 6px 12px #00000060;
  }
  .reduction {
    position: relative;
    inset: auto;
    display: inline-flex;
    min-width: 0;
    padding: 3px 8px 3px 12px;
    border: 1px solid #ff8d9b40;
    border-radius: 2px;
    background: linear-gradient(160deg, #ef1724, var(--red));
    color: #fff;
    font-size: 12px;
    font-weight: 750;
    line-height: 1;
    letter-spacing: -0.03em;
    white-space: nowrap;
    box-shadow: inset 0 1px 0 #ffffff20;
    mask-image:
      radial-gradient(circle at 0 50%, transparent 2.5px, #000 3px),
      radial-gradient(circle at 100% 50%, transparent 2.5px, #000 3px);
    mask-composite: intersect;
    transform: none;
    animation: none;
  }
  .reduction::before {
    content: '';
    position: absolute;
    left: 6px;
    top: 3px;
    bottom: 3px;
    border-left: 1px dashed #ffffff70;
  }
  :global(html[data-theme='light']) .price-row {
    border-bottom-color: #17171915;
  }
  :global(html[data-theme='light']) .before {
    color: #65565c;
  }
  :global(html[data-theme='light']) .now > strong {
    text-shadow:
      0 1px 0 #fff,
      0 3px 5px #28132218;
  }
  @media (max-width: 700px) {
    .prices {
      min-height: 64px;
    }
    .now > strong {
      font-size: clamp(30px, 15cqw, 40px);
    }
  }
  .campaign-blend {
    height: 155px;
    background: linear-gradient(
      to bottom,
      transparent 0%,
      color-mix(in srgb, var(--bg) 35%, transparent) 52%,
      var(--bg) 100%
    );
  }
  :global(.design.orbit-home .campaign-strip + .showroom::before) {
    top: -155px;
    height: 370px;
    background:
      radial-gradient(ellipse 53% 92% at -8% 20%, #e3061345, #e306131a 52%, transparent 92%),
      radial-gradient(ellipse 27% 42% at 100% 4%, #e306131a, transparent 92%);
    mask-image: linear-gradient(transparent, #000 22%, #000 58%, transparent);
  }
  :global(html[data-theme='light'] .design.orbit-home .campaign-strip + .showroom::before) {
    opacity: 0.7;
  }
  @media (max-width: 700px) {
    .campaign-blend {
      height: 125px;
    }
    :global(.design.orbit-home .campaign-strip + .showroom::before) {
      top: -120px;
      height: 300px;
    }
  }
  .campaign-copy {
    background: linear-gradient(140deg, #25262b, #17181c);
  }
  .countdown {
    background: linear-gradient(140deg, #151619, #1d1e22);
    border-color: #ffffff22;
    box-shadow: inset 0 1px 0 #00000035;
  }
  .countdown > .countdown-label {
    color: #efbac0;
  }
  .countdown-unit strong {
    --flip-top: linear-gradient(175deg, #fcfdff, #f1f5f9);
    --flip-bottom: linear-gradient(175deg, #f9fbff, #e7edf4);
    color: #25242a;
    border-color: #f5f3ed;
    border-bottom-color: #b8b1a7;
    box-shadow:
      0 2px 0 #d4ccc1,
      0 4px 0 #a59b8d,
      0 6px 9px #00000045;
    text-shadow: 0 1px 0 #fff;
  }
  .countdown-unit strong::after {
    background: #504a4026;
    box-shadow: 0 1px 0 #ffffff85;
  }
  .countdown-unit small {
    color: #b9b8bd;
  }
  :global(html[data-theme='light']) .campaign-copy {
    background: linear-gradient(140deg, #f6f5f1, #e9e8e3);
  }
  :global(html[data-theme='light']) .countdown {
    background: linear-gradient(140deg, #dfdfdc, #d4d4d1);
    border-color: #b9b9b34a;
    box-shadow: inset 0 1px 2px #76736d14;
  }
  :global(html[data-theme='light']) .countdown > .countdown-label {
    color: #9d2435;
  }
  :global(html[data-theme='light']) .countdown-unit strong {
    --flip-top: linear-gradient(175deg, #fcfdff, #f1f5f9);
    --flip-bottom: linear-gradient(175deg, #f9fbff, #e7edf4);
    color: #25242a;
    border-color: #fffefa;
    border-bottom-color: #b8b1a7;
    box-shadow:
      0 2px 0 #c9c2b8,
      0 4px 0 #aea498,
      0 6px 8px #534b3b1a;
    text-shadow: 0 1px 0 #fff;
  }
  :global(html[data-theme='light']) .countdown-unit small {
    color: #69676b;
  }
  .campaign-inner {
    padding-top: 28px;
    padding-bottom: 95px;
  }
  .campaign-art > span:nth-child(2) {
    bottom: 48px;
  }
  .campaign-blend {
    height: 110px;
  }
  .campaign-art {
    translate: none;
  }
  .campaign-art > b,
  .campaign-art > span {
    animation: none;
  }
  .campaign-strip::before {
    inset: -12px 0;
    transform: none;
    animation: none;
  }
  .countdown-unit strong {
    border-radius: 2px;
  }
  @media (max-width: 700px) {
    .campaign-inner {
      padding-top: 22px;
      padding-bottom: 84px;
    }
    .campaign-art > span:nth-child(2) {
      bottom: 42px;
    }
    .campaign-blend {
      height: 96px;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .campaign-art {
      translate: none;
      transition: none;
    }
    .campaign-strip::before {
      transform: none;
      transition: none;
    }
  }
  .photo-discount {
    position: absolute;
    z-index: 1;
    top: 0;
    right: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 12px 15px 11px 20px;
    background: linear-gradient(125deg, #ed1523, #b40517);
    color: #fff;
    clip-path: polygon(14px 0, 100% 0, 100% 100%, 0 100%, 0 14px);
    border-bottom: 2px solid #ff9ca650;
    filter: drop-shadow(0 4px 7px #00000035);
  }
  .photo-discount strong {
    font-size: clamp(28px, 2.5vw, 36px);
    line-height: 1;
    font-weight: 750;
    letter-spacing: -0.06em;
  }
  .countdown > .countdown-label {
    color: #f5f5f1;
    font-size: 11px;
    font-weight: 650;
    letter-spacing: 0.09em;
    gap: 8px;
  }
  .countdown-label :global(svg) {
    box-sizing: content-box;
    padding: 3px;
    border-radius: 4px;
    color: #fff;
    background: var(--red);
  }
  :global(html[data-theme='light']) .countdown > .countdown-label {
    color: #29272d;
  }
  @media (max-width: 700px) {
    .photo-discount {
      padding: 10px 13px 10px 17px;
    }
    .photo-discount strong {
      font-size: 32px;
    }
  }
  .countdown-label :global(svg) {
    padding: 0;
    border-radius: 0;
    background: transparent;
    color: var(--red);
  }
  .campaign-inner {
    padding-top: 32px;
    padding-bottom: 72px;
  }
  .campaign-intro {
    margin-bottom: 24px;
  }
  .campaign-rail {
    padding-bottom: 16px;
  }
  .campaign-blend {
    height: 92px;
  }
  .campaign-art > span:nth-child(2) {
    bottom: 32px;
  }
  .before s {
    text-decoration-color: var(--red);
    text-decoration-thickness: 2px;
    text-decoration-skip-ink: none;
  }
  @media (max-width: 700px) {
    .campaign-inner {
      padding-top: 26px;
      padding-bottom: 66px;
    }
    .campaign-intro {
      margin-bottom: 20px;
    }
    .campaign-rail {
      padding-bottom: 16px;
    }
    .campaign-blend {
      height: 80px;
    }
    .campaign-art > span:nth-child(2) {
      bottom: 26px;
    }
  }
  .campaign-intro {
    margin-bottom: 28px;
  }
  .photo-discount {
    top: 12px;
    right: 12px;
    padding: 7px 10px;
    border: 1px solid #ffffff2b;
    border-radius: 4px;
    clip-path: none;
    background: var(--red);
    box-shadow: 0 3px 8px #00000035;
    filter: none;
  }
  .photo-discount strong {
    font-size: 26px;
    font-weight: 700;
    letter-spacing: -0.045em;
  }
  @media (max-width: 700px) {
    .campaign-intro {
      margin-bottom: 24px;
    }
    .photo-discount {
      top: 10px;
      right: 10px;
      padding: 6px 9px;
    }
    .photo-discount strong {
      font-size: 25px;
    }
  }
  /* Match shadow layers at rest and hover for continuous interpolation. */
  article {
    isolation: isolate;
    transform: translateZ(0);
    background: #272727;
    border-color: #ffffff30;
    box-shadow:
      0 3px 4px -2px #00000035,
      0 12px 22px -8px #00000050,
      0 24px 38px -20px #00000065,
      inset 0 1px 0 #ffffff14;
    transition:
      translate 360ms cubic-bezier(0.2, 0.7, 0.3, 1),
      box-shadow 360ms cubic-bezier(0.2, 0.7, 0.3, 1),
      border-color 360ms ease;
  }
  .campaign-copy {
    background: linear-gradient(145deg, #f6f6f6, #eaeaea);
  }
  :global(html[data-theme='light']) article {
    background: #ededed;
    border-color: #26262633;
    box-shadow:
      0 3px 4px -2px #30242724,
      0 12px 22px -8px #30242730,
      0 24px 38px -20px #30242738,
      inset 0 1px 0 #ffffffa0;
  }
  :global(html[data-theme='light']) .campaign-copy {
    background: linear-gradient(145deg, #f6f6f6, #eaeaea);
  }
  @media (hover: hover) and (prefers-reduced-motion: no-preference) {
    article:hover {
      translate: 0 -5px;
      border-color: #ffffff59;
      box-shadow:
        0 5px 8px -3px #00000035,
        0 18px 28px -10px #00000050,
        0 30px 44px -18px #00000070,
        inset 0 1px 0 #ffffff14;
    }
    :global(html[data-theme='light']) article:hover {
      border-color: #302c2755;
      box-shadow:
        0 5px 8px -3px #30242724,
        0 18px 28px -10px #30242730,
        0 30px 44px -18px #30242745,
        inset 0 1px 0 #ffffffa0;
    }
  }
  .photo-discount {
    top: 23px;
    right: -70px;
    width: 220px;
    padding: 7px 0;
    border: 0;
    border-radius: 0;
    transform: rotate(40deg);
    background: transparent;
    box-shadow: none;
    isolation: isolate;
  }

  .photo-discount strong {
    position: relative;
    font-size: 20px;
    letter-spacing: -0.04em;
    text-shadow: 0 1px 1px #65000a60;
  }
  .photo-discount strong.long-amount {
    font-size: 16px;
  }
  .countdown {
    background: linear-gradient(165deg, #303033, #222225);
    border: 1px solid #454549;
    border-radius: 6px;
    box-shadow:
      inset 0 1px 0 #ffffff0e,
      inset 0 -1px 0 #00000025,
      0 2px 4px #00000018;
    padding-block: 8px 10px;
    gap: 10px;
  }
  :global(html[data-theme='light']) .countdown {
    background: linear-gradient(165deg, #303033, #222225);
    border-color: #454549;
    box-shadow:
      inset 0 1px 0 #ffffff0e,
      inset 0 -1px 0 #00000025,
      0 2px 4px #2020200c;
  }
  .countdown::before {
    display: none;
    top: -1px;
    left: -1px;
    right: auto;
    width: 24px;
    height: 2px;
    background: var(--red);
    filter: none;
  }
  .countdown > .countdown-label {
    justify-content: flex-start;
    gap: 9px;
    font-size: 12px;
    font-weight: 750;
    letter-spacing: 0.055em;
    line-height: 1.2;
    color: #f5f5f5;
  }
  .countdown-label :global(.campaign-stopwatch),
  :global(html[data-theme='light']) .countdown-label :global(.campaign-stopwatch) {
    flex-shrink: 0;
    width: 20px;
    height: 22px;
    stroke-width: 1.8;
    filter: none;
    color: #f5f5f5;
  }
  :global(html[data-theme='light']) .countdown-label :global(.campaign-stopwatch) {
    color: #f5f5f5;
  }
  .countdown > .countdown-label::after {
    content: '';
    flex: 1;
    height: 1px;
    margin-left: 4px;
    background: #786b5f25;
  }
  :global(html[data-theme='light']) .countdown > .countdown-label::after {
    background: #786b5f25;
  }
  .countdown-unit {
    gap: 8px;
  }
  .countdown-unit small {
    font-size: 8px;
    line-height: 1;
    letter-spacing: 0.06em;
    color: #666268;
  }
  :global(html[data-theme='light']) .countdown-unit small {
    color: #666268;
  }
  .countdown-unit strong {
    perspective: none;
  }
  .countdown-unit strong::after {
    display: none;
  }
  .campaign-inner {
    padding-top: 32px;
    padding-bottom: 40px;
  }
  .campaign-ticker {
    margin-top: 14px;
    translate: 0 4px;
  }
  .campaign-copy {
    padding-block: 12px;
    gap: 10px;
  }
  .campaign-art > span:nth-child(2) {
    bottom: 8px;
    translate: 0 clamp(0px, calc(var(--campaign-fall, 0px) * 0.4), 40px);
    rotate: var(--campaign-percent-tilt, 0deg);
    transform-origin: 50% 30%;
    transition:
      translate 300ms cubic-bezier(0.2, 0.7, 0.3, 1),
      rotate 300ms cubic-bezier(0.2, 0.7, 0.3, 1);
  }
  .campaign-art > .percent-placeholder {
    display: none;
  }
  .falling-percent-layer {
    position: absolute;
    z-index: -1;
    inset: 0 0 -400px;
    pointer-events: none;
    overflow: hidden;
    mask-image: linear-gradient(to bottom, #000 0, #000 calc(100% - 110px), transparent 100%);
  }
  .falling-percent-layer > span {
    position: absolute;
    right: -20px;
    bottom: 408px;
    color: transparent;
    font-family: 'Inter', sans-serif;
    font-size: 330px;
    font-weight: 750;
    line-height: 1;
    -webkit-text-stroke: 1px #ed647351;
    text-shadow:
      2px 3px 0 #a51b2b26,
      4px 6px 0 #20091135;
    filter: drop-shadow(0 3px 0 #08080b) drop-shadow(0 0 14px #e3061320);
    translate: 0 var(--campaign-percent-drop, 0px);
    rotate: var(--campaign-percent-tilt, 0deg);
    transform-origin: 50% 30%;
    transition:
      translate 300ms cubic-bezier(0.2, 0.7, 0.3, 1),
      rotate 300ms cubic-bezier(0.2, 0.7, 0.3, 1);
  }
  :global(html[data-theme='light']) .falling-percent-layer > span {
    -webkit-text-stroke-color: #e306133b;
    text-shadow:
      2px 3px 0 #e306130e,
      4px 6px 0 #e3061309;
    filter: drop-shadow(0 2px 0 #ffffff80);
  }
  @media (max-width: 700px) {
    .falling-percent-layer > span {
      font-size: 240px;
      right: -85px;
      bottom: 402px;
    }
    .campaign-inner {
      padding-top: 30px;
      padding-bottom: 38px;
    }
    .campaign-art > span:nth-child(2) {
      bottom: 2px;
    }
  }
  .offer-action {
    display: flex;
    width: fit-content;
    max-width: 100%;
    margin-left: auto;
    justify-self: end;
    justify-content: flex-end;
    align-items: center;
    gap: 7px;
    color: #e9d9d7;
    font-size: 11px;
    font-weight: 600;
    line-height: 1;
  }
  .offer-action :global(svg) {
    color: #ef7a7d;
  }
  .offer-action:hover,
  .campaign-link:focus-visible .offer-action {
    text-decoration: underline;
    text-decoration-thickness: 0.75px;
    text-underline-offset: 3px;
  }
  :global(html[data-theme='light']) .offer-action {
    color: #722b30;
  }
  :global(html[data-theme='light']) .offer-action :global(svg) {
    color: var(--red);
  }
  .art-key {
    left: 57%;
    bottom: 4px;
    rotate: -6deg;
    color: #d8a7a4a0;
    opacity: 0.72;
    filter: drop-shadow(2px 3px 0 #50372f60) drop-shadow(4px 6px 3px #00000040);
    animation-delay: -8s !important;
  }
  :global(html[data-theme='light']) .art-key {
    color: #a96362a0;
    opacity: 0.55;
    filter: drop-shadow(2px 3px 0 #8e51432b) drop-shadow(4px 6px 3px #70323a18);
  }
  @media (max-width: 700px) {
    .art-key {
      left: 62%;
    }
  }
  .campaign-motifs {
    position: absolute;
    z-index: -1;
    inset-inline: 0;
    top: calc(100% - 201px);
    bottom: auto;
    height: var(--motif-extent, 420px);
    pointer-events: none;
    mask-image: linear-gradient(to bottom, #000 0, #000 calc(100% - 70px), transparent 100%);
  }
  .campaign-motifs > b {
    position: absolute;
    top: 169px;
    display: block;
    color: #d8a7a499;
    opacity: 0.65;
    filter: drop-shadow(2px 2px 0 #50372f60) drop-shadow(4px 5px 3px #00000030);
    animation: none;
  }
  .campaign-motifs > .art-key,
  .campaign-motifs > .art-car {
    top: 115px;
    transform: translateY(calc(var(--campaign-fall, 0px) * 1.02));
    transition: transform 300ms cubic-bezier(0.2, 0.7, 0.3, 1);
  }
  .campaign-motifs :global(svg) {
    display: block;
  }
  .campaign-motifs > .art-key {
    left: calc(57% - 40px);
    bottom: auto;
    transform: none;
    translate: 0 calc(var(--campaign-fall, 0px) * 1.02);
    rotate: calc(28deg + var(--campaign-key-tilt, 0deg));
    transition:
      translate 300ms cubic-bezier(0.2, 0.7, 0.3, 1),
      rotate 300ms cubic-bezier(0.2, 0.7, 0.3, 1);
  }
  .campaign-motifs > .art-key :global(svg) {
    width: 96px;
    height: 44px;
  }
  .campaign-motifs > .art-car {
    left: 8%;
    top: 6px;
    rotate: -3deg;
    transform: translateY(calc(var(--campaign-fall, 0px) * 0.65));
    animation-delay: -4s;
  }
  .campaign-motifs > .art-spark {
    left: 27%;
    bottom: auto;
  }
  :global(html[data-theme='light']) .campaign-motifs > b {
    color: #a9636290;
    opacity: 0.55;
    filter: drop-shadow(-1px -1px 0 #ffffff80) drop-shadow(2px 3px 0 #8e514321);
  }
  @media (max-width: 700px) {
    .campaign-motifs > .art-car {
      left: 3%;
    }
    .campaign-motifs > .art-spark {
      display: none;
    }
    .campaign-motifs > .art-key {
      left: calc(44% - 40px);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .falling-percent-layer > span {
      translate: none;
      rotate: none;
      transition: none;
    }
    .campaign-art > span:nth-child(2) {
      translate: none;
      rotate: none;
      transition: none;
    }
    .campaign-motifs > b {
      animation: none;
      transition: none;
    }
  }
  /* Carry the same surface into the next section instead of adding a separate glow. */
  .campaign-strip {
    overflow: visible;
    background: transparent;
    clip-path: inset(0 0 calc(var(--campaign-art-overflow, 240px) * -1));
  }
  .campaign-strip::after {
    top: auto;
    bottom: -78px;
    right: -45%;
    width: 95%;
    height: 135%;
    transform: none;
    translate: none;
    box-shadow:
      0 0 0 24px #e3061307,
      0 0 12px 60px #ffffff03,
      inset 2px 1px 0 #ffffff08;
  }
  .art-ticket {
    color: #ed748080;
    filter: drop-shadow(1px 1px 0 #f7b4bc60) drop-shadow(2px 3px 0 #6a1827)
      drop-shadow(3px 6px 3px #00000045);
  }
  .art-spark {
    filter: drop-shadow(1px 1px 0 #f7b4bc50) drop-shadow(2px 3px 0 #6a1827)
      drop-shadow(2px 5px 3px #00000035);
  }
  :global(html[data-theme='light']) .art-ticket,
  :global(html[data-theme='light']) .art-spark {
    color: #c84c5c73;
    filter: drop-shadow(-1px -1px 0 #ffffffb0) drop-shadow(2px 3px 0 #a8404e30)
      drop-shadow(3px 5px 3px #70323a18);
  }
  .campaign-strip::before {
    bottom: -145px;
    pointer-events: none;
    mask-image:
      linear-gradient(
        to bottom,
        transparent,
        #000 70px,
        #000 calc(100% - 270px),
        transparent calc(100% - 105px)
      ),
      radial-gradient(
        ellipse 48% 170px at -6% calc(100% - 190px),
        #000 8%,
        #00000080 42%,
        transparent 100%
      );
  }
  .campaign-blend {
    display: none;
  }
  :global(.design.orbit-home .campaign-strip + .showroom::before) {
    display: none;
  }
  @media (prefers-reduced-motion: reduce) {
    article {
      transition: none;
    }
    article:hover {
      translate: none;
    }
  }
  .campaign-copy {
    background: linear-gradient(155deg, #303033, #242427);
  }
  :global(html[data-theme='light']) .campaign-copy {
    background: linear-gradient(155deg, #f1f1f0, #e7e7e6);
  }
  .now > strong {
    color: #f1f5f9;
    text-shadow: 0 2px 3px #00000030;
  }
  :global(html[data-theme='light']) .now > strong {
    color: #202023;
    text-shadow:
      0 1px 0 #fff,
      0 2px 3px #00000012;
  }
  .before {
    color: #bdbdc1;
  }
  :global(html[data-theme='light']) .before {
    color: #666669;
  }
  .now > .current-price-label {
    color: #d3d3d6;
  }
  :global(html[data-theme='light']) .now > .current-price-label {
    color: #535357;
  }
  .price-row {
    border-bottom-color: transparent;
  }
  :global(html[data-theme='light']) .price-row {
    border-bottom-color: transparent;
  }
  .offer-action {
    color: #e1e1e3;
  }
  :global(html[data-theme='light']) .offer-action {
    color: #343437;
  }
  .offer-action :global(svg) {
    color: var(--red);
  }
  .countdown {
    margin-inline: -16px;
    width: auto;
    padding-inline: 27px;
    border-radius: 0;
    border-inline: 0;
    border-top: 1px solid #ffffff0c;
    border-bottom: 1px solid #00000010;
    background:
      radial-gradient(ellipse 80% 160% at 20% 0%, #e3061310, transparent 75%),
      color-mix(in srgb, var(--bg) 96.5%, white);
    box-shadow: none;
  }
  :global(html[data-theme='light']) .countdown {
    background: radial-gradient(ellipse 80% 160% at 20% 0%, #e3061309, transparent 75%), var(--bg);
    border-top-color: #0000000a;
    border-bottom-color: #0000000a;
    box-shadow: none;
  }
  .countdown::before {
    display: none;
  }
  :global(html[data-theme='light']) .countdown > .countdown-label,
  :global(html[data-theme='light']) .countdown-label :global(.campaign-stopwatch) {
    color: #29292d;
  }
  .countdown-unit small {
    color: #c8c8cb;
  }
  :global(html[data-theme='light']) .countdown-unit small {
    color: #626266;
  }
  .countdown > .countdown-label::after {
    background: #ffffff20;
  }
  :global(html[data-theme='light']) .countdown > .countdown-label::after {
    background: #00000015;
  }
  .countdown-label :global(.campaign-stopwatch) {
    color: #edc76e;
    filter: drop-shadow(0 0 2px #f7d98b70) drop-shadow(0 0 6px #dcae4530);
  }
  :global(html[data-theme='light']) .countdown-label :global(.campaign-stopwatch) {
    color: #946615;
    filter: drop-shadow(0 -1px 0 #fff4cf90) drop-shadow(0 0 3px #e1b95640);
  }
  @media (max-width: 700px) {
    .countdown {
      margin-inline: -14px;
      padding-inline: 25px;
    }
  }
  .spacious-heading .campaign-inner {
    padding-top: 56px;
  }
  .campaign-offer-phrase {
    display: inline-block;
  }
  .heading-preposition,
  .campaign-heading-lead {
    color: var(--text);
    background: none;
  }
  @media (prefers-reduced-motion: reduce) {
    h2 em {
      color: var(--text);
      background: none;
    }
    .line-window {
      display: none;
    }
  }
  .campaign-lower-tint {
    position: absolute;
    z-index: -2;
    inset: 0 0 -145px;
    width: min(100%, 1800px);
    pointer-events: none;
    background: linear-gradient(
      156deg,
      transparent 24%,
      #e3061304 36%,
      #e3061314 50%,
      #e306132b 68%
    );
    mask-image:
      linear-gradient(to right, #000, #000000b3 45%, transparent),
      linear-gradient(to bottom, #000 calc(100% - 270px), transparent calc(100% - 105px));
    mask-composite: intersect;
  }
  :global(html[data-theme='light']) .campaign-lower-tint {
    opacity: 0.53;
  }
  .campaign-local-shade {
    display: none;
  }
  @media (min-width: 1101px) {
    .campaign-local-shade {
      display: block;
      position: absolute;
      z-index: -2;
      inset: 0;
      pointer-events: none;
      background: radial-gradient(
        ellipse clamp(90px, 8vw, 240px) 145px at max(0px, calc((100% - 1520px) / 2 - 130px)) 34%,
        #08080b50,
        transparent 85%
      );
    }
  }
  :global(html[data-theme='light']) .campaign-local-shade {
    display: none;
  }
  .campaign-entry-shade {
    display: none;
  }
  .spacious-heading .campaign-entry-shade {
    display: block;
    position: absolute;
    z-index: -1;
    inset: 0 0 auto;
    height: 190px;
    pointer-events: none;
    background: linear-gradient(
      to bottom,
      transparent,
      #09090b55 38px,
      #09090b44 90px,
      transparent
    );
  }
  :global(html[data-theme='light']) .spacious-heading .campaign-entry-shade {
    opacity: 0.3;
  }
  .spacious-heading {
    --heading-extra-space: 24px;
  }
  .spacious-heading .campaign-art {
    top: var(--heading-extra-space);
  }
  .spacious-heading .campaign-art > span:nth-child(3) {
    left: calc(56% + 40px);
  }
  .campaign-orbit-reveal {
    position: absolute;
    z-index: -1;
    inset: 0;
    overflow: hidden;
    pointer-events: none;
    mask-image: linear-gradient(
      to bottom,
      transparent 0,
      #00000018 12px,
      #00000070 28px,
      #000 50px
    );
  }
  .campaign-orbit-reveal .art-orbit {
    position: absolute;
    display: block;
    top: calc(-70px + var(--heading-extra-space));
  }
  .campaign-strip.spacious-heading::before {
    top: -12px;
    mask-image:
      linear-gradient(
        to bottom,
        transparent 0,
        #00000014 14px,
        #00000052 38px,
        #000000a6 72px,
        #000000e3 104px,
        #000 132px,
        #000 calc(100% - 270px),
        transparent calc(100% - 105px)
      ),
      radial-gradient(
        ellipse 48% 170px at -6% calc(100% - 190px),
        #000 8%,
        #00000080 42%,
        transparent 100%
      );
  }
  @media (max-width: 700px) {
    .spacious-heading {
      --heading-extra-space: 18px;
    }
    .spacious-heading .campaign-inner {
      padding-top: 48px;
    }
    .spacious-heading .campaign-art > span:nth-child(3) {
      left: calc(56% + 20px);
    }
  }
  /* One and two offers use a shorter frame than the compact four-card layout. */
  .campaign-rail.single,
  .campaign-rail.pair {
    container-type: inline-size;
    --offer-frame-height: 440px;
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    overflow: visible;
    scroll-snap-type: none;
  }
  .single article,
  .pair article {
    width: 100%;
    max-width: none;
    height: var(--offer-frame-height);
  }
  .single .campaign-link,
  .pair .campaign-link {
    display: grid;
    grid-template-rows: minmax(0, 1fr) auto;
  }
  .single .campaign-photo,
  .pair .campaign-photo {
    height: 100%;
    min-height: 0;
    aspect-ratio: auto;
  }
  .single .photo-caption,
  .pair .photo-caption {
    display: none;
  }
  .single .campaign-photo::after,
  .pair .campaign-photo::after {
    inset-block-start: 75%;
    background: linear-gradient(transparent, #08080920);
  }
  .single .campaign-copy,
  .pair .campaign-copy {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    gap: 18px 20px;
    padding: 20px 22px;
    background:
      radial-gradient(ellipse at 100% 100%, #e3061312 0%, transparent 65%),
      radial-gradient(ellipse at 0% 0%, #e3061305 0%, transparent 50%),
      linear-gradient(130deg, #222326, #17181b);
  }
  :global(html[data-theme='light']) .single .campaign-copy,
  :global(html[data-theme='light']) .pair .campaign-copy {
    background:
      radial-gradient(ellipse at 100% 100%, #e3061308 0%, transparent 65%),
      linear-gradient(130deg, #f4f4f2, #e9e9e6);
  }
  .offer-details {
    min-width: 0;
  }
  .offer-brand {
    margin: 0 0 5px;
    font-size: 10px;
    line-height: 1.3;
    letter-spacing: 0.13em;
    text-transform: uppercase;
    color: var(--muted);
  }
  .offer-details h3 {
    font-size: clamp(23px, 1.8vw, 29px);
    line-height: 1.1;
    color: var(--text);
  }
  .offer-details .specs {
    margin-top: 9px;
    color: var(--muted);
  }
  .single .price-row,
  .pair .price-row {
    padding: 0;
  }
  .single .prices,
  .pair .prices {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    min-height: 0;
    gap: 8px;
  }
  .single .before,
  .pair .before {
    flex-direction: row;
    gap: 7px;
    font-size: 10px;
  }
  .single .before s,
  .pair .before s {
    font-size: 15px;
  }
  .single .now,
  .pair .now {
    align-items: flex-end;
  }
  .single .now > strong,
  .pair .now > strong {
    font-size: clamp(32px, 2.8vw, 42px);
    line-height: 1;
  }
  .single .countdown,
  .pair .countdown {
    grid-column: 1 / -1;
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: flex-start;
    gap: 16px;
    margin: 0;
    padding: 16px 100px 0 0;
    border: 0;
    border-top: 1px solid #ffffff16;
    border-radius: 0;
    background: transparent;
    box-shadow: none;
  }
  :global(html[data-theme='light']) .single .countdown,
  :global(html[data-theme='light']) .pair .countdown {
    background: transparent;
    border-top-color: #00000014;
    box-shadow: none;
  }
  .single .countdown-label,
  .pair .countdown-label {
    flex: 0 0 auto;
    font-size: 10px;
  }
  .single .countdown-label::after,
  .pair .countdown-label::after {
    display: none;
  }
  .single .countdown time,
  .pair .countdown time {
    width: min(100%, 220px);
    flex: 0 1 220px;
    margin: 0;
  }
  .pair .offer-action {
    position: absolute;
    right: 22px;
    bottom: 26px;
    margin: 0;
  }
  .single .offer-action {
    grid-column: 1 / -1;
  }
  @media (min-width: 701px) {
    .campaign-rail.pair {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
    .campaign-inner:has(.pair) .rail-controls {
      display: none;
    }
  }
  @media (min-width: 701px) and (max-width: 1100px) {
    .campaign-rail.single,
    .campaign-rail.pair {
      --offer-frame-height: 440px;
    }
  }
  @media (min-width: 701px) and (max-width: 1199px) {
    .pair .campaign-copy {
      gap: 14px;
      padding: 18px;
    }
    .pair .offer-details h3 {
      font-size: 22px;
    }
    .pair .prices {
      gap: 6px;
    }
    .pair .before {
      flex-direction: column;
      align-items: flex-end;
    }
    .pair .now > strong {
      font-size: 32px;
    }
    .pair .countdown,
    :global(html[data-theme='light']) .pair .countdown {
      flex-direction: column;
      align-items: flex-start;
      gap: 8px;
      padding-right: 90px;
    }
    .pair .countdown time {
      flex: none;
      width: min(100%, 210px);
    }
    .pair .offer-action {
      right: 18px;
    }
  }
  @media (min-width: 900px) {
    .single .campaign-link {
      grid-template-columns: minmax(0, 1.55fr) minmax(340px, 1fr);
      grid-template-rows: minmax(0, 1fr);
    }
    .single .campaign-photo {
      border-radius: 11px 0 0 11px;
    }
    .single .campaign-copy {
      display: flex;
      flex-direction: column;
      align-items: stretch;
      justify-content: center;
      gap: 14px;
      padding: 22px;
      border-radius: 0 11px 11px 0;
    }
    .single .offer-details h3 {
      font-size: clamp(28px, 2.3vw, 32px);
    }
    .single .price-row {
      padding-top: 14px;
      border-top: 1px solid #ffffff16;
    }
    :global(html[data-theme='light']) .single .price-row {
      border-top-color: #00000014;
    }
    .single .prices {
      align-items: flex-start;
      gap: 8px;
    }
    .single .now {
      align-items: flex-start;
    }
    .single .now > strong {
      font-size: clamp(40px, 3.6vw, 52px);
    }
    .single .countdown {
      flex-direction: column;
      align-items: flex-start;
      padding: 14px 0 0;
      gap: 8px;
    }
    .single .countdown time {
      width: min(100%, 300px);
      flex: none;
    }
  }
  @media (max-width: 700px) {
    .campaign-rail.single,
    .campaign-rail.pair {
      --offer-frame-height: calc((100cqw * 0.88 - 2px) / 1.08 + 220px);
    }
    .campaign-rail.pair {
      display: flex;
      overflow-x: auto;
      scroll-snap-type: x mandatory;
    }
    .pair article {
      flex: 0 0 88%;
      width: auto;
    }
    .single .photo-caption,
    .pair .photo-caption {
      display: block;
    }
    .single .campaign-photo::after,
    .pair .campaign-photo::after {
      inset-block-start: 36%;
      background: linear-gradient(transparent 0%, #0a0a0b26 30%, #080809e8 100%);
    }
    .single .offer-details,
    .pair .offer-details {
      display: none;
    }
    .single .campaign-copy,
    .pair .campaign-copy {
      display: flex;
      flex-direction: column;
      align-items: stretch;
      gap: 12px;
      padding: 16px;
    }
    .single .prices,
    .pair .prices {
      flex-direction: row;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }
    .single .before,
    .pair .before {
      flex-direction: column;
      align-items: flex-start;
    }
    .single .now > strong,
    .pair .now > strong {
      font-size: clamp(30px, 9.5vw, 40px);
    }
    .single .countdown,
    .pair .countdown {
      flex-direction: column;
      align-items: center;
      gap: 8px;
      padding: 12px 0 0;
    }
    .single .countdown time,
    .pair .countdown time {
      width: min(100%, 280px);
      flex: none;
    }
    .pair .offer-action {
      position: static;
    }
  }
  @media (max-width: 360px) {
    .campaign-rail.single,
    .campaign-rail.pair {
      --offer-frame-height: calc((100cqw * 0.88 - 2px) / 1.08 + 223px);
    }
  }
  .pair article {
    height: calc(var(--offer-frame-height) + 24px);
  }
  @media (max-width: 700px) {
    .pair article {
      height: calc(var(--offer-frame-height) + 12px);
    }
  }
  /* Two offers use the photograph for identity, keeping the footer concise. */
  .pair .campaign-copy {
    background: linear-gradient(130deg, #222326, #17181b);
  }
  :global(html[data-theme='light']) .pair .campaign-copy {
    background: linear-gradient(130deg, #f4f4f2, #e9e9e6);
  }
  @media (min-width: 701px) {
    .pair .photo-caption {
      display: block;
    }
    .pair .campaign-photo::after {
      inset-block-start: 50%;
      background: linear-gradient(transparent, #080809d9);
    }
    .pair .offer-details {
      display: none;
    }
    .pair .campaign-copy {
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
      gap: 8px 24px;
      padding: 14px 22px 12px;
    }
    .pair .prices,
    .pair .now {
      align-items: flex-start;
    }
    .pair .before {
      flex-direction: row;
      align-items: center;
    }
    .pair .countdown {
      grid-column: auto;
      flex-direction: column;
      align-items: center;
      padding: 0 0 0 20px;
      border-top: 0;
      border-left: 1px solid #ffffff16;
      gap: 8px;
    }
    :global(html[data-theme='light']) .pair .countdown {
      border-left-color: #00000014;
    }
    .pair .countdown time {
      flex: none;
      width: min(100%, 240px);
    }
    .pair .offer-action {
      position: static;
      grid-column: 1 / -1;
      justify-self: end;
    }
  }
  @media (min-width: 701px) and (max-width: 1199px) {
    .pair .campaign-copy {
      grid-template-columns: minmax(0, 1fr);
      gap: 8px;
      padding: 12px 18px;
    }
    .pair .prices {
      flex-direction: row;
      align-items: center;
      justify-content: space-between;
    }
    .pair .before {
      flex-direction: column;
      align-items: flex-start;
    }
    .pair .now {
      align-items: flex-end;
    }
    .pair .countdown {
      flex-direction: row;
      justify-content: space-between;
      padding: 12px 0 0;
      border-left: 0;
      border-top: 1px solid #ffffff16;
      gap: 12px;
    }
    .pair .countdown time {
      flex: 0 1 210px;
    }
  }
  @media (max-width: 700px) {
    .pair .campaign-copy {
      padding: 12px 16px;
      gap: 10px;
    }
  }
  .pair .campaign-copy {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 14px 20px;
    padding: 18px 22px 16px;
  }
  .pair .price-row {
    grid-column: 1;
    grid-row: 1;
  }
  .pair .prices {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }
  .pair .before {
    flex-direction: row;
    align-items: center;
  }
  .pair .now {
    align-items: flex-start;
  }
  .pair .offer-action {
    grid-column: 2;
    grid-row: 1;
    align-self: center;
    justify-self: end;
  }
  .pair .countdown,
  :global(html[data-theme='light']) .pair .countdown {
    grid-column: 1 / -1;
    grid-row: 2;
    flex-direction: row;
    justify-content: space-between;
    align-items: baseline;
    gap: 8px;
    padding: 12px 0 0;
    border-left: 0;
    border-top: 1px solid #ffffff12;
  }
  :global(html[data-theme='light']) .pair .countdown {
    border-top-color: #00000014;
  }
  .campaign-rail .countdown time {
    display: flex;
    width: auto;
    flex: 0 0 auto;
    gap: 12px;
  }
  .campaign-rail .countdown-unit {
    flex: 0 0 auto;
    width: auto;
    display: flex;
    flex-direction: row;
    align-items: baseline;
    gap: 3px;
  }
  .campaign-rail .countdown-unit strong,
  :global(html[data-theme='light']) .campaign-rail .countdown-unit strong {
    display: inline;
    min-height: 0;
    padding: 0;
    font-family: inherit;
    font-size: 15px;
    font-weight: 550;
    line-height: 1.2;
    color: var(--text);
    background: none;
    border: 0;
    box-shadow: none;
    text-shadow: none;
    font-variant-numeric: tabular-nums;
  }
  .campaign-rail .countdown-unit small,
  :global(html[data-theme='light']) .campaign-rail .countdown-unit small {
    font-size: 10px;
    font-weight: 400;
    letter-spacing: 0;
    text-transform: none;
    color: var(--muted);
  }
  .campaign-rail .countdown > .countdown-label,
  :global(html[data-theme='light']) .campaign-rail .countdown > .countdown-label {
    color: var(--muted);
    font-size: 11px;
    font-weight: 400;
    letter-spacing: 0;
    text-transform: none;
  }
  @media (max-width: 1199px) {
    .pair .campaign-copy {
      padding: 16px;
      gap: 12px;
    }
    .pair .before {
      font-size: 9px;
      gap: 5px;
    }
    .pair .before s {
      font-size: 13px;
    }
    .pair .countdown time {
      gap: 8px;
    }
    .pair .countdown-unit strong {
      font-size: 14px;
    }
    .pair .countdown-unit small {
      font-size: 9px;
    }
    .pair .countdown > .countdown-label {
      font-size: 10px;
    }
    .pair .now > strong {
      font-size: 32px;
    }
    .pair .offer-action {
      font-size: 10px;
      gap: 4px;
    }
  }
  .pair .now > strong {
    position: relative;
    padding-left: 13px;
  }
  .pair .now > strong::before {
    content: '';
    position: absolute;
    left: 0;
    top: 16%;
    height: 68%;
    width: 3px;
    border-radius: 1px;
    background: var(--red, #e30613);
  }
  /* Bring the secondary information beside the price instead of leaving a blank row. */
  @media (min-width: 1200px) {
    .pair .campaign-copy {
      grid-template-columns: minmax(0, 1fr) auto;
      padding: 16px 22px;
      gap: 12px 24px;
    }
    .pair .price-row {
      grid-row: 1 / 3;
    }
    .pair .countdown,
    :global(html[data-theme='light']) .pair .countdown {
      grid-column: 2;
      grid-row: 1;
      flex-direction: column;
      align-items: flex-end;
      gap: 7px;
      padding: 0;
      border: 0;
    }
    .pair .offer-action {
      grid-column: 2;
      grid-row: 2;
      align-self: end;
    }
  }
  @media (max-width: 1199px) {
    .pair .campaign-copy {
      padding-block: 12px;
      gap: 10px;
    }
    .pair .prices {
      gap: 6px;
    }
  }
  .pair .campaign-copy {
    grid-template-columns: auto minmax(0, 1fr);
  }
  .pair .price-row {
    grid-column: 2;
    justify-self: end;
  }
  .pair .prices,
  .pair .now {
    align-items: flex-end;
    text-align: right;
  }
  .pair .before {
    justify-content: flex-end;
  }
  .pair .offer-action {
    grid-column: 1;
    justify-self: start;
  }
  @media (min-width: 1200px) {
    .pair .countdown,
    :global(html[data-theme='light']) .pair .countdown {
      grid-column: 1;
      align-items: flex-start;
    }
    .pair .offer-action {
      grid-column: 1;
    }
  }
  .single .countdown {
    align-items: flex-start;
    flex-direction: column;
    gap: 8px;
  }
  @media (min-width: 900px) {
    .single .campaign-copy {
      gap: 20px;
    }
    .single .countdown {
      padding-top: 18px;
    }
  }
  .single .countdown-unit strong,
  :global(html[data-theme='light']) .single .countdown-unit strong {
    font-size: 20px;
  }
  .single .countdown-unit small,
  :global(html[data-theme='light']) .single .countdown-unit small {
    font-size: 12px;
  }
  .campaign-rail .countdown-unit strong,
  :global(html[data-theme='light']) .campaign-rail .countdown-unit strong {
    font-size: 20px;
  }
  .campaign-rail .countdown-unit small,
  :global(html[data-theme='light']) .campaign-rail .countdown-unit small {
    font-size: 12px;
  }
  .campaign-rail .countdown-label::after {
    display: none;
  }
  .campaign-rail:not(.single):not(.pair) {
    --offer-frame-height: calc((min(300px, (100cqw - 60px) / 4) - 2px) * 1.04 + 261px);
  }
  .campaign-rail:not(.single):not(.pair) article {
    height: var(--offer-frame-height);
  }
  .campaign-rail:not(.single):not(.pair) .campaign-link {
    display: grid;
    grid-template-rows: minmax(0, 1fr) auto;
  }
  .campaign-rail:not(.single):not(.pair) .campaign-photo {
    height: 100%;
    min-height: 0;
    aspect-ratio: auto;
  }
  .campaign-rail:not(.single):not(.pair) .countdown,
  :global(html[data-theme='light']) .campaign-rail:not(.single):not(.pair) .countdown {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
    margin: 0;
    padding: 12px 0 0;
    border: 0;
    border-top: 1px solid #ffffff16;
    background: transparent;
    box-shadow: none;
  }
  :global(html[data-theme='light']) .campaign-rail:not(.single):not(.pair) .countdown {
    border-top-color: #00000014;
  }
  .campaign-rail .countdown time {
    max-width: 100%;
  }
  @media (min-width: 701px) and (max-width: 1100px) {
    .campaign-rail:not(.single):not(.pair) {
      --offer-frame-height: calc(((100cqw - 20px) / 2 - 2px) * 0.8 + 261px);
    }
  }
  @media (max-width: 700px) {
    .campaign-rail:not(.single):not(.pair) {
      --offer-frame-height: calc((100cqw * 0.88 - 2px) / 1.08 + 252px);
    }
    .pair .countdown,
    :global(html[data-theme='light']) .pair .countdown {
      flex-direction: column;
      align-items: flex-start;
      gap: 8px;
    }
  }
  @media (max-width: 360px) {
    .campaign-rail:not(.single):not(.pair) {
      --offer-frame-height: calc((100cqw * 0.88 - 2px) / 1.08 + 247px);
    }
  }
  /* Three and four offers keep the same width, with less height in both the photo
   * and the information area. Other offer counts retain their proportions. */
  .campaign-rail:is(.three, .four):not(.single):not(.pair) article {
    height: calc(var(--offer-frame-height) - 94px);
  }
  .campaign-rail:is(.three, .four) .campaign-copy {
    padding-block: 8px;
    gap: 6px;
  }
  .campaign-rail:is(.three, .four):not(.single):not(.pair) .countdown,
  :global(html[data-theme='light']) .campaign-rail:is(.three, .four):not(.single):not(.pair) .countdown {
    padding-top: 8px;
    gap: 6px;
  }
  @media (max-width: 700px) {
    .campaign-rail:is(.three, .four):not(.single):not(.pair) article {
      height: calc(var(--offer-frame-height) - 48px);
    }
  }
  @media (max-width: 700px) {
    /* Touch navigation needs only the swipeable rail. Keep the lower artwork;
     * remove the cluster of competing motifs around the mobile heading. */
    .rail-controls,
    .campaign-art > span:nth-child(3),
    .campaign-orbit-reveal {
      display: none;
    }
    .campaign-art > .art-ticket {
      display: block;
      width: 80px;
      height: 80px;
      top: -8px;
      left: auto;
      right: 16px;
      color: #dc5268b3;
      opacity: 0.9;
      filter: none;
    }
    .campaign-art > .art-ticket :global(svg) {
      width: 100%;
      height: 100%;
      stroke-width: 1.4px;
    }
    .campaign-art > span:first-child {
      opacity: 0.45;
    }
    .campaign-motifs > .art-car {
      display: none;
    }
    .campaign-motifs > .art-key {
      left: calc(44% - 88px);
      top: 105px;
    }
    .campaign-art > i {
      mask-image:
        linear-gradient(to bottom, transparent, #000 300px),
        linear-gradient(110deg, #000, transparent 48%, #000);
      mask-composite: intersect;
    }
    .campaign-strip::after {
      mask-image: linear-gradient(to bottom, transparent 30%, #000 65%);
    }
    .campaign-rail.single article,
    .campaign-rail.pair article,
    .campaign-rail:not(.single):not(.pair) article,
    .campaign-rail:is(.three, .four):not(.single):not(.pair) article {
      height: clamp(390px, calc(55vw + 210px), 450px);
    }
    .campaign-rail .campaign-copy {
      padding-block: 8px;
      gap: 6px;
    }
    .campaign-rail.single .countdown,
    .campaign-rail.pair .countdown,
    .campaign-rail:not(.single):not(.pair) .countdown,
    .campaign-rail:is(.three, .four):not(.single):not(.pair) .countdown,
    :global(html[data-theme='light']) .campaign-rail .countdown {
      padding-top: 8px;
      gap: 6px;
    }
  }
  .campaign-rail:is(.three, .four) .campaign-copy {
    gap: 4px;
  }
  .campaign-rail:is(.three, .four) .price-row {
    padding-block: 0 4px;
  }
  .campaign-rail:is(.three, .four) .before,
  .campaign-rail:is(.three, .four) .now {
    gap: 3px;
  }
  .campaign-rail:is(.three, .four):not(.single):not(.pair) .countdown,
  :global(html[data-theme='light']) .campaign-rail:is(.three, .four):not(.single):not(.pair) .countdown {
    padding-top: 6px;
    gap: 4px;
  }
  @media (max-width: 700px) {
    .campaign-rail:is(.three, .four):not(.single):not(.pair) article {
      height: calc(clamp(390px, calc(55vw + 210px), 450px) - 30px);
    }
  }
  .campaign-inner.three-offers {
    padding-bottom: 72px;
  }
  .campaign-rail.three .campaign-copy {
    padding-block: 5px;
    gap: 3px;
  }
  .campaign-rail:is(.three, .four):not(.single):not(.pair) article {
    container-type: inline-size;
    height: auto;
  }
  .campaign-rail:is(.three, .four):not(.single):not(.pair) .campaign-link {
    height: auto;
    grid-template-rows: auto auto;
  }
  .campaign-rail:is(.three, .four):not(.single):not(.pair) .campaign-photo {
    /* Follow the showroom photo proportions, with a slightly tighter caption area. */
    height: clamp(220px, calc(100cqw / 1.4 + 48px), 330px);
  }
  @media (min-width: 701px) {
    .campaign-rail.three:not(.single):not(.pair) .campaign-photo {
      height: clamp(226px, calc(100cqw / 1.8 + 30px), 296px);
    }
  }
  @media (max-width: 700px) {
    .campaign-rail.three:not(.single):not(.pair) .campaign-photo {
      height: clamp(226px, calc(100cqw / 1.4 + 54px), 336px);
    }
  }
  @media (min-width: 1101px) {
    .campaign-intro {
      /* Match the visible glyph-to-card gap in the showroom. Its title has
       * no descenders; allow for that optical space and the rail's 8px inset.
       * Below this breakpoint the showroom filters stack above the cards. */
      margin-bottom: calc(var(--orbit-space-heading) + var(--orbit-title-section) * 0.18 - 8px);
    }
  }
  @media (max-width: 700px) {
    .campaign-inner.three-offers {
      padding-bottom: 62px;
    }
  }
</style>
