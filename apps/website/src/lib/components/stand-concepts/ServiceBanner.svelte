<script lang="ts">
  import {
    ArrowUpRight,
    Compass,
    ArrowLeftRight,
    Wrench,
    ShieldCheck,
    Wallet,
    Headphones,
  } from 'lucide-svelte';
  import { logoDark, logoDarkSrcset } from '$lib/localAssets';
  import { serviceBannerImage as interiorPhoto } from '$lib/serviceBannerImage';
  import { coverImageSizes } from '$lib/coverImageSizes';

  let {
    onContact,
    id = 'propostas-servicos',
    titleId = 'home-services-title',
  }: {
    onContact: (message?: string) => void;
    id?: string;
    titleId?: string;
  } = $props();

  const services = [
    {
      title: 'Consultoria automóvel',
      icon: Compass,
      copy: 'Conte-nos o que procura no seu próximo automóvel.',
    },
    {
      title: 'Retoma do seu veículo',
      icon: ArrowLeftRight,
      copy: 'Fale connosco sobre a viatura que quer trocar.',
    },
    {
      title: 'Revisão e preparação',
      icon: Wrench,
      copy: 'Conheça os detalhes da preparação da sua viatura.',
    },
    {
      title: 'Viaturas com garantia',
      icon: ShieldCheck,
      copy: 'Esclareça a cobertura e as condições da garantia.',
    },
    {
      title: 'Financiamento',
      icon: Wallet,
      copy: 'Converse com a equipa sobre financiamento e condições.',
    },
    {
      title: 'Assistência pós-venda',
      icon: Headphones,
      copy: 'A conversa continua também depois da compra.',
    },
  ];
</script>

<div class="home-services" {id}>
  <section
    class="service-banner essential"
    aria-labelledby={titleId}
    data-service-version="13"
    style:--service-mobile-focus={interiorPhoto.mobileFocus}
  >
    <picture
      use:coverImageSizes={{
        desktop: interiorPhoto.width / interiorPhoto.height,
        portrait: interiorPhoto.width / interiorPhoto.height,
      }}
    >
      <source type="image/avif" srcset={interiorPhoto.avif} sizes="100vw" />
      <img
        class="banner-background"
        src={interiorPhoto.src}
        srcset={interiorPhoto.srcset}
        sizes="100vw"
        alt=""
        loading="lazy"
        decoding="async"
      />
    </picture>
    <div class="banner-content">
      <div class="brand-column">
        <span class="brand-eyebrow">AUTO NUNES MARTINS / SERVIÇOS</span>
        <img
          class="banner-logo"
          src={logoDark}
          srcset={logoDarkSrcset}
          sizes="(max-width: 700px) 250px, 380px"
          alt="Auto Nunes Martins"
          width="720"
          height="320"
          loading="lazy"
          decoding="async"
        />
        <p class="brand-caption">Mais confiança em cada etapa.</p>
        <p class="brand-note">Conte com a nossa equipa antes e depois da compra.</p>
        <button
          class="brand-contact"
          onclick={() => onContact('Gostava de saber mais sobre os vossos serviços.')}
        >
          Vamos conversar <ArrowUpRight size={18} aria-hidden="true" />
        </button>
      </div>
      <div class="services-column">
        <div class="services-heading">
          <span class="heading-rule" aria-hidden="true"></span>
          <h2 id={titleId}>Os nossos serviços</h2>
        </div>
        <div class="service-list">
          {#each services as service}
            <button
              class="service-row"
              onclick={() =>
                onContact(
                  `Gostava de saber mais sobre ${service.title.toLocaleLowerCase('pt-PT')}.`,
                )}
            >
              <span class="service-icon"
                ><service.icon size={29} strokeWidth={1.35} aria-hidden="true" /></span
              >
              <span class="service-copy"
                ><span class="service-title">{service.title}</span><span class="service-description"
                  >{service.copy}</span
                ></span
              >
              <ArrowUpRight class="service-arrow" size={15} aria-hidden="true" />
            </button>
          {/each}
        </div>
      </div>
    </div>
  </section>
</div>

<style>
  .home-services {
    width: 100%;
    margin: var(--orbit-space-section, 86px) auto 0;
    scroll-margin-top: 120px;
  }
  .home-services * {
    box-sizing: border-box;
  }
  h2,
  p {
    margin: 0;
  }
  button {
    font: inherit;
    color: inherit;
    cursor: pointer;
    text-align: left;
    border: 0;
    background: transparent;
  }
  button:focus-visible {
    outline: 2px solid #fff;
    outline-offset: 4px;
  }
  .service-banner {
    position: relative;
    isolation: isolate;
    overflow: hidden;
    color: #f5f5f1;
    background: #121315;
  }
  .banner-background {
    position: absolute;
    inset: 0;
    z-index: -2;
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: 50% 54%;
    filter: grayscale(1) brightness(0.72);
    pointer-events: none;
  }
  .service-banner::before {
    content: '';
    position: absolute;
    inset: 0;
    z-index: -1;
    background:
      linear-gradient(90deg, #07090c78, #07090ca8 48%, #07090cd9),
      linear-gradient(0deg, #07090c60, transparent 60%);
    pointer-events: none;
  }
  .banner-content {
    width: var(--orbit-frame, 90%);
    max-width: var(--orbit-frame-max, 1720px);
    margin-inline: auto;
    padding-block: clamp(48px, 4.5vw, 72px);
    min-height: 620px;
    display: grid;
    grid-template-columns: minmax(0, 0.85fr) minmax(0, 1fr);
    gap: 9%;
    align-items: center;
  }
  .brand-column {
    display: flex;
    align-items: flex-start;
    flex-direction: column;
    padding-block: 18px;
    min-width: 0;
  }
  .brand-eyebrow {
    font-size: 9px;
    line-height: 1.6;
    letter-spacing: 0.15em;
    color: #d3d5d7;
  }
  .banner-logo {
    display: block;
    width: min(100%, 380px);
    height: auto;
    margin: 42px 0 28px;
  }
  .brand-caption {
    font-size: clamp(18px, calc(2.1vw - 5px), 29px);
    font-weight: 500;
    letter-spacing: -0.04em;
    line-height: 1.2;
    text-wrap: balance;
  }
  .brand-note {
    max-width: 340px;
    color: #c1c5c9;
    font-size: 12px;
    line-height: 1.7;
    margin-top: 12px;
  }
  .brand-contact {
    position: relative;
    display: inline-flex;
    align-items: center;
    gap: 24px;
    margin-top: 28px;
    min-height: 44px;
    padding: 12px 0;
    border-bottom: 1px solid #ffffff50;
    font-size: 12px;
  }
  .brand-contact::after {
    content: '';
    position: absolute;
    inset: auto 0 -1px;
    height: 1px;
    background: var(--red, #e30613);
    clip-path: inset(0 100% 0 0);
    transition: clip-path 420ms ease;
    pointer-events: none;
  }
  .brand-contact :global(svg) {
    transition: transform 220ms;
  }
  .brand-contact:is(:hover, :focus-visible)::after {
    clip-path: inset(0 0 0 0);
  }
  .brand-contact:is(:hover, :focus-visible) :global(svg) {
    transform: translate(3px, -3px);
  }
  @media (prefers-reduced-motion: reduce) {
    .brand-contact::after,
    .brand-contact :global(svg) {
      transition: none;
    }
  }
  .services-column {
    min-width: 0;
  }
  .services-heading {
    display: flex;
    align-items: center;
    gap: 13px;
    margin-bottom: 21px;
  }
  .heading-rule {
    width: 27px;
    height: 2px;
    background: #ff2433;
    flex-shrink: 0;
  }
  h2 {
    font-size: 18px;
    font-weight: 500;
    letter-spacing: 0.05em;
    line-height: 1.35;
    text-transform: uppercase;
  }
  .service-list {
    display: grid;
    gap: 3px;
  }
  .service-row {
    display: flex;
    align-items: center;
    gap: 18px;
    width: 100%;
    min-width: 0;
    padding: 11px 0;
  }
  .service-icon {
    width: 34px;
    display: flex;
    justify-content: center;
    color: #eceff0;
    flex-shrink: 0;
  }
  .service-copy {
    display: flex;
    flex-direction: column;
    gap: 4px;
    flex: 1;
    min-width: 0;
  }
  .service-title {
    font-size: 13px;
    font-weight: 600;
    line-height: 1.3;
    letter-spacing: 0.035em;
    text-transform: uppercase;
  }
  .service-description {
    font-size: 11px;
    color: #d0d2d5;
    line-height: 1.55;
  }
  .service-row :global(.service-arrow) {
    flex-shrink: 0;
    color: #aaaeb3;
  }
  .essential h2 {
    font-size: 20px;
  }
  .service-banner button:focus-visible {
    outline-color: var(--red, #e30613);
  }
  .service-banner .service-row:focus-visible .service-icon {
    color: var(--red, #e30613);
  }
  @media (hover: hover) {
    .service-row:hover .service-title {
      color: #fff;
      text-decoration: underline;
      text-underline-offset: 4px;
    }
    .service-row:hover .service-icon,
    .service-row:hover :global(.service-arrow) {
      color: var(--red, #e30613);
    }
  }
  @media (prefers-reduced-motion: no-preference) {
    .service-icon {
      transition:
        color 180ms ease,
        border-color 180ms ease;
    }
  }
  @media (max-width: 1050px) {
    .banner-content {
      gap: 6%;
      grid-template-columns: minmax(0, 0.8fr) minmax(0, 1fr);
    }
    .brand-caption {
      font-size: 20px;
    }
    .service-row {
      gap: 13px;
    }
    .service-description {
      font-size: 11px;
    }
  }
  @media (max-width: 700px) {
    .banner-content {
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      gap: 37px;
      padding-block: 42px;
      min-height: 0;
    }
    .brand-column {
      padding-block: 0;
    }
    .banner-logo {
      width: min(80%, 250px);
      margin-block: 26px 22px;
    }
    .brand-caption {
      font-size: 21px;
    }
    .brand-note {
      font-size: 11px;
      max-width: 290px;
    }
    .brand-contact {
      margin-top: 20px;
    }
    .services-heading {
      margin-bottom: 16px;
    }
    h2 {
      font-size: 17px;
    }
    .essential h2 {
      font-size: 19px;
    }
    .service-row {
      padding-block: 12px;
      gap: 14px;
    }
    .service-title {
      font-size: 12px;
    }
    .service-description {
      font-size: 11px;
    }
    .service-row :global(.service-arrow) {
      width: 12px;
    }
    .banner-background {
      object-position: var(--service-mobile-focus, 35% 50%);
    }
    .service-banner::before {
      background: linear-gradient(180deg, #07090c80, #07090ce0 43%, #07090cf0);
    }
  }
</style>
