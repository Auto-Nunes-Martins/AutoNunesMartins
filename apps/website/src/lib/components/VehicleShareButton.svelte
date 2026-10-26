<script lang="ts">
  import { Check, Share2 } from 'lucide-svelte';
  import { onDestroy } from 'svelte';
  import { shareVehicle } from '$lib/vehicleShare';
  let { title, url }: { title: string; url: string } = $props();
  let pending = $state(false);
  let message = $state('');
  let label = $state('Partilhar');
  let confirmed = $state(false);
  let resetTimer: ReturnType<typeof setTimeout> | undefined;
  function reset() {
    clearTimeout(resetTimer);
    label = 'Partilhar';
    confirmed = false;
    message = '';
  }
  onDestroy(() => clearTimeout(resetTimer));
  $effect(() => {
    url;
    reset();
  });
  async function share() {
    if (pending) return;
    pending = true;
    reset();
    const result = await shareVehicle(
      { title, url },
      {
        share: typeof navigator.share === 'function' ? (data) => navigator.share(data) : undefined,
        copy: navigator.clipboard?.writeText
          ? (text) => navigator.clipboard.writeText(text)
          : undefined,
      },
    );
    pending = false;
    if (result === 'copied' || result === 'shared') {
      confirmed = true;
      label = result === 'copied' ? 'Copiado' : 'Partilhado';
      message = result === 'copied' ? 'Ligação copiada.' : 'Partilha concluída.';
    }
    if (result === 'manual') {
      label = 'Não copiado';
      message =
        'Não foi possível copiar automaticamente. Pode copiar a ligação da barra de endereço.';
    }
    if (result !== 'cancelled') resetTimer = setTimeout(reset, 2500);
  }
</script>

<div class="vehicle-share">
  <button
    type="button"
    onclick={share}
    disabled={pending}
    aria-busy={pending}
    aria-label="Partilhar viatura"
  >
    {#if confirmed}<Check size={16} strokeWidth={1.5} aria-hidden="true" />{:else}<Share2
        size={16}
        strokeWidth={1.5}
        aria-hidden="true"
      />{/if}
    <span class="share-label">{label}</span>
  </button>
  <p class="sr-only" role="status" aria-live="polite">{message}</p>
</div>

<style>
  .vehicle-share {
    grid-column: 1 / -1;
    min-width: 0;
    max-width: 100%;
  }
  button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 9px;
    min-height: 44px;
    padding: 11px 18px;
    border: 1px solid transparent;
    border-radius: 999px;
    background: color-mix(in srgb, var(--text) 7%, var(--bg));
    color: var(--text);
    font: inherit;
    font-size: 12px;
    cursor: pointer;
  }
  button:disabled {
    opacity: 0.5;
    cursor: wait;
  }
  .share-label {
    display: inline-block;
    width: 12ch;
    text-align: center;
  }
  button:focus-visible {
    outline: 2px solid var(--red);
    outline-offset: 4px;
  }
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }
  @media (hover: hover) {
    button:hover:not(:disabled) {
      background: var(--text);
      color: var(--bg);
    }
  }
  @media (prefers-reduced-motion: no-preference) {
    button {
      transition:
        background-color 180ms ease,
        color 180ms ease;
    }
  }
  @media (max-width: 700px) {
    button {
      gap: 6px;
    }
    .share-label {
      text-align: left;
    }
  }
</style>
