<script lang="ts">
  import { ArrowUpRight } from 'lucide-svelte';
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
  import PromotionTerms from './PromotionTerms.svelte';

  let { vehicles, promotional = false }: { vehicles: PublicVehicle[]; promotional?: boolean } =
    $props();
  const sectionId = $derived(promotional ? 'campanhas' : 'selecao-do-stand');
  const validity = new Intl.DateTimeFormat('pt-PT', {
    timeZone: 'Europe/Lisbon',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
</script>

{#if vehicles.length}
  <section class="stand-selection" id={sectionId} aria-labelledby={`${sectionId}-heading`}>
    <div class="selection-heading">
      <h2 id={`${sectionId}-heading`}>
        {promotional ? 'Campanhas' : 'Seleção do stand'}<span>.</span>
      </h2>
      <a class="stock-link" href="/viaturas"
        >Explorar stock <ArrowUpRight size={18} aria-hidden="true" /></a
      >
    </div>
    <div class="selection-grid" class:single={vehicles.length === 1}>
      {#each vehicles as vehicle (vehicle.slug)}
        {@const photo = vehicle.photos.length ? publicPhoto(vehicle, 0) : catalogPlaceholder}
        <article class="selection-card">
          <a class="vehicle-link" href={publicHref(vehicle.slug)}>
            <div class="vehicle-photo">
              <img
                src={sizedPhoto(photo, 960)}
                srcset={vehiclePhotoSet(photo)}
                sizes="(max-width: 700px) 100vw, 50vw"
                alt={`${vehicle.brand} ${vehicle.model}`}
                loading="lazy"
              />
              {#if vehicle.promotion}
                <span class="reduction"
                  >−{(
                    Math.floor(
                      (1 - Number(vehicle.price) / Number(vehicle.promotion.referencePrice)) * 1000,
                    ) / 10
                  ).toLocaleString('pt-PT')}%</span
                >
              {/if}
            </div>
            <div class="vehicle-copy">
              <div>
                <p class="brand">{vehicle.brand}</p>
                <h3>{vehicle.model}</h3>
                <p class="specs">
                  <span>{vehicle.year}</span>{#if vehicle.mileage !== null}<span
                      >{publicMileage(vehicle.mileage)}</span
                    >{/if}<span>{fuelLabels[vehicle.fuel]}</span>
                </p>
              </div>
              <div class="price-area">
                <span class="price-label"
                  >{vehicle.promotion ? 'Preço promocional' : 'Preço da viatura'}</span
                >
                <strong class="price">{publicPrice(vehicle.price)}</strong>
                {#if vehicle.promotion}
                  <PromotionTerms promotion={vehicle.promotion} />
                {:else if vehicle.priceValidUntil}
                  <p class="validity">
                    Preço válido até <time datetime={vehicle.priceValidUntil}
                      >{validity.format(new Date(vehicle.priceValidUntil))}</time
                    > (Lisboa)
                  </p>
                {/if}
              </div>
              <div class="card-footer">
                <span>Conhecer a viatura</span><span class="arrow"
                  ><ArrowUpRight size={22} aria-hidden="true" /></span
                >
              </div>
            </div>
          </a>
        </article>
      {/each}
    </div>
  </section>
{/if}

<style>
  .stand-selection {
    width: 92%;
    max-width: 1440px;
    margin-inline: auto;
    padding-block: clamp(40px, 6vw, 88px);
    scroll-margin-top: 90px;
  }
  .selection-heading {
    display: flex;
    align-items: end;
    justify-content: space-between;
    gap: 24px;
    padding-bottom: 24px;
    border-bottom: 1px solid var(--line);
    margin-bottom: 28px;
  }
  h2 {
    margin: 0;
    font-family: 'Orbit Inter', sans-serif;
    font-size: clamp(36px, 5vw, 68px);
    font-weight: 600;
    letter-spacing: -0.055em;
    line-height: 1;
  }
  h2 > span {
    color: var(--red);
  }
  .stock-link {
    display: inline-flex;
    align-items: center;
    gap: 12px;
    flex-shrink: 0;
    padding-block: 8px;
    color: var(--text);
    font-size: 13px;
    text-decoration: none;
  }
  .stock-link:hover {
    text-decoration: underline;
  }
  .selection-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 24px;
  }
  .selection-card {
    min-width: 0;
    border: 1px solid var(--line);
    border-radius: 16px;
    overflow: hidden;
    background: color-mix(in srgb, var(--text) 3%, var(--bg));
  }
  .vehicle-link {
    display: flex;
    flex-direction: column;
    height: 100%;
    color: var(--text);
    text-decoration: none;
  }
  .vehicle-link:focus-visible {
    outline: 3px solid var(--red);
    outline-offset: -4px;
  }
  .vehicle-photo {
    position: relative;
    aspect-ratio: 16 / 10;
    overflow: hidden;
    background: var(--line);
  }
  .vehicle-photo img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
    transition: transform 350ms ease;
  }
  .reduction {
    position: absolute;
    top: 18px;
    left: 18px;
    border-radius: 6px;
    padding: 9px 12px;
    background: #ba2532;
    color: white;
    font-size: 18px;
    font-weight: 650;
  }
  .vehicle-copy {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 24px;
    padding: clamp(20px, 2.4vw, 32px);
  }
  .brand {
    margin: 0 0 6px;
    color: var(--muted);
    text-transform: uppercase;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.12em;
  }
  h3 {
    margin: 0;
    font-size: clamp(26px, 2.6vw, 38px);
    font-weight: 600;
    letter-spacing: -0.04em;
    line-height: 1.1;
    overflow-wrap: anywhere;
  }
  .specs {
    display: flex;
    flex-wrap: wrap;
    gap: 6px 0;
    margin: 12px 0 0;
    font-size: 12px;
    color: var(--muted);
  }
  .specs span + span::before {
    content: '·';
    padding-inline: 10px;
  }
  .price-area {
    display: grid;
    gap: 8px;
    margin-top: auto;
  }
  .price-label {
    font-size: 11px;
    color: var(--muted);
  }
  .price {
    font-size: clamp(38px, 4vw, 56px);
    font-weight: 600;
    letter-spacing: -0.055em;
    line-height: 1.05;
    font-variant-numeric: tabular-nums;
  }
  .validity {
    margin: 2px 0 0;
    max-width: 100%;
    font-size: 11px;
    line-height: 1.5;
    color: var(--muted);
  }
  .card-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding-top: 16px;
    border-top: 1px solid var(--line);
    font-size: 13px;
    font-weight: 500;
  }
  .arrow {
    display: grid;
    place-items: center;
    width: 40px;
    height: 40px;
    border: 1px solid var(--line);
    border-radius: 50%;
    transition:
      background 180ms ease,
      color 180ms ease;
  }
  .single {
    grid-template-columns: 1fr;
  }
  .single .vehicle-link {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .single .vehicle-photo {
    aspect-ratio: auto;
    min-height: 380px;
  }
  @media (hover: hover) {
    .vehicle-link:hover .vehicle-photo img {
      transform: scale(1.025);
    }
    .vehicle-link:hover .arrow {
      background: var(--text);
      color: var(--bg);
    }
  }
  @media (max-width: 700px) {
    .stand-selection {
      width: 90%;
    }
    .selection-heading {
      align-items: start;
      flex-direction: column;
      gap: 12px;
      padding-bottom: 16px;
      margin-bottom: 20px;
    }
    .selection-grid {
      grid-template-columns: 1fr;
      gap: 20px;
    }
    .single .vehicle-link {
      display: flex;
    }
    .single .vehicle-photo {
      aspect-ratio: 16 / 10;
      min-height: 0;
    }
    .vehicle-copy {
      gap: 22px;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .vehicle-photo img,
    .arrow {
      transition: none;
    }
  }
</style>
