<script lang="ts">
  import { onMount } from 'svelte';
  import { afterNavigate } from '$app/navigation';
  import { page } from '$app/state';
  import { standContact } from './stand-concepts/standContact';
  import { whatsappUrl } from '$lib/whatsappContact';
  import { watchHomeStats } from '$lib/whatsappVisibility';

  const href = whatsappUrl(standContact.whatsapp);
  const label = standContact.whatsapp?.demo ? 'WhatsApp — demonstração' : 'Contactar pelo WhatsApp';
  const isHome = $derived(page.url.pathname === '/');
  let pastStats = $state(false);
  let refresh = () => {};
  afterNavigate(() => {
    pastStats = false;
    refresh();
  });
  onMount(() => {
    const visibility = watchHomeStats(
      () => isHome,
      (passed) => {
        pastStats = passed;
      },
    );
    refresh = visibility.refresh;
    return () => {
      visibility.destroy();
      refresh = () => {};
    };
  });
</script>

{#snippet icon()}
  <!-- Bootstrap Icons (MIT): /licenses/bootstrap-icons.txt -->
  <svg viewBox="0 0 16 16" width="34" height="34" fill="currentColor" aria-hidden="true">
    <path
      d="M13.601 2.326A7.85 7.85 0 0 0 7.994 0C3.627 0 .068 3.558.064 7.926c0 1.399.366 2.76 1.057 3.965L0 16l4.204-1.102a7.9 7.9 0 0 0 3.79.965h.004c4.368 0 7.926-3.558 7.93-7.93A7.9 7.9 0 0 0 13.6 2.326zM7.994 14.521a6.6 6.6 0 0 1-3.356-.92l-.24-.144-2.494.654.666-2.433-.156-.251a6.56 6.56 0 0 1-1.007-3.505c0-3.626 2.957-6.584 6.591-6.584a6.56 6.56 0 0 1 4.66 1.931 6.56 6.56 0 0 1 1.928 4.66c-.004 3.639-2.961 6.592-6.592 6.592m3.615-4.934c-.197-.099-1.17-.578-1.353-.646-.182-.065-.315-.099-.445.099-.133.197-.513.646-.627.775-.114.133-.232.148-.43.05-.197-.1-.836-.308-1.592-.985-.59-.525-.985-1.175-1.103-1.372-.114-.198-.011-.304.088-.403.087-.088.197-.232.296-.346.1-.114.133-.198.198-.33.065-.134.034-.248-.015-.347-.05-.099-.445-1.076-.612-1.47-.16-.389-.323-.335-.445-.34-.114-.007-.247-.007-.38-.007a.73.73 0 0 0-.529.247c-.182.198-.691.677-.691 1.654s.71 1.916.81 2.049c.098.133 1.394 2.132 3.383 2.992.47.205.84.326 1.129.418.475.152.904.129 1.246.08.38-.058 1.171-.48 1.338-.943.164-.464.164-.86.114-.943-.049-.084-.182-.133-.38-.232"
    />
  </svg>
{/snippet}

<aside
  aria-label="Contacto por WhatsApp"
  class="whatsapp-float"
  class:before-home-stats={isHome && !pastStats}
>
  {#if href}
    <a
      {href}
      target="_blank"
      rel="noopener noreferrer"
      referrerpolicy="no-referrer"
      data-sveltekit-preload-data="off"
      data-sveltekit-preload-code="off"
      aria-label={`${label} (abre numa nova janela)`}
      title={label}
    >
      {@render icon()}
    </a>
  {:else}
    <button
      type="button"
      aria-disabled="true"
      aria-label="WhatsApp — contacto indisponível"
      title="WhatsApp — contacto indisponível"
    >
      {@render icon()}
    </button>
  {/if}
</aside>

<style>
  .whatsapp-float {
    position: fixed;
    z-index: 40;
    right: max(30px, env(safe-area-inset-right));
    bottom: max(44px, env(safe-area-inset-bottom));
  }
  a,
  button {
    display: grid;
    place-items: center;
    width: 60px;
    height: 60px;
    padding: 0;
    border: 1px solid #ffffff38;
    border-radius: 50%;
    background: #168b50;
    color: #fff;
    box-shadow:
      0 3px 10px #0003,
      0 10px 26px #00000042;
    text-decoration: none;
    cursor: pointer;
  }
  button[aria-disabled] {
    background: #34483d;
    cursor: default;
  }
  a:focus-visible,
  button:focus-visible {
    outline: 3px solid #fff;
    outline-offset: 3px;
    box-shadow: 0 0 0 7px #17231e;
  }
  @media (hover: hover) {
    a:hover {
      background: #127440;
    }
  }
  @media (prefers-reduced-motion: no-preference) {
    a {
      transition:
        background-color 180ms ease,
        box-shadow 180ms ease;
    }
  }
  :global(body:has(dialog[open])) .whatsapp-float,
  :global(body:has([aria-modal='true'])) .whatsapp-float {
    visibility: hidden;
    pointer-events: none;
  }
  @media (max-width: 700px) {
    .before-home-stats {
      visibility: hidden;
      pointer-events: none;
    }
    .whatsapp-float {
      right: max(22px, env(safe-area-inset-right));
      bottom: max(38px, env(safe-area-inset-bottom));
    }
    a,
    button {
      width: 54px;
      height: 54px;
    }
    svg {
      width: 31px;
      height: 31px;
    }
  }
</style>
