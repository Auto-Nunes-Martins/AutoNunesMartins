<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { crmPath } from '$lib/paths';
  import Wordmark from '$lib/components/brand/Wordmark.svelte';
  import CrmBrandHead from '$lib/components/brand/CrmBrandHead.svelte';

  let failed = $state(false);
  let pending = $state(false);
  async function enter() {
    if (pending) return;
    pending = true;
    failed = false;
    try {
      await goto(crmPath('/dashboard'), { replaceState: true });
    } catch {
      failed = true;
    } finally {
      pending = false;
    }
  }
  onMount(() => {
    void enter();
  });
</script>

<CrmBrandHead />
<svelte:head><title>A entrar no CRM — Auto Nunes Martins</title></svelte:head>
<main class="auth-transition">
  <div class="entry-content">
    <Wordmark size="md" />
    <div class="entry-status" role="status" aria-live="polite">
      {#if !failed}<span class="entry-spinner" aria-hidden="true"></span>{/if}
      <h1>{failed ? 'Não foi possível abrir o painel.' : 'A preparar o seu painel.'}</h1>
      <p>
        {failed
          ? 'A ligação foi interrompida. Pode tentar novamente.'
          : 'Só um momento, estamos a carregar o CRM.'}
      </p>
    </div>
    {#if failed}<button type="button" onclick={enter} disabled={pending}>Tentar novamente</button
      >{/if}
    <noscript><p>Continue para o <a href={crmPath('/dashboard')}>painel do CRM</a>.</p></noscript>
  </div>
</main>

<style>
  .auth-transition {
    display: grid;
    place-items: center;
    box-sizing: border-box;
    min-height: 100svh;
    padding: 32px 24px;
    background: var(--color-bg-0);
    color: var(--color-text);
  }
  .entry-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    max-width: 440px;
    width: 100%;
  }
  .entry-status {
    margin-top: 44px;
  }
  .entry-spinner {
    display: block;
    width: 25px;
    height: 25px;
    margin: 0 auto 22px;
    border-radius: 50%;
    background: conic-gradient(from 0deg, transparent, var(--color-text-muted));
    mask: radial-gradient(farthest-side, transparent calc(100% - 2px), #000 0);
    animation: entry-spin 850ms linear infinite;
  }
  h1 {
    margin: 0;
    font: 500 20px/1.4 var(--font-sans);
    letter-spacing: -0.025em;
  }
  p {
    margin: 12px 0 0;
    font: 13px/1.7 var(--font-sans);
    color: var(--color-text-muted);
  }
  button {
    margin-top: 24px;
    min-height: 44px;
    padding: 10px 20px;
    border: 0;
    border-radius: var(--radius-btn);
    background: var(--color-red);
    color: white;
    font: 500 13px var(--font-sans);
    cursor: pointer;
  }
  button:hover {
    background: var(--color-red-deep);
  }
  button:focus-visible,
  a:focus-visible {
    outline: 2px solid var(--color-red);
    outline-offset: 4px;
  }
  a {
    color: inherit;
    text-underline-offset: 3px;
  }
  @keyframes entry-spin {
    to {
      transform: rotate(360deg);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .entry-spinner {
      animation: none;
    }
  }
</style>
