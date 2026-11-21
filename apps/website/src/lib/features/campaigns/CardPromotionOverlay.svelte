<script lang="ts">
  import { promotionSaving, formatVehiclePrice, type PublicVehicle } from '$lib/publicVehicles';
  import { visibleClock } from './visibleClock';
  import PromotionRibbon from '../../../../../../shared/ui/PromotionRibbon.svelte';
  let {
    price,
    promotion,
    belowCategory = false,
  }: {
    price: string | number | null;
    promotion: NonNullable<PublicVehicle['promotion']>;
    belowCategory?: boolean;
  } = $props();
  let now = $state<number | null>(null);
  let overlay = $state<HTMLSpanElement>();
  const end = $derived(Date.parse(promotion.endsAt));
  const discount = $derived(promotionSaving(promotion.referencePrice, price));
  const date = new Intl.DateTimeFormat('pt-PT', {
    timeZone: 'Europe/Lisbon',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
  const remaining = $derived.by(() => {
    if (now === null) return null;
    if (end <= now) return 'Terminada';
    return parts.map((part) => `${part.value}${part.label}`).join(' ');
  });
  const parts = $derived.by(() => {
    const seconds = Math.max(0, Math.ceil((end - (now ?? end)) / 1000));
    return [
      { value: Math.floor(seconds / 86400), label: 'd' },
      { value: Math.floor((seconds % 86400) / 3600), label: 'h' },
      { value: Math.floor((seconds % 3600) / 60), label: 'min' },
      { value: seconds % 60, label: 's' },
    ];
  });
  $effect(() => {
    if (!overlay) return;
    return visibleClock(
      overlay,
      (time) => {
        now = time;
      },
      1000,
      end,
    );
  });
</script>

<span bind:this={overlay} class="card-promotion-overlay" class:below-category={belowCategory}>
  <PromotionRibbon label={`−${formatVehiclePrice(discount)}`} ariaLabel={`${formatVehiclePrice(discount)} de desconto`} />
  <time
    class="promotion-remaining"
    datetime={promotion.endsAt}
    aria-label={remaining ? `Termina em ${remaining}` : `Até ${date.format(new Date(end))}`}
    title={`Fim da campanha: ${date.format(new Date(end))} (Lisboa)`}
  >
    {#if now !== null && remaining !== 'Terminada'}
      <span class="mini-countdown" aria-hidden="true">
        {#each parts as part}
          <span class="mini-unit"
            ><strong>{String(part.value).padStart(2, '0')}</strong><small>{part.label}</small></span
          >
        {/each}
      </span>
    {:else}<b class="timer-fallback">{remaining ?? date.format(new Date(end))}</b>{/if}
  </time>
</span>

<style>
  .card-promotion-overlay {
    position: absolute;
    z-index: 2;
    inset: 0;
    pointer-events: none;
  }
  .promotion-remaining {
    position: absolute;
    top: 12px;
    left: 12px;
    display: inline-flex;
    padding: 8px 10px;
    border-radius: 3px;
    background: #141418c9;
    color: #f1f5f9;
    font-variant-numeric: tabular-nums;
  }
  .below-category .promotion-remaining {
    top: 52px;
  }
  .mini-countdown {
    display: flex;
    align-items: baseline;
    gap: 10px;
  }
  .mini-unit {
    display: inline-flex;
    align-items: baseline;
    gap: 3px;
  }
  .mini-unit strong {
    font-size: 14px;
    line-height: 1.2;
    font-weight: 600;
    letter-spacing: -0.04em;
  }
  .mini-unit small {
    color: #d6d6db;
    font-size: 9px;
    line-height: 1;
    font-weight: 400;
  }
  .timer-fallback {
    font-size: 11px;
    line-height: 1.4;
    font-weight: 500;
  }
</style>
