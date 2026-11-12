<script lang="ts">
  import { publicPrice, type PublicVehicle } from '$lib/publicVehicles';
  let { promotion }: { promotion: NonNullable<PublicVehicle['promotion']> } = $props();
  const dateTime = new Intl.DateTimeFormat('pt-PT', {
    timeZone: 'Europe/Lisbon',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
</script>

<div class="promotion-terms">
  <span>Preço base <s>{publicPrice(promotion.referencePrice)}</s></span>
  <span
    >De <time datetime={promotion.startsAt}>{dateTime.format(new Date(promotion.startsAt))}</time>
    a <time datetime={promotion.endsAt}>{dateTime.format(new Date(promotion.endsAt))}</time></span
  >
</div>

<style>
  .promotion-terms {
    display: grid;
    gap: 3px;
    font-size: 11px;
    line-height: 1.45;
    color: var(--muted, currentColor);
  }
  s,
  time {
    white-space: nowrap;
  }
</style>
