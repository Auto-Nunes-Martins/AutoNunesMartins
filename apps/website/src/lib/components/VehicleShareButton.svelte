<script lang="ts">
  import { Share2 } from 'lucide-svelte';
  import { tick } from 'svelte';
  import { shareVehicle } from '$lib/vehicleShare';
  let { title, url }: { title: string; url: string } = $props();
  let pending = $state(false);
  let message = $state('');
  let manual = $state(false);
  let recovery = $state<HTMLInputElement>();
  const inputId = $props.id();
  $effect(() => {
    url;
    message = '';
    manual = false;
  });
  async function share() {
    if (pending) return;
    pending = true;
    message = '';
    manual = false;
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
    if (result === 'copied') message = 'Ligação copiada.';
    if (result === 'manual') {
      message = 'Não foi possível copiar automaticamente. Copie a ligação abaixo.';
      manual = true;
      await tick();
      recovery?.focus();
      recovery?.select();
    }
  }
</script>

<div class="vehicle-share">
  <button type="button" onclick={share} disabled={pending} aria-label="Partilhar viatura">
    <Share2 size={16} strokeWidth={1.5} aria-hidden="true" />Partilhar
  </button>
  <p role="status" aria-live="polite">{message}</p>
  {#if manual}<label for={inputId}>Ligação da viatura</label><input
      id={inputId}
      bind:this={recovery}
      value={url}
      readonly
      onfocus={(event) => event.currentTarget.select()}
    />{/if}
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
  button:focus-visible,
  input:focus-visible {
    outline: 2px solid var(--red);
    outline-offset: 4px;
  }
  p {
    margin: 0;
    font-size: 12px;
    line-height: 1.5;
    color: var(--muted);
  }
  p:not(:empty) {
    margin-top: 8px;
  }
  label {
    display: block;
    margin-top: 8px;
    font-size: 12px;
  }
  input {
    display: block;
    box-sizing: border-box;
    width: 100%;
    min-height: 44px;
    margin-top: 4px;
    padding: 8px;
    border: 1px solid var(--line);
    border-radius: 4px;
    background: var(--bg);
    color: var(--text);
    font: inherit;
    font-size: 12px;
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
</style>
