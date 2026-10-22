<script lang="ts">
  import { navigating } from '$app/stores';
</script>

{#if $navigating}
  <div class="navigation-progress" role="status" aria-label="A abrir página">
    <span aria-hidden="true"></span>
  </div>
{/if}

<style>
  .navigation-progress {
    position: fixed;
    inset: 0 0 auto;
    height: 3px;
    z-index: 10000;
    overflow: hidden;
    background: color-mix(in srgb, #e30613 18%, transparent);
    pointer-events: none;
  }
  .navigation-progress span {
    display: block;
    width: 35%;
    height: 100%;
    background: #e30613;
    animation: loading 1s ease-in-out infinite;
  }
  @keyframes loading {
    from {
      transform: translateX(-100%);
    }
    to {
      transform: translateX(390%);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .navigation-progress span {
      animation: none;
      width: 100%;
    }
  }
</style>
