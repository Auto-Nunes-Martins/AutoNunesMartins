<script lang="ts">
  import { priceEmphasis } from './priceEmphasis';
  let { value, prices, vehicle }: { value: string; prices: string[]; vehicle?: string } = $props();
</script>

<span class="featured-price">
  <span class="readable-price">{value}</span><span class="visual-price" aria-hidden="true"
    >{#each [value, ...prices] as price}<span class="price-sizer">{price}</span>{/each}<span
      class="price-amount"
      use:priceEmphasis={vehicle}>{value}</span
    ></span
  >
</span>

<style>
  .featured-price,
  .visual-price {
    white-space: pre;
  }
  .visual-price {
    display: inline-grid;
    position: relative;
    vertical-align: bottom;
  }
  .price-sizer {
    display: block;
    grid-area: 1 / 1;
    font-size: 1.06em;
    visibility: hidden;
  }
  .price-amount {
    position: absolute;
    right: 0;
    bottom: 0;
    color: #fafafa;
    text-shadow: none;
    filter: none;
    background: none;
    transform: none;
    transform-origin: right bottom;
  }
  .readable-price {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
</style>
