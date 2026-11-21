<script lang="ts">
  import { formatVehiclePrice, type PublicVehicle } from '$lib/publicVehicles';
  let {
    price,
    promotion,
  }: {
    price: string | number | null;
    promotion: NonNullable<PublicVehicle['promotion']>;
  } = $props();
</script>

<div class="card-promotion">
  <s class="previous-price" aria-label={`Preço anterior: ${formatVehiclePrice(promotion.referencePrice)}`}
    >{formatVehiclePrice(promotion.referencePrice)}</s
  >
  <strong class="current-price" aria-label={`Preço atual: ${formatVehiclePrice(price)}`}
    >{formatVehiclePrice(price)}</strong
  >
</div>

<style>
  .card-promotion {
    display: grid;
    justify-items: end;
    gap: 3px;
    flex-shrink: 0;
  }
  .previous-price {
    color: var(--muted);
    font-size: 16px;
    line-height: 1.3;
    text-decoration-color: var(--red);
    text-decoration-thickness: 1.5px;
    white-space: nowrap;
  }
  .current-price {
    color: var(--text);
    font-size: clamp(30px, 9cqw, 36px);
    font-weight: 750;
    line-height: 1.3;
    letter-spacing: -0.045em;
    text-shadow: none;
    white-space: nowrap;
  }
</style>
