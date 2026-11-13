<script lang="ts">
  import PromotionRibbonFabric from './PromotionRibbonFabric.svelte';
  let { label, ariaLabel, scale = 1 }: { label: string; ariaLabel: string; scale?: number } = $props();
</script>

<span class="promotion-ribbon" style:transform={`scale(${scale})`}>
  <span class="promotion-discount" class:long-amount={label.length > 10} aria-label={ariaLabel}>
    <PromotionRibbonFabric /><span class="ribbon-label">{label}</span>
  </span>
</span>

<style>
  .promotion-ribbon {
    position: absolute;
    top: 0;
    right: 0;
    width: 138px;
    height: 116px;
    overflow: hidden;
    pointer-events: none;
    transform-origin: top right;
  }
  .promotion-discount {
    position: absolute;
    top: 23px;
    right: -70px;
    width: 220px;
    padding: 7px 0;
    transform: rotate(40deg);
    background: transparent;
    isolation: isolate;
    color: #fff;
    text-align: center;
    font-size: 20px;
    font-weight: 750;
    line-height: 1.2;
    letter-spacing: -0.04em;
    text-shadow: 0 1px 1px #65000a60;
    white-space: nowrap;
  }
  .promotion-discount.long-amount { font-size: 16px; }
  .ribbon-label { position: relative; }
</style>
