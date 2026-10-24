<script lang="ts">
  import { ArrowUpRight } from 'lucide-svelte';
  import './frameCorners.css';
  import { photo } from './data';
  import { responsivePhoto } from './images';
  import OrbitVisitLabel from './OrbitVisitLabel.svelte';
  import ScenePhotograph from './ScenePhotograph.svelte';
  import type { SceneBackground } from './homeVisualFamilies';
  let { onContact, background }: { onContact: (message: string) => void; background?: SceneBackground } = $props();
</script>

<section id="proximo-passo" class="editorial-pause" aria-labelledby="editorial-pause-title">
  <div class="pause-landscape" aria-hidden="true">
    {#if background}<ScenePhotograph {background} />{:else}
    <img
      src={photo('photo-1576212767334-9e289e294c77', 2200)}
      srcset={responsivePhoto('photo-1576212767334-9e289e294c77')}
      sizes="(prefers-reduced-motion: reduce) 100vw, (max-aspect-ratio: 3/2) 150vh, 100vw"
      alt=""
      loading="lazy"
      decoding="async"
    />
    {/if}
  </div>
  <div class="pause-inner">
    <div>
      <OrbitVisitLabel spaceBelow={15} />
      <h2 id="editorial-pause-title">O próximo passo começa aqui<span class="red-stop">.</span></h2>
      <p class="pause-note">Consulte a morada, os contactos e o horário do stand.</p>
    </div>
    <div class="pause-actions">
      <a href="#contactos">Ver contactos e horário <ArrowUpRight size={18} aria-hidden="true" /></a>
      <button
        type="button"
        onclick={() => onContact('Gostava de falar convosco sobre o próximo passo.')}
      >
        Contacta-nos <ArrowUpRight size={18} aria-hidden="true" />
      </button>
    </div>
  </div>
</section>

<style>
  .pause-landscape {
    position: absolute;
    inset: 0;
    z-index: -1;
    isolation: isolate;
  }

  .editorial-pause {
    --text: #f5f5f1;
    --muted: #ececef;
    --line: #ffffff30;
    position: relative;
    isolation: isolate;
    width: 100%;
    margin: 24px auto 0;
    overflow: hidden;
    background: #111214;
    color: var(--text);
  }
  .pause-landscape > img {
    position: absolute;
    inset: 0;
    z-index: -2;
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: center 44%;
    filter: saturate(0.45);
  }
  .pause-landscape::before {
    content: '';
    position: absolute;
    inset: 0;
    z-index: -1;
    background:
      linear-gradient(90deg, #101114a6 0%, #10111480 48%, #10111433 100%),
      linear-gradient(0deg, #0c0c0e99, #0c0c0e0d 75%);
  }
  .pause-inner {
    box-sizing: border-box;
    width: var(--orbit-frame, 90%);
    max-width: var(--orbit-frame-max, 1720px);
    margin-inline: auto;
    min-height: 390px;
    padding: 56px 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 36px;
  }
  p,
  h2 {
    margin: 0;
  }
  h2 {
    font-size: clamp(30px, 3.1vw, 46px);
    font-weight: 500;
    letter-spacing: -0.045em;
    line-height: 1.15;
  }
  .red-stop {
    color: var(--red);
  }
  .pause-note {
    margin-top: 12px;
    color: var(--muted);
    font-size: 14px;
    line-height: 1.6;
  }
  .pause-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
  }
  a,
  button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 20px;
    flex-shrink: 0;
    min-height: 48px;
    box-sizing: border-box;
    padding: 12px 20px;
    border: 1px solid #ffffff80;
    border-radius: 3px;
    color: #fff;
    background: transparent;
    font-family: inherit;
    cursor: pointer;
    font-size: 13px;
    text-decoration: none;
  }
  button {
    background: #fff;
    color: #111214;
    border-color: #fff;
  }
  a:focus-visible,
  button:focus-visible {
    outline: 2px solid #fff;
    outline-offset: 5px;
  }
  @media (hover: hover) {
    a:hover,
    button:hover {
      background: #fff;
      color: #111214;
      border-color: #fff;
    }
  }
  @media (prefers-reduced-motion: no-preference) {
    @supports (animation-timeline: view()) and (clip-path: inset(0)) {
      .editorial-pause {
        clip-path: inset(0);
        view-timeline-name: --editorial-window;
        view-timeline-axis: block;
      }
      /* The photograph and shade move as ONE composited plane. */
      .editorial-pause > .pause-landscape {
        position: absolute;
        inset: calc(-8vh - 2px) 0 auto;
        height: calc(100% + 16vh + 4px);
        will-change: transform;
        animation: editorial-window-travel 1s linear both;
        animation-timeline: --editorial-window;
        animation-range: cover 0% cover 100%;
      }
    }
    a,
    button {
      transition:
        color 180ms ease,
        background-color 180ms ease;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .pause-landscape > img {
      inset: 0;
      height: 100%;
      transform: none;
    }
  }
  @media (max-width: 1100px) {
    .pause-inner {
      align-items: start;
      flex-direction: column;
      gap: 24px;
      padding: 48px 0;
    }
  }
  @media (max-width: 700px) {
    .pause-landscape > img {
      object-position: 48% center;
    }
    .pause-landscape::before {
      background:
        linear-gradient(90deg, #101114a6, #10111473), linear-gradient(0deg, #0c0c0e99, transparent);
    }
    .editorial-pause {
      width: 100%;
      border-radius: 0;
      margin-top: 16px;
    }
    .pause-actions {
      width: 100%;
      flex-direction: column;
    }
    .pause-actions a,
    .pause-actions button {
      justify-content: space-between;
      width: 100%;
    }
    h2 {
      font-size: 32px;
    }
  }
  @keyframes editorial-window-travel {
    from {
      transform: translate3d(0, -8vh, 0);
    }
    to {
      transform: translate3d(0, 8vh, 0);
    }
  }
</style>
