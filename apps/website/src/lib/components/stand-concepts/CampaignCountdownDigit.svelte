<script lang="ts">
  import { untrack } from 'svelte';

  let { value, paused = false }: { value: string; paused?: boolean } = $props();
  let displayed = $state(untrack(() => value));
  let previous = $state(untrack(() => value));
  let flipping = $state(false);

  $effect(() => {
    const next = value;
    const animate = !paused && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const prior = untrack(() => displayed);
    if (next === prior) {
      if (!animate) flipping = false;
      return;
    }
    previous = prior;
    displayed = next;
    flipping = animate;
    if (!animate) return;
    const timer = window.setTimeout(() => (flipping = false), 420);
    return () => window.clearTimeout(timer);
  });
</script>

<span class="flip-number" aria-hidden="true">
  <span class="face top"><span>{value}</span></span>
  <span class="face bottom"><span>{flipping ? previous : value}</span></span>
  {#if flipping}
    {#key value}
      <span class="leaf">
        <span class="leaf-front"><span>{previous}</span></span>
        <span class="leaf-back"><span>{value}</span></span>
      </span>
    {/key}
  {/if}
</span>

<style>
  .flip-number {
    position: relative;
    display: block;
    width: 100%;
    height: var(--flip-height, 38px);
    perspective: 180px;
    font-family: Consolas, 'Liberation Mono', 'Courier New', monospace;
    font-weight: 700;
    font-variant-numeric: tabular-nums slashed-zero;
    letter-spacing: 0;
  }
  .face,
  .leaf-front,
  .leaf-back {
    position: absolute;
    inset-inline: 0;
    height: 50%;
    overflow: hidden;
  }
  .flip-number::after {
    content: '';
    position: absolute;
    z-index: 3;
    top: calc(var(--flip-height, 38px) / 2);
    inset-inline: 0;
    height: 1px;
    background: #504a401a;
    pointer-events: none;
  }
  .top,
  .leaf-front {
    top: 0;
    background: var(--flip-top, #fff);
    border-radius: 2px 2px 0 0;
  }
  .bottom,
  .leaf-back {
    bottom: 0;
    background: var(--flip-bottom, #f4f1eb);
    border-radius: 0 0 2px 2px;
  }
  .face > span,
  .leaf-front > span,
  .leaf-back > span {
    position: absolute;
    display: grid;
    place-items: center;
    width: 100%;
    height: var(--flip-height, 38px);
  }
  .top > span,
  .leaf-front > span {
    top: 0;
  }
  .bottom > span,
  .leaf-back > span {
    bottom: 0;
  }
  .leaf {
    position: absolute;
    z-index: 2;
    top: 0;
    inset-inline: 0;
    height: 50%;
    transform-origin: center bottom;
    transform-style: preserve-3d;
    animation: turn-page 410ms cubic-bezier(0.45, 0, 0.2, 1) both;
  }
  .leaf-front,
  .leaf-back {
    height: 100%;
    backface-visibility: hidden;
  }
  .leaf-back {
    transform: rotateX(180deg);
  }
  .leaf-front::after {
    content: '';
    position: absolute;
    inset: 0;
    background: #000;
    opacity: 0;
    animation: page-shadow 410ms ease-in both;
  }
  @keyframes turn-page {
    from {
      transform: rotateX(0);
    }
    to {
      transform: rotateX(-180deg);
    }
  }
  @keyframes page-shadow {
    from {
      opacity: 0;
    }
    to {
      opacity: 0.25;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .leaf {
      display: none;
    }
    .leaf-front::after {
      animation: none;
    }
  }
</style>
