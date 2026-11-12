<script lang="ts">
  import { dev } from '$app/environment';
  import { ArrowUpRight } from 'lucide-svelte';
  import { framingStyle } from '@anm/types';
  import { catalogPlaceholder } from '$lib/localAssets';
  import {
    publicHref,
    publicPhoto,
    publicPrice,
    publicMileage,
    fuelLabels,
    type PublicVehicle,
  } from '$lib/publicVehicles';
  import { sizedPhoto, vehiclePhotoSet } from '$lib/vehiclePhotoSources';

  let { vehicles }: { vehicles: PublicVehicle[] } = $props();
  const offers = $derived(vehicles.filter((vehicle) => vehicle.promotion).slice(0, 4));
  const date = new Intl.DateTimeFormat('pt-PT', {
    timeZone: 'Europe/Lisbon',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
</script>

{#if dev && offers.length}
  <section class="campaign-strip" id="campanhas" aria-labelledby="campaign-heading">
    <div class="campaign-inner">
      <div class="campaign-heading">
        <h2 id="campaign-heading">Campanhas<span>.</span></h2>
        <a class="stock-link" href="/viaturas"
          >Explorar stock <ArrowUpRight size={17} aria-hidden="true" /></a
        >
      </div>
      <div
        class="campaign-rail"
        class:compact={offers.length <= 2}
        class:single={offers.length === 1}
        style={`--offers: ${offers.length}`}
      >
        {#each offers as vehicle (vehicle.slug)}
          {@const promotion = vehicle.promotion!}
          {@const photo = vehicle.photos.length ? publicPhoto(vehicle, 0) : catalogPlaceholder}
          {@const reduction =
            Math.floor((1 - Number(vehicle.price) / Number(promotion.referencePrice)) * 1000) / 10}
          <article>
            <a class="campaign-link" href={publicHref(vehicle.slug)}>
              <div class="campaign-photo">
                <img
                  src={sizedPhoto(photo, 800)}
                  srcset={vehiclePhotoSet(photo)}
                  sizes={offers.length === 1
                    ? '(max-width: 700px) 90vw, 40vw'
                    : '(max-width: 700px) 76vw, (max-width: 1100px) 44vw, 23vw'}
                  style={framingStyle(vehicle.galleryFraming?.[0]?.card ?? undefined)}
                  alt={`${vehicle.brand} ${vehicle.model}`}
                  loading="lazy"
                />
                {#if reduction > 0}
                  <span class="reduction">−{reduction.toLocaleString('pt-PT')}%</span>
                {/if}
              </div>
              <div class="campaign-copy">
                <div class="identity">
                  <p class="brand">{vehicle.brand}</p>
                  <h3>{vehicle.model}</h3>
                  <p class="specs">
                    <span>{vehicle.year}</span><span>{fuelLabels[vehicle.fuel]}</span
                    >{#if vehicle.mileage !== null}<span>{publicMileage(vehicle.mileage)}</span
                      >{/if}
                  </p>
                </div>
                <div class="price-row">
                  <div class="prices">
                    <span class="before">Antes <s>{publicPrice(promotion.referencePrice)}</s></span>
                    <span class="now"
                      ><span>Agora</span><strong>{publicPrice(vehicle.price)}</strong></span
                    >
                  </div>
                  <span class="open-vehicle" aria-label="Conhecer a viatura"
                    ><ArrowUpRight size={20} aria-hidden="true" /></span
                  >
                </div>
                <p class="validity">
                  Até <time datetime={promotion.endsAt}
                    >{date.format(new Date(promotion.endsAt))}</time
                  >
                </p>
              </div>
            </a>
          </article>
        {/each}
      </div>
    </div>
  </section>
{/if}

<style>
  .campaign-strip {
    background: #19191c;
    color: #f5f5f1;
    margin-block: 28px 32px;
    scroll-margin-top: 88px;
  }
  .campaign-inner {
    width: 92%;
    max-width: 1440px;
    margin-inline: auto;
    padding-block: clamp(30px, 3.5vw, 48px);
  }
  .campaign-heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 20px;
    margin-bottom: 28px;
  }
  h2 {
    margin: 0;
    font-family: 'Orbit Inter', 'Inter', sans-serif;
    font-size: clamp(32px, 3.5vw, 48px);
    font-weight: 550;
    letter-spacing: -0.055em;
    line-height: 1.05;
  }
  h2 > span {
    color: #ff3341;
  }
  .stock-link {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    flex-shrink: 0;
    color: #d7d7d9;
    text-decoration: none;
    font-size: 12px;
    padding-block: 10px;
  }
  .stock-link:hover {
    color: white;
    text-decoration: underline;
    text-underline-offset: 5px;
  }
  .campaign-rail {
    display: grid;
    grid-template-columns: repeat(var(--offers), minmax(0, 1fr));
    gap: 28px;
  }
  article {
    min-width: 0;
  }
  .campaign-link {
    display: flex;
    flex-direction: column;
    height: 100%;
    color: inherit;
    text-decoration: none;
  }
  .campaign-photo {
    position: relative;
    aspect-ratio: 16 / 10;
    border-radius: 8px;
    overflow: hidden;
    background: #27272b;
  }
  img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: var(--photo-desktop, 50% 50%);
    transition: transform 350ms ease;
  }
  .reduction {
    position: absolute;
    top: 12px;
    left: 12px;
    background: #e30613;
    color: #fff;
    border-radius: 4px;
    padding: 5px 9px;
    font-size: 13px;
    font-weight: 650;
    font-variant-numeric: tabular-nums;
  }
  .campaign-copy {
    display: flex;
    flex-direction: column;
    flex: 1;
    padding-top: 20px;
  }
  .brand {
    margin: 0 0 4px;
    color: #b4b4ba;
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    font-weight: 600;
  }
  h3 {
    margin: 0;
    font-size: clamp(20px, 1.7vw, 25px);
    font-weight: 550;
    letter-spacing: -0.035em;
    line-height: 1.2;
    overflow-wrap: anywhere;
  }
  .specs {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 0;
    margin: 10px 0 22px;
    color: #b4b4ba;
    font-size: 11px;
  }
  .specs span + span::before {
    content: '·';
    padding-inline: 7px;
    color: #74747c;
  }
  .price-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    margin-top: auto;
    border-top: 1px solid #ffffff21;
    padding-top: 16px;
  }
  .prices {
    display: grid;
    gap: 4px;
  }
  .before {
    font-size: 11px;
    color: #b4b4ba;
  }
  s {
    margin-left: 5px;
    text-decoration-thickness: 1px;
  }
  .now {
    display: flex;
    align-items: baseline;
    gap: 9px;
  }
  .now > span {
    font-size: 11px;
    color: #b4b4ba;
  }
  strong {
    font-size: clamp(27px, 2.25vw, 34px);
    font-weight: 550;
    line-height: 1.15;
    letter-spacing: -0.05em;
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
  }
  .open-vehicle {
    display: grid;
    place-items: center;
    flex-shrink: 0;
    height: 36px;
    width: 36px;
    border: 1px solid #ffffff30;
    border-radius: 50%;
    transition:
      background 180ms,
      border-color 180ms;
  }
  .validity {
    margin: 9px 0 0;
    color: #aaaab2;
    font-size: 10px;
  }
  a:focus-visible {
    outline: 2px solid #ff5863;
    outline-offset: 6px;
    border-radius: 4px;
  }
  @media (hover: hover) {
    .campaign-link:hover img {
      transform: scale(1.035);
    }
    .campaign-link:hover .open-vehicle {
      background: #e30613;
      border-color: #e30613;
    }
  }
  .compact .campaign-link {
    flex-direction: row;
    gap: 24px;
  }
  .compact .campaign-photo {
    width: 46%;
    flex-shrink: 0;
    aspect-ratio: 4 / 3;
  }
  .compact .campaign-copy {
    padding-block: 4px;
    min-width: 0;
  }
  .compact strong {
    font-size: clamp(26px, 2.2vw, 34px);
  }
  .single .campaign-link {
    gap: clamp(28px, 5vw, 72px);
  }
  .single .campaign-photo {
    width: 43%;
    aspect-ratio: 2 / 1;
    max-height: 270px;
  }
  .single .campaign-copy {
    max-width: 500px;
    justify-content: center;
  }
  .single h3 {
    font-size: clamp(28px, 3vw, 40px);
  }
  .single .price-row {
    margin-top: 0;
  }
  .single strong {
    font-size: clamp(32px, 3vw, 42px);
  }
  @media (max-width: 1100px) and (min-width: 701px) {
    .compact:not(.single) .campaign-link {
      flex-direction: column;
      gap: 0;
    }
    .compact:not(.single) .campaign-photo {
      width: 100%;
      aspect-ratio: 16 / 9;
    }
    .compact:not(.single) .campaign-copy {
      padding-top: 18px;
    }
    .campaign-rail {
      gap: 20px;
    }
    .now {
      display: grid;
      gap: 2px;
    }
  }
  @media (max-width: 1100px) and (min-width: 701px) {
    .campaign-rail:not(.compact) {
      grid-template-columns: repeat(var(--offers), minmax(280px, 1fr));
      overflow-x: auto;
      scroll-snap-type: x mandatory;
      padding: 6px 6px 18px;
      margin-inline: -6px;
      scrollbar-width: thin;
      scrollbar-color: #65656d #ffffff12;
    }
    article {
      scroll-snap-align: start;
    }
  }
  @media (max-width: 700px) {
    .campaign-strip {
      margin-block: 20px;
    }
    img {
      object-position: var(--photo-mobile, 50% 50%);
    }
    .campaign-inner {
      width: 100%;
      padding-block: 30px;
    }
    .campaign-heading {
      padding-inline: 5%;
      margin-bottom: 24px;
      gap: 12px;
    }
    .stock-link {
      font-size: 11px;
      gap: 6px;
    }
    .campaign-rail {
      display: flex;
      gap: 20px;
      overflow-x: auto;
      scroll-snap-type: x mandatory;
      scroll-padding-inline: 5vw;
      padding: 6px 5% 20px;
      scrollbar-width: thin;
      scrollbar-color: #65656d #ffffff12;
    }
    article {
      flex: 0 0 83%;
      scroll-snap-align: start;
    }
    .single article {
      flex-basis: 100%;
    }
    .compact .campaign-link,
    .single .campaign-link {
      flex-direction: column;
      gap: 0;
    }
    .compact .campaign-photo,
    .single .campaign-photo {
      width: 100%;
      aspect-ratio: 16 / 10;
      max-height: none;
    }
    .compact .campaign-copy,
    .single .campaign-copy {
      padding: 18px 0 0;
    }
    .single h3,
    h3 {
      font-size: 24px;
    }
    .single strong,
    .compact strong,
    strong {
      font-size: 32px;
    }
    .single .price-row {
      margin-top: auto;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    img,
    .open-vehicle {
      transition: none;
    }
  }
</style>
