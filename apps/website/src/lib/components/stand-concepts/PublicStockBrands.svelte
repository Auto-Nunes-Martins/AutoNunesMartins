<script lang="ts">
  import { ArrowUpRight } from 'lucide-svelte';
  import { catalogBrandLinks, type PublicBrandDirectory } from '$lib/catalogBrandLinks';
  import { brandLogo } from '$lib/brandLogos';
  import { brandMarquee } from '$lib/brandMarquee';
  let {
    directory,
    context = 'home',
  }: { directory: PublicBrandDirectory; context?: 'home' | 'catalog' } = $props();
  const links = $derived(directory.status === 'ready' ? catalogBrandLinks(directory.brands) : []);
</script>

<section
  class="stock-brands"
  class:catalog-context={context === 'catalog'}
  aria-label="Explorar por marca"
>
  <div class="brands-heading">
    <h2>Explorar por marca.</h2>
    {#if context === 'home'}<p>Marcas com viaturas disponíveis.</p>{/if}
  </div>
  {#if links.length}
    <nav aria-label="Marcas do catálogo" use:brandMarquee>
      <div class="brand-track">
        {#each [false, true] as duplicate}
          <ul
            class:duplicate
            data-brand-primary={!duplicate ? true : undefined}
            aria-hidden={duplicate ? true : undefined}
          >
            {#each links as brand (brand.name)}
              {@const logo = brandLogo(brand.name)}
              <li>
                <a
                  href={brand.href}
                  class:without-logo={!logo}
                  tabindex={duplicate ? -1 : undefined}
                >
                  {#if logo}<img
                      class="brand-logo"
                      class:wide-logo={['audi', 'dacia'].includes(brand.name.trim().toLowerCase())}
                      src={logo}
                      alt=""
                      aria-hidden="true"
                      width="72"
                      height="44"
                      loading="lazy"
                      decoding="async"
                    />{/if}
                  <span class="brand-label"><span class="brand-name">{brand.name}</span></span>
                  <ArrowUpRight size={17} aria-hidden="true" />
                </a>
              </li>
            {/each}
          </ul>
        {/each}
      </div>
    </nav>
  {:else}
    <p class="empty">
      {directory.status === 'ready'
        ? 'Neste momento não há marcas com viaturas disponíveis.'
        : 'Não foi possível consultar as marcas neste momento.'}
      <a href="/viaturas">Consultar catálogo <ArrowUpRight size={15} aria-hidden="true" /></a>
    </p>
  {/if}
</section>

<style>
  .stock-brands {
    border-top: 1px solid var(--line);
    padding-top: 32px;
  }
  .brands-heading {
    position: relative;
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 16px 32px;
    margin-bottom: 24px;
  }
  h2,
  p {
    margin: 0;
  }
  h2 {
    font-size: clamp(26px, 2.5vw, 36px);
    font-weight: 500;
    line-height: 1.2;
    letter-spacing: -0.04em;
  }
  p {
    color: var(--muted);
    font-size: 14px;
    line-height: 1.7;
  }
  ul {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 0 28px;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .duplicate {
    display: none;
  }
  @media (min-width: 701px) {
    li:nth-child(n + 7) {
      display: none;
    }
  }
  li {
    min-width: 0;
  }
  a {
    color: var(--text);
    text-decoration: none;
  }
  li a {
    display: grid;
    grid-template-columns: 72px minmax(0, 1fr) 17px;
    align-items: center;
    gap: 16px;
    height: 100%;
    min-height: 96px;
    border-bottom: 1px solid var(--line);
    padding: 20px 4px;
    box-sizing: border-box;
    font-size: 16px;
  }
  .brand-logo {
    display: block;
    width: 72px;
    height: 44px;
    object-fit: contain;
  }
  .brand-logo.wide-logo {
    transform: scale(1.4);
  }
  :global(:where(html)[data-theme='dark']) .brand-logo {
    filter: invert(1);
  }
  .brand-label {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 7px;
    min-width: 0;
  }
  .without-logo .brand-label {
    grid-column: 1 / 3;
  }
  .brand-name {
    position: relative;
    min-width: 0;
    overflow-wrap: anywhere;
  }
  .brand-name::after {
    content: '';
    position: absolute;
    inset: auto 0 -4px;
    height: 1px;
    background: var(--red);
    clip-path: inset(0 100% 0 0);
    transform-origin: left;
  }
  a :global(svg) {
    flex-shrink: 0;
  }
  a:focus-visible {
    outline: 2px solid var(--red);
    outline-offset: 4px;
  }
  a:focus-visible .brand-name::after {
    clip-path: inset(0 0 0 0);
  }
  a:focus-visible :global(svg) {
    rotate: 45deg;
    color: var(--red);
  }
  .empty a {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    min-height: 44px;
    margin-left: 8px;
  }
  @media (hover: hover) {
    a:hover .brand-name::after {
      clip-path: inset(0 0 0 0);
    }
    a:hover :global(svg) {
      rotate: 45deg;
      color: var(--red);
    }
    .empty a:hover {
      text-decoration: underline;
      text-underline-offset: 4px;
    }
  }
  @media (prefers-reduced-motion: no-preference) {
    .brand-name::after {
      transition: clip-path 220ms ease;
    }
    a :global(svg) {
      transition:
        rotate 220ms ease,
        color 220ms ease;
    }
  }
  @media (max-width: 700px) {
    .stock-brands {
      display: none;
    }
    .brands-heading {
      display: block;
      margin-bottom: 16px;
    }
    .brands-heading p {
      margin-top: 10px;
    }
    nav {
      display: block;
      overflow-x: auto;
      scroll-padding-inline: 4px;
      padding: 6px 0 10px;
      scrollbar-width: none;
    }
    nav::-webkit-scrollbar {
      display: none;
    }
    .brand-track {
      display: flex;
      width: max-content;
    }
    ul {
      display: flex;
      width: max-content;
      gap: 12px;
      padding: 0 12px 0 0;
    }
    .duplicate {
      display: none;
    }
    nav:global([data-brand-loop='true']) .duplicate {
      display: flex;
    }
    li {
      flex: 0 0 96px;
      width: 96px;
      scroll-snap-align: start;
    }
    li a {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 12px;
      min-height: 100px;
      padding: 10px 4px;
      border: 0;
      border-radius: 0;
      background: transparent;
      font-size: 12px;
    }
    .brand-logo {
      grid-column: 1 / -1;
      grid-row: 1;
      justify-self: center;
      height: 40px;
    }
    .brand-label,
    .without-logo .brand-label {
      align-items: center;
      text-align: center;
    }
    li a > :global(svg) {
      display: none;
    }
    .empty a {
      display: flex;
      width: fit-content;
      margin: 8px 0 0;
    }
  }
  @media (max-width: 700px) and (prefers-reduced-motion: reduce) {
    nav {
      scroll-snap-type: x proximity;
    }
    nav:global([data-brand-loop]) .duplicate {
      display: none;
    }
  }
  .catalog-context {
    padding-top: 24px;
  }
  .catalog-context .brands-heading {
    margin-bottom: var(--catalog-heading-gap, 14px);
  }
  .catalog-context h2 {
    font-size: 18px;
    font-weight: 500;
    line-height: 1.5;
    letter-spacing: -0.02em;
  }
</style>
