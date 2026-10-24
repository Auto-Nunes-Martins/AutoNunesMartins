<script lang="ts">
  import { priceEmphasis } from './priceEmphasis';
  let { value, vehicle }: { value: string; vehicle: string } = $props();
</script>

<span class="featured-price">
  <span class="readable-price">{value}</span><span class="visual-price" aria-hidden="true"
    ><span class="price-sizer">{value}</span><span class="price-amount" use:priceEmphasis={vehicle}>{value}</span></span
  >
</span>

<style>
  .featured-price, .visual-price { white-space: pre; }
  .visual-price { display: inline-block; position: relative; vertical-align: bottom; }
  .price-sizer { display: block; font-size: 1.06em; visibility: hidden; }
  .price-amount {
    position: absolute;
    right: 0;
    bottom: 0;
    color: #fafafa;
    text-shadow: none;
    filter: none;
    background: none;
    transform: none;
  }
  .readable-price {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
  @media (max-width: 700px) {
    .price-amount { left: 0; right: auto; }
  }
</style>
