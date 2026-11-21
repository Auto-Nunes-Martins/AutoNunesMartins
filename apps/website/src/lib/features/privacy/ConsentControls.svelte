<script lang="ts">
  import { onMount } from 'svelte';
  import { essentialOnly, openSiteConsent, saveSiteConsent } from '$lib/features/privacy/siteConsent';

  let ready = $state(false);
  let status = $state('');
  onMount(() => {
    ready = true;
  });
</script>

<h3 id="consentimento">Preferências de privacidade</h3>
<p>Pode alterar as escolhas ou desligar todas as opções a qualquer momento.</p>
<div class="actions">
  <button
    type="button"
    disabled={!ready}
    onclick={() => {
      status = '';
      openSiteConsent();
    }}
  >
    Alterar preferências
  </button>
  <button
    type="button"
    disabled={!ready}
    onclick={() => {
      saveSiteConsent(essentialOnly);
      status = 'Opções desligadas.';
    }}>Retirar consentimento</button
  >
</div>
<p role="status">{status}</p>
<noscript
  ><p>Com JavaScript desativado, as opções de privacidade permanecem desligadas.</p></noscript
>

<style>
  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
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
</style>
