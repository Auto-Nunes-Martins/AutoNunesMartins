<script lang="ts">
  import { tick } from 'svelte';
  import { Wrench, Sparkles, CircleDot, Lightbulb } from 'lucide-svelte';

  // Keep the copy informational until the stand confirms its preparation checklist.
  const parts = [
    {
      id: 'mecanica',
      label: 'Mecânica',
      title: 'Verificação mecânica',
      icon: Wrench,
      description:
        'Esclareça que verificações estão previstas para a viatura e o que consta do histórico de manutenção.',
      checks: ['Níveis e sinais de fugas', 'Histórico e manutenção prevista'],
      x: 145,
      y: 190,
      leader: 'M145 190V62L70 0',
    },
    {
      id: 'habitaculo',
      label: 'Habitáculo',
      title: 'Preparação do habitáculo',
      icon: Sparkles,
      description:
        'Confirme os cuidados previstos para o interior, dos revestimentos aos comandos e ao equipamento.',
      checks: ['Limpeza dos revestimentos', 'Comandos e equipamento interior'],
      x: 375,
      y: 144,
      leader: 'M375 144V52H640V0',
    },
    {
      id: 'pneus',
      label: 'Pneus e travões',
      title: 'Pneus e travões',
      icon: CircleDot,
      description:
        'Conheça o estado dos pneus e dos componentes de travagem, e o que está previsto na preparação.',
      checks: ['Desgaste e pressão dos pneus', 'Estado dos componentes de travagem'],
      x: 185,
      y: 260,
      leader: 'M185 260V338H95V360',
    },
    {
      id: 'visibilidade',
      label: 'Luzes e visibilidade',
      title: 'Iluminação e visibilidade',
      icon: Lightbulb,
      description:
        'Esclareça o estado das luzes, dos vidros e das escovas, e os cuidados previstos para a entrega.',
      checks: ['Iluminação exterior', 'Vidros e escovas'],
      x: 682,
      y: 208,
      leader: 'M682 208V338H650V360',
    },
  ];
  let active = $state(0);
  let controls: HTMLButtonElement[] = [];

  async function selectPart(index: number, focus = false) {
    active = index;
    if (focus) {
      await tick();
      controls[index]?.focus({ preventScroll: true });
    }
  }
  function navigateParts(event: KeyboardEvent, index: number) {
    let next: number;
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        next = (index + 1) % parts.length;
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        next = (index - 1 + parts.length) % parts.length;
        break;
      case 'Home':
        next = 0;
        break;
      case 'End':
        next = parts.length - 1;
        break;
      default:
        return;
    }
    event.preventDefault();
    void selectPart(next, true);
  }
</script>

<section class="next-steps" id="preparar-proximo-passo" aria-labelledby="next-steps-title">
  <div class="section-intro">
    <p class="eyebrow">ANTES DA ENTREGA</p>
    <h2 id="next-steps-title">Preparação,<br />ponto por ponto.</h2>
    <p class="intro-note">Selecione uma área para explorar a preparação.</p>
  </div>
  <div class="preparation-map">
    <div class="car-drawing">
      <svg class="car-outline" viewBox="0 0 760 360" fill="none" aria-hidden="true">
        <defs>
          <linearGradient
            id="visit-car-wash"
            x1="380"
            y1="85"
            x2="380"
            y2="278"
            gradientUnits="userSpaceOnUse"
            ><stop stop-color="currentColor" stop-opacity=".095" /><stop
              offset=".58"
              stop-color="currentColor"
              stop-opacity=".035"
            /><stop offset="1" stop-color="currentColor" stop-opacity=".065" /></linearGradient
          >
          <linearGradient
            id="visit-car-glass"
            x1="380"
            y1="100"
            x2="380"
            y2="169"
            gradientUnits="userSpaceOnUse"
            ><stop stop-color="currentColor" stop-opacity=".07" /><stop
              offset="1"
              stop-color="currentColor"
              stop-opacity=".015"
            /></linearGradient
          >
        </defs>
        <ellipse class="car-shadow" cx="378" cy="306" rx="320" ry="7" />
        <path class="ground" d="M40 306H720" />
        <path
          class="body"
          fill="url(#visit-car-wash)"
          d="M46 245L49 216Q51 201 72 194L215 171L288 107Q308 87 339 85H473Q513 85 543 107L623 164L675 183Q693 190 699 209L709 246L703 265Q699 276 681 276H641C638 237 617 204 585 204C551 204 532 237 529 276H241C238 237 217 204 185 204C152 204 131 237 128 276H77Q57 276 48 262Z"
        />
        <path
          class="glass"
          class:highlighted={active === 1}
          d="M237 168L301 111Q316 100 341 100H366L369 168ZM382 100H470Q493 100 513 114L573 165L386 168ZM532 122L594 165H585Z"
        />
        <path
          class="hood-highlight"
          class:highlighted={active === 0}
          d="M66 198L211 175L224 183L219 221L57 229L56 215Z"
        /><path class="pillar" d="M368 98H380L385 171H371Z" />
        <path
          class="detail"
          d="M230 181L225 236Q226 260 248 265H377L375 178M389 178L393 265H514L531 185M257 267H514M328 184H349M484 183H504M89 189L211 176M240 174L602 171M613 169L674 190M650 202L691 211M58 240H103M651 250H701"
        />
        <path class="body-highlight" d="M78 215L133 210M249 199Q384 188 526 196M648 221L695 230" />
        <path
          class="lamp"
          class:highlighted={active === 3}
          d="M62 205L116 199L139 204L119 212H59M679 192L690 201L693 221L677 216Z"
        />
        <path class="mirror" d="M250 158L239 151Q234 148 229 153L223 161Q222 165 229 166H249Z" />
        <path
          class="seat"
          class:highlighted={active === 1}
          d="M330 165L326 142Q325 135 332 134H339Q345 134 346 141L350 166M449 165L446 144Q446 137 452 137H462Q468 137 470 145L473 165"
        />
        <circle class="detail" cx="278" cy="150" r="9" /><path
          class="detail"
          d="M272 157L283 165M271 150H285"
        />
        <g class="wheel-assembly" class:highlighted={active === 2}>
          <circle class="tyre" cx="185" cy="260" r="43" /><circle
            class="rim"
            cx="185"
            cy="260"
            r="29"
          /><circle class="rim-inner" cx="185" cy="260" r="24" /><circle
            class="hub"
            cx="185"
            cy="260"
            r="5"
          />
          <path
            class="spokes"
            d="M185 236V253M208 252L192 257M199 280L189 266M171 280L181 266M162 252L178 257"
          />
          <circle class="tyre" cx="585" cy="260" r="43" /><circle
            class="rim"
            cx="585"
            cy="260"
            r="29"
          /><circle class="rim-inner" cx="585" cy="260" r="24" /><circle
            class="hub"
            cx="585"
            cy="260"
            r="5"
          />
          <path
            class="spokes"
            d="M585 236V253M608 252L592 257M599 280L589 266M571 280L581 266M562 252L578 257"
          />
        </g>
        {#each parts as part, index}<path
            class="leader"
            class:highlighted={active === index}
            d={part.leader}
          />{/each}</svg
      >
      {#each parts as part, index}
        <button
          class="car-hotspot"
          class:selected={active === index}
          style:left={`${(part.x / 760) * 100}%`}
          style:top={`${(part.y / 360) * 100}%`}
          type="button"
          tabindex="-1"
          aria-label={`Explorar ${part.title.toLocaleLowerCase('pt-PT')}`}
          aria-controls={`preparation-panel-${part.id}`}
          aria-pressed={active === index}
          onclick={() => selectPart(index, true)}
          ><span class="hotspot-ring"><span></span></span></button
        >
      {/each}
    </div>
    <div class="zone-tabs" role="tablist" aria-label="Áreas de preparação da viatura">
      {#each parts as part, index}
        <button
          class="zone-label zone-{part.id}"
          bind:this={controls[index]}
          type="button"
          role="tab"
          id={`preparation-tab-${part.id}`}
          aria-controls={`preparation-panel-${part.id}`}
          aria-selected={active === index}
          tabindex={active === index ? 0 : -1}
          onclick={() => selectPart(index)}
          onkeydown={(event) => navigateParts(event, index)}
          ><span class="zone-number">0{index + 1}</span><span class="zone-name">{part.label}</span
          ></button
        >
      {/each}
    </div>
  </div>
  <div class="preparation-detail">
    <div class="detail-panels" aria-live="polite">
      {#each parts as part, index}
        <div
          class="detail-panel"
          class:active={active === index}
          role="tabpanel"
          id={`preparation-panel-${part.id}`}
          aria-labelledby={`preparation-tab-${part.id}`}
          aria-hidden={active !== index}
          inert={active !== index}
          tabindex={active === index ? 0 : -1}
        >
          <div class="detail-heading">
            <part.icon size={20} strokeWidth={1.5} aria-hidden="true" />
            <h3>{part.title}</h3>
          </div>
          <p>{part.description}</p>
          <ul>
            {#each part.checks as check}<li>{check}</li>{/each}
          </ul>
        </div>
      {/each}
    </div>
  </div>
</section>

<style>
  .next-steps {
    width: var(--orbit-frame, 90%);
    max-width: var(--orbit-frame-max, 1320px);
    margin-inline: auto;
    padding-top: var(--orbit-space-section, 86px);
    display: grid;
    grid-template-columns: minmax(0, 0.675fr) minmax(0, 1.325fr);
    grid-template-areas: 'intro map' 'detail map';
    grid-template-rows: auto 1fr;
    gap: 26px clamp(40px, 7vw, 112px);
    align-items: start;
    scroll-margin-top: 120px;
  }
  * {
    box-sizing: border-box;
  }
  h2,
  h3,
  p {
    margin: 0;
  }
  button {
    font: inherit;
    color: inherit;
    border: 0;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
  }
  button:focus-visible,
  .detail-panel:focus-visible {
    outline: 2px solid var(--red, #e30613);
    outline-offset: 5px;
    border-radius: 3px;
  }
  .section-intro {
    grid-area: intro;
  }
  .eyebrow {
    color: var(--muted);
    font-size: 11px;
    letter-spacing: 0.12em;
    line-height: 1.7;
  }
  h2 {
    margin-top: 17px;
    font-size: clamp(30px, 3vw, 42px);
    font-weight: 500;
    line-height: 1.12;
    letter-spacing: -0.045em;
  }
  .intro-note {
    margin-top: 16px;
    max-width: 330px;
    color: var(--muted);
    font-size: 15px;
    line-height: 1.75;
  }
  .preparation-map {
    grid-area: map;
    position: relative;
    min-width: 0;
    height: 440px;
    align-self: center;
  }
  .car-drawing {
    position: absolute;
    width: 77%;
    left: 11.5%;
    top: 72px;
    aspect-ratio: 760 / 360;
  }
  .car-outline {
    display: block;
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    overflow: visible;
    color: var(--text);
  }
  .body {
    stroke: currentColor;
    stroke-width: 1.5;
    stroke-opacity: 0.6;
  }
  .glass {
    stroke: currentColor;
    stroke-opacity: 0.3;
    stroke-width: 1;
    fill: url(#visit-car-glass);
  }
  .detail,
  .seat {
    stroke: currentColor;
    stroke-width: 1;
    stroke-opacity: 0.3;
  }
  .tyre {
    stroke: currentColor;
    stroke-opacity: 0.5;
    stroke-width: 1.6;
    fill: var(--bg);
  }
  .rim,
  .rim-inner,
  .hub,
  .spokes {
    stroke: currentColor;
    stroke-opacity: 0.4;
    stroke-width: 1;
  }
  .rim {
    fill: currentColor;
    fill-opacity: 0.035;
  }
  .rim-inner {
    stroke-opacity: 0.18;
  }
  .hub {
    fill: currentColor;
    fill-opacity: 0.1;
  }
  .pillar {
    fill: currentColor;
    fill-opacity: 0.22;
  }
  .body-highlight {
    stroke: currentColor;
    stroke-opacity: 0.2;
    stroke-width: 1;
  }
  .lamp,
  .mirror {
    stroke: currentColor;
    stroke-opacity: 0.4;
    stroke-width: 1;
    fill: var(--bg);
  }
  .car-shadow {
    fill: currentColor;
    fill-opacity: 0.035;
  }
  .ground {
    stroke: currentColor;
    stroke-opacity: 0.12;
  }
  .leader {
    stroke: currentColor;
    stroke-opacity: 0.2;
    stroke-width: 1;
    stroke-dasharray: 3 5;
  }
  .leader.highlighted {
    stroke: var(--red, #e30613);
    stroke-opacity: 0.7;
    stroke-dasharray: none;
  }
  .hood-highlight {
    fill: transparent;
    stroke: transparent;
  }
  .hood-highlight.highlighted {
    fill: var(--red, #e30613);
    fill-opacity: 0.08;
    stroke: var(--red, #e30613);
    stroke-opacity: 0.4;
    stroke-width: 1;
  }
  .glass.highlighted {
    fill: var(--red, #e30613);
    fill-opacity: 0.055;
    stroke: var(--red, #e30613);
    stroke-opacity: 0.55;
  }
  .seat.highlighted,
  .lamp.highlighted,
  .highlighted .tyre,
  .highlighted .rim {
    stroke: var(--red, #e30613);
    stroke-opacity: 0.8;
  }
  .car-hotspot {
    position: absolute;
    display: grid;
    place-items: center;
    width: 44px;
    height: 44px;
    padding: 0;
    transform: translate(-50%, -50%);
    background: transparent;
    z-index: 2;
  }
  .hotspot-ring {
    width: 17px;
    height: 17px;
    display: grid;
    place-items: center;
    border: 1px solid color-mix(in srgb, var(--text) 45%, transparent);
    background: var(--bg);
    border-radius: 50%;
  }
  .hotspot-ring > span {
    width: 5px;
    height: 5px;
    background: var(--muted);
    border-radius: 50%;
  }
  .selected .hotspot-ring {
    border-color: var(--red, #e30613);
    box-shadow: 0 0 0 5px color-mix(in srgb, var(--red, #e30613) 10%, transparent);
  }
  .selected .hotspot-ring > span {
    background: var(--red, #e30613);
  }
  .zone-tabs {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }
  .zone-label {
    pointer-events: auto;
    position: absolute;
    display: flex;
    align-items: center;
    gap: 10px;
    width: 36%;
    max-width: 260px;
    min-height: 52px;
    padding: 6px 0;
    border-bottom: 1px solid var(--line);
    background: transparent;
    text-align: left;
  }
  .zone-mecanica {
    top: 0;
    left: 0;
  }
  .zone-habitaculo {
    top: 0;
    right: 0;
  }
  .zone-pneus {
    bottom: 0;
    left: 0;
  }
  .zone-visibilidade {
    bottom: 0;
    right: 0;
  }
  .zone-number {
    display: grid;
    place-items: center;
    width: 23px;
    height: 23px;
    border: 1px solid var(--line);
    border-radius: 50%;
    flex-shrink: 0;
    font-size: 9px;
    color: var(--muted);
  }
  .zone-name {
    font-size: 14px;
    font-weight: 500;
    line-height: 1.4;
  }
  .zone-label[aria-selected='true'] {
    border-color: var(--red, #e30613);
  }
  .zone-label[aria-selected='true'] .zone-number {
    color: #fff;
    background: var(--red, #e30613);
    border-color: var(--red, #e30613);
  }
  .preparation-detail {
    grid-area: detail;
    min-width: 0;
  }
  .detail-panels {
    display: grid;
  }
  .detail-panel {
    grid-area: 1 / 1;
    visibility: hidden;
    pointer-events: none;
    opacity: 0;
  }
  .detail-panel.active {
    visibility: visible;
    pointer-events: auto;
    opacity: 1;
  }
  .detail-heading {
    display: flex;
    align-items: center;
    gap: 11px;
  }
  .detail-heading :global(svg) {
    color: var(--red, #e30613);
    flex-shrink: 0;
  }
  h3 {
    font-size: 21px;
    font-weight: 500;
    letter-spacing: -0.025em;
    line-height: 1.3;
  }
  .detail-panel > p {
    margin-top: 13px;
    color: var(--muted);
    font-size: 15px;
    line-height: 1.7;
  }
  ul {
    display: grid;
    gap: 6px;
    list-style: none;
    margin: 14px 0 0;
    padding: 0;
  }
  li {
    position: relative;
    padding-left: 13px;
    font-size: 14px;
    line-height: 1.7;
  }
  li::before {
    content: '';
    position: absolute;
    left: 0;
    top: 0.7em;
    width: 4px;
    height: 4px;
    border-radius: 50%;
    background: var(--red, #e30613);
  }
  @media (hover: hover) {
    .zone-label:hover {
      border-color: var(--text);
    }
    .zone-label[aria-selected='true']:hover {
      border-color: var(--red, #e30613);
    }
    .car-hotspot:hover .hotspot-ring {
      border-color: var(--red, #e30613);
    }
  }
  @media (prefers-reduced-motion: no-preference) {
    .hotspot-ring,
    .zone-label {
      transition:
        border-color 160ms ease,
        box-shadow 160ms ease;
    }
    .detail-panel {
      transition: opacity 140ms ease;
    }
  }
  @media (max-width: 1100px) {
    .next-steps {
      grid-template-columns: minmax(0, 0.75fr) minmax(0, 1.25fr);
      gap: 23px 28px;
    }
    .preparation-map {
      height: 360px;
    }
    .car-drawing {
      top: 50px;
      width: 96%;
      left: 2%;
    }
    .zone-label {
      width: 43%;
      gap: 8px;
    }
    h2 {
      font-size: 32px;
    }
    h3 {
      font-size: 20px;
    }
  }
  @media (max-width: 900px) {
    .car-hotspot {
      width: 28px;
      height: 28px;
    }
  }
  @media (max-width: 700px) {
    .next-steps {
      grid-template-columns: minmax(0, 1fr);
      grid-template-rows: auto;
      grid-template-areas: 'intro' 'map' 'detail';
      gap: 23px;
      padding-top: var(--orbit-space-half, 30px);
    }
    h2 {
      font-size: 31px;
    }
    .intro-note {
      max-width: 320px;
      margin-top: 12px;
    }
    .preparation-map {
      height: 285px;
    }
    .car-drawing {
      top: 64px;
      width: 100%;
      left: 0;
    }
    .car-hotspot {
      width: 24px;
      height: 24px;
    }
    .hotspot-ring {
      width: 15px;
      height: 15px;
    }
    .zone-label {
      width: 46%;
      min-height: 52px;
      gap: 7px;
    }
    .zone-number {
      width: 21px;
      height: 21px;
    }
  }
</style>
