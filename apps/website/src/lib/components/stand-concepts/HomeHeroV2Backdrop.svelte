<script lang="ts">
  import { onMount } from 'svelte';

  const accentId = $props.id();
  const desktopAngle = 25;
  let reveal = $state(0);
  const narrowStart = $derived(0.69 + reveal * 0.12);
  const portraitStart = $derived(0.424 - reveal * 0.135);
  let backdrop = $state<HTMLDivElement>();
  onMount(() => {
    let frame = 0;
    const stage = backdrop?.closest<HTMLElement>('.v2-orbit-stage');
    const path = backdrop?.querySelector<SVGPathElement>('.v2-direction-accent');
    const title = stage?.querySelector<HTMLElement>('.v2-orbit-title');
    const description = stage?.querySelector<HTMLElement>('.v2-orbit-title-note');
    const photo = stage?.querySelector<HTMLElement>('.v2-orbit-main-photo');
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const unit = (value: number) => Math.min(1, Math.max(0, value));
    const update = () => {
      frame = 0;
      // Start behind the photo at the top of the page, independently of viewport height.
      // Keep travelling after the first reveal; fade only once the segment leaves the scene.
      const next = reduced.matches
        ? 0
        : Math.max(0, window.scrollY / Math.min(360, window.innerHeight * 0.35));
      if (reveal >= 3 && next >= 3) return;
      reveal = next;
      const mobile = window.innerWidth <= 700;
      const middle = mobile ? 0.755 + reveal * 0.12 : 0.504 - reveal * 0.135;
      const matrix = path?.getScreenCTM();
      if (!path || !matrix) return;
      const point = path
        .getPointAtLength(path.getTotalLength() * unit(middle))
        .matrixTransform(matrix);
      const fading = unit((2.7 - reveal) / 1.3);
      // Each text box gets its own light coordinates: colour reaches nearby glyphs first.
      const targets = [title, description, photo].map((node) => ({
        node,
        bounds: node?.getBoundingClientRect(),
      }));
      for (const { node, bounds } of targets) {
        if (!node || !bounds) continue;
        const dx = Math.max(bounds.left - point.x, 0, point.x - bounds.right);
        const dy = Math.max(bounds.top - point.y, 0, point.y - bounds.bottom);
        const radius = node === photo ? (mobile ? 100 : 180) : mobile ? 320 : 480;
        const proximity = unit(1 - Math.hypot(dx, dy) / radius);
        node.style.setProperty(
          '--v2-nearby-light',
          String(reduced.matches ? 0 : proximity * fading),
        );
        node.style.setProperty('--v2-light-x', `${point.x - bounds.left}px`);
        node.style.setProperty('--v2-light-y', `${point.y - bounds.top}px`);
      }
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    reduced.addEventListener('change', schedule);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      reduced.removeEventListener('change', schedule);
      for (const node of [title, description, photo]) {
        for (const property of ['--v2-nearby-light', '--v2-light-x', '--v2-light-y'])
          node?.style.removeProperty(property);
      }
    };
  });
</script>

<div
  class="v2-stage-backdrop"
  bind:this={backdrop}
  aria-hidden="true"
  style:--v2-accent-reveal={reveal}
  style:--v2-accent-angle={`${desktopAngle}deg`}
  style:--v2-accent-narrow-paint={`url(#${accentId}-narrow)`}
  style:--v2-accent-portrait-paint={`url(#${accentId}-portrait)`}
>
  <div class="v2-stage-atmosphere">
    <div class="v2-studio-light"></div>
    <div class="v2-light-plane"></div>
    <div class="v2-photo-ground"></div>
  </div>
  <div class="v2-accent-track">
    <svg viewBox="0 0 1440 720" preserveAspectRatio="none" focusable="false">
      <defs>
        {#each [{ name: 'narrow', start: narrowStart, length: 0.13 }, { name: 'portrait', start: portraitStart, length: 0.16 }] as beam}
          <!-- Taper the moving dash itself; its existing shadow then fades beyond both tips. -->
          <linearGradient
            id={`${accentId}-${beam.name}`}
            gradientUnits="userSpaceOnUse"
            x1={-160 + 1670 * beam.start}
            y1={beam.name === 'narrow' ? 700 - 482 * beam.start : 472}
            x2={-160 + 1670 * (beam.start + beam.length)}
            y2={beam.name === 'narrow' ? 700 - 482 * (beam.start + beam.length) : 472}
          >
            <stop offset="0" stop-color="var(--red)" stop-opacity="0" />
            <stop offset="0.06" stop-color="var(--red)" stop-opacity="0.25" />
            <stop offset="0.2" stop-color="var(--red)" />
            <stop offset="0.8" stop-color="var(--red)" />
            <stop offset="0.94" stop-color="var(--red)" stop-opacity="0.25" />
            <stop offset="1" stop-color="var(--red)" stop-opacity="0" />
          </linearGradient>
        {/each}
      </defs>
      <path class="v2-direction-accent" pathLength="1" d="M-160 700 1510 218" />
    </svg>
  </div>
</div>

<style>
  .v2-stage-backdrop {
    position: absolute;
    inset: 0;
    pointer-events: none;
    overflow: visible;
    isolation: isolate;
    z-index: 0;
  }
  .v2-stage-atmosphere {
    position: absolute;
    inset: 0;
    overflow: hidden;
    /* Fade the atmosphere without suppressing the line's local red aura. */
    mask-image:
      linear-gradient(
        to bottom,
        transparent,
        #000 12%,
        #000 48%,
        #000d 62%,
        #0006 77%,
        #0001 91%,
        transparent 100%
      ),
      linear-gradient(to right, transparent, #000 10%, #000 88%, transparent);
    mask-composite: intersect;
  }
  .v2-studio-light {
    position: absolute;
    inset: -15%;
    background: radial-gradient(
      ellipse at 71% 48%,
      color-mix(in srgb, var(--text) 8%, transparent),
      transparent 43%
    );
  }
  .v2-light-plane {
    position: absolute;
    top: -24%;
    bottom: -30%;
    left: 29%;
    width: 32%;
    transform: skewX(-22deg);
    background: linear-gradient(
      90deg,
      transparent,
      color-mix(in srgb, var(--text) 2.6%, transparent) 65%,
      transparent
    );
    filter: blur(28px);
    mask-image: linear-gradient(transparent, #000 24%, #000 76%, transparent);
  }
  .v2-accent-track {
    position: absolute;
    inset: 0;
    overflow: hidden;
  }
  svg {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    fill: none;
    mask-image: linear-gradient(90deg, transparent, #000 4%, #000 96%, transparent);
  }
  path {
    /* Keep normalized dash geometry in SVG space at every aspect ratio. */
    stroke-width: 1;
  }
  .v2-direction-accent {
    stroke: var(--red);
    stroke-width: 2.5;
    stroke-linecap: round;
    opacity: 0.95;
    filter: drop-shadow(0 0 2.5px rgb(255 51 76 / 90%)) drop-shadow(0 0 5px #e3061366)
      drop-shadow(0 0 12px #e3061399) drop-shadow(0 0 26px #e3061359);
    stroke-dasharray: 0.16 1;
    stroke-dashoffset: calc(-0.424px + var(--v2-accent-reveal, 0) * 0.135px);
  }
  .v2-photo-ground {
    position: absolute;
    width: 59%;
    height: 10%;
    left: 37%;
    bottom: 10%;
    background: radial-gradient(
      ellipse,
      color-mix(in srgb, var(--text) 5%, transparent),
      transparent 70%
    );
    transform: rotate(-4deg);
  }
  @media (prefers-reduced-motion: no-preference) {
    :global(.hero-v2-motion) .v2-studio-light {
      transform: translate(calc(var(--v2-mx, 0) * 18px), calc(var(--v2-my, 0) * 14px));
    }
    :global(.hero-v2-motion) .v2-light-plane {
      transform: translateX(calc(var(--v2-p, 0) * -22px + var(--v2-mx, 0) * 12px)) skewX(-22deg);
    }
    .v2-accent-track {
      transform: translateY(var(--v2-accent-stage-shift, 0px));
    }
    svg {
      transform: translateY(calc(var(--v2-accent-progress, var(--v2-p, 0)) * -12px));
    }
    :global(.hero-v2-motion) .v2-direction-accent {
      /* Keep the original left/down travel on the same straight path used by the light. */
      stroke-dashoffset: calc(-0.424px + var(--v2-accent-reveal) * 0.135px);
      opacity: clamp(0, calc((2.7 - var(--v2-accent-reveal)) * 0.73076924), 0.95);
    }
    :global(.hero-v2-motion) .v2-photo-ground {
      transform: translateX(calc(var(--v2-p, 0) * -16px)) rotate(-4deg)
        scaleX(calc(1 + var(--v2-p, 0) * 0.06));
    }
  }
  @media (min-width: 701px) {
    /* Extend only the clipping window; retain the SVG canvas and its approved trajectory. */
    .v2-accent-track {
      bottom: calc(-1 * var(--v2-hero-shadow-tail, 0px));
    }
    svg {
      height: var(--v2-intro-height);
    }
    /* A horizontal SVG path rotated after layout gives the final visual angle at every ratio,
       including the first server-rendered paint. This SVG contains only the accent. */
    .v2-direction-accent {
      d: path('M-160 472 1510 472');
      /* Keep the crisp core; only spread the outer desktop halo slightly further. */
      filter: drop-shadow(0 0 2.5px rgb(255 51 76 / 90%)) drop-shadow(0 0 5px #e3061366)
        drop-shadow(0 0 12px #e3061399) drop-shadow(0 0 30px #e3061361);
    }
    svg {
      transform: rotate(calc(-1 * var(--v2-accent-angle)));
      transform-origin: 50% 65.555556%;
    }
  }
  @media (min-width: 701px) and (prefers-reduced-motion: no-preference) {
    /* The support stays in the scene; only the dash moves along it. */
    .v2-accent-track {
      transform: none;
    }
  }
  @media (max-width: 700px) {
    .v2-direction-accent {
      stroke: var(--v2-accent-narrow-paint);
      stroke-dasharray: 0.13 1;
      stroke-dashoffset: calc(-0.69px - var(--v2-accent-reveal, 0) * 0.12px);
      stroke-width: 4;
    }
    .v2-studio-light {
      background: radial-gradient(
        ellipse at 58% 65%,
        color-mix(in srgb, var(--text) 7%, transparent),
        transparent 57%
      );
    }
    .v2-light-plane {
      left: 16%;
      width: 55%;
      opacity: 0.6;
    }
    .v2-photo-ground {
      width: 90%;
      left: 5%;
      bottom: 15%;
    }
  }
  @media (min-width: 701px) and (max-width: 1050px) and (orientation: portrait) {
    .v2-direction-accent {
      stroke: var(--v2-accent-portrait-paint);
    }
  }
  @media (max-width: 700px) and (prefers-reduced-motion: no-preference) {
    :global(.hero-v2-motion) .v2-direction-accent {
      stroke-dashoffset: calc(-0.69px - var(--v2-accent-reveal) * 0.12px);
    }
  }
</style>
