<script lang="ts">
  import { onMount } from 'svelte';
  import { perspectiveMotion } from './perspectiveMotion';
  // Defaults preserve the homepage; other editorial pages share its exact light treatment.
  let {
    id = 'perspective-message',
    eyebrow = 'DA ESCOLHA AO CAMINHO',
    lead = 'A escolha certa',
    middle = 'começa por',
    highlight = 'fazer sentido.',
    grouped = false,
  }: {
    id?: string;
    eyebrow?: string;
    lead?: string;
    middle?: string;
    highlight?: string;
    grouped?: boolean;
  } = $props();
  let section: HTMLElement;
  onMount(() => perspectiveMotion(section));
</script>

<section
  bind:this={section}
  class="orbit-perspective"
  class:grouped
  data-scene
  data-approach
  aria-labelledby={id}
>
  <div class="perspective-inner">
    <p class="eyebrow">{eyebrow}</p>
    <div data-approach-target>
      <h2 {id}>
        <span class="read-a">{lead}</span>
        <span class="read-b">{middle}</span>
        <span class="read-c"
          ><em
            >{highlight}<span class="line-window" aria-hidden="true"
              ><span class="travelling-line"></span></span
            ></em
          ></span
        >
      </h2>
    </div>
  </div>
</section>

<style>
  .orbit-perspective {
    --line-progress: 0;
    --line-light: 0;
    --accent-light: 0;
    /* The moving light is an accent over a permanent, high-contrast text layer. */
    --perspective-base: color-mix(in srgb, var(--text) 92%, var(--bg));
    border-block: 1px solid var(--line);
    background: color-mix(in srgb, var(--text) 2%, transparent);
  }
  .perspective-inner {
    width: var(--orbit-frame, 90%);
    max-width: var(--orbit-frame-max, 1720px);
    margin: auto;
    padding-block: clamp(64px, 7vw, 108px);
    display: grid;
    grid-template-columns: 1fr 3fr;
    gap: var(--orbit-space-grid, 32px);
  }
  .eyebrow {
    font-size: 10px;
    letter-spacing: 0.12em;
    line-height: 1.8;
    color: var(--muted);
    margin: 9px 0 0;
    max-width: 14ch;
  }
  .grouped .perspective-inner {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    align-items: center;
    gap: 0;
  }
  .grouped .eyebrow {
    grid-column: 1;
    grid-row: 1;
    justify-self: start;
    margin: 0;
  }
  .grouped [data-approach-target] {
    grid-column: 1;
    grid-row: 1;
    min-width: 0;
    width: 100%;
  }
  .grouped h2 {
    max-width: none;
    text-align: center;
  }
  h2 {
    color: var(--perspective-base);
    margin: 0;
    max-width: 35ch;
    font-size: clamp(32px, 3.2vw, 52px);
    font-weight: 500;
    line-height: 1.28;
    letter-spacing: -0.045em;
  }
  em {
    font-style: normal;
    position: relative;
    white-space: nowrap;
  }
  .line-window {
    position: absolute;
    height: 2px;
    bottom: -0.08em;
    left: 0;
    right: 0;
    overflow: hidden;
    pointer-events: none;
    /* Apply the hero's aura after clipping the travelling segment. */
    opacity: 0.95;
    filter: drop-shadow(0 0 2.5px rgb(255 51 76 / 90%)) drop-shadow(0 0 5px #e3061366)
      drop-shadow(0 0 12px #e3061399) drop-shadow(0 0 26px #e3061359);
  }
  .travelling-line {
    display: block;
    width: 100%;
    height: 100%;
    background: var(--red);
    transform: translateX(-100%);
  }
  @media (prefers-reduced-motion: no-preference) {
    :global(.motion-on) .read-a,
    :global(.motion-on) .read-b,
    :global(.motion-on) em {
      color: transparent;
      background-image:
        radial-gradient(
          ellipse 310px 180px at var(--tip-x, 0px) var(--tip-y, 0px),
          color-mix(in srgb, var(--text) calc(var(--line-light) * 100%), transparent),
          transparent 100%
        ),
        linear-gradient(var(--perspective-base), var(--perspective-base));
      background-clip: text;
      -webkit-background-clip: text;
    }
    :global(.motion-on) em {
      background-image:
        linear-gradient(
          90deg,
          transparent calc(var(--segment-start, 0px) - 1.8em),
          color-mix(in srgb, var(--red) calc(var(--accent-light) * 12%), transparent)
            calc(var(--segment-start, 0px) - 1.2em),
          color-mix(in srgb, var(--red) calc(var(--accent-light) * 42%), transparent)
            calc(var(--segment-start, 0px) - 0.6em),
          color-mix(in srgb, var(--red) calc(var(--accent-light) * 70%), transparent)
            calc(var(--segment-start, 0px) + var(--light-inset, 0px)),
          color-mix(in srgb, var(--red) calc(var(--accent-light) * 70%), transparent)
            calc(var(--segment-end, 0px) - var(--light-inset, 0px) + 35px),
          color-mix(in srgb, var(--red) calc(var(--accent-light) * 42%), transparent)
            calc(var(--segment-end, 0px) - var(--light-inset, 0px) / 2 + 17.5px + 0.525em),
          color-mix(in srgb, var(--red) calc(var(--accent-light) * 12%), transparent)
            calc(var(--segment-end, 0px) - var(--light-inset, 0px) / 2 + 17.5px + 1.05em),
          transparent calc(var(--segment-end, 0px) - var(--light-inset, 0px) / 2 + 17.5px + 1.575em)
        ),
        linear-gradient(var(--perspective-base), var(--perspective-base));
    }
    :global(.motion-on) .travelling-line {
      transform: translateX(calc((var(--line-progress) * 2 - 1) * 100%));
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .read-a,
    .read-b,
    em {
      color: inherit;
      background: none;
    }
    .travelling-line {
      transform: translateX(0);
    }
  }
  @media (max-width: 900px) {
    .grouped .perspective-inner {
      gap: 20px;
    }
    .grouped .eyebrow {
      max-width: none;
    }
    .grouped [data-approach-target] {
      grid-row: 2;
    }
  }
  @media (max-width: 700px) {
    .perspective-inner {
      grid-template-columns: 1fr;
      padding-block: 52px;
      gap: 24px;
    }
    .eyebrow {
      max-width: none;
      margin: 0;
    }
    h2 {
      font-size: clamp(28px, 7.4vw, 38px);
    }
    :global(.motion-on) .read-a,
    :global(.motion-on) .read-b {
      background-image:
        radial-gradient(
          ellipse 230px 150px at var(--tip-x, 0px) var(--tip-y, 0px),
          color-mix(in srgb, var(--text) calc(var(--line-light) * 100%), transparent),
          transparent 100%
        ),
        linear-gradient(var(--perspective-base), var(--perspective-base));
    }
  }
</style>
