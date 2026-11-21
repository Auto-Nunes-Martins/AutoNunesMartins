<script lang="ts">
  import { onMount } from 'svelte';
  import { ShieldCheck, ShieldMinus } from 'lucide-svelte';
  import { consentOptions } from './consentOptions';
  import {
    openSiteConsent,
    saveSiteConsent,
    watchSiteConsent,
    type readSiteConsent,
  } from './siteConsent';

  let choice = $state<ReturnType<typeof readSiteConsent>>();
  const enabled = $derived(consentOptions.filter((option) => choice?.[option.key]));
  const active = $derived(enabled.length > 0);
  onMount(() => watchSiteConsent((current) => (choice = current)));
</script>

<h3 id="consentimento">Preferências de privacidade</h3>
<div class="settings">
  <div role="status" aria-atomic="true" class="summary">
    {#if choice !== undefined}
      {#if active}
        <ShieldCheck size={24} aria-hidden="true" />
        <div>
          <strong>Consentimento ativo</strong>
          <span>{enabled.map((option) => option.label).join(' · ')}</span>
        </div>
      {:else}
        <ShieldMinus size={24} aria-hidden="true" />
        <div>
          <strong>{choice ? 'Consentimento inativo' : 'Sem escolha guardada'}</strong>
          <span>Todas as funções opcionais estão desligadas neste navegador.</span>
        </div>
      {/if}
    {/if}
  </div>
  <div class="actions">
    <button
      type="button"
      disabled={choice === undefined}
      onclick={(event) => openSiteConsent(event.currentTarget)}>Alterar preferências</button
    >
    <button type="button" disabled={!active} onclick={() => saveSiteConsent('withdrawn')}>
      {active
        ? 'Retirar consentimento'
        : choice?.withdrawn
          ? 'Consentimento retirado'
          : 'Sem consentimento para retirar'}
    </button>
  </div>
</div>
<noscript
  ><p>Com JavaScript desativado, as opções de privacidade permanecem desligadas.</p></noscript
>

<style>
  .settings {
    padding: clamp(16px, 3vw, 24px);
    border: 1px solid var(--line);
    border-radius: 8px;
    background: var(--surface);
  }
  .summary {
    display: flex;
    gap: 12px;
    align-items: flex-start;
  }
  .summary :global(svg) {
    flex: none;
    margin-top: 2px;
  }
  .summary strong,
  .summary span {
    display: block;
  }
  .summary strong {
    font-size: 1.2em;
    line-height: 1.5;
  }
  .summary span {
    color: var(--muted);
  }
  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 16px;
  }
  button {
    min-height: 44px;
    padding: 6px 12px;
    border: 1px solid currentColor;
    border-radius: 4px;
    background: transparent;
    color: inherit;
    font: inherit;
    cursor: pointer;
  }
  button:focus-visible {
    outline: 2px solid currentColor;
    outline-offset: 3px;
  }
  button:disabled {
    cursor: default;
    color: var(--muted);
    border-color: var(--line);
  }
</style>
