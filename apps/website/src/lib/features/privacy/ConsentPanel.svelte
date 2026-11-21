<script lang="ts">
  import { onMount } from 'svelte';
  import {
    essentialOnly,
    readSiteConsent,
    saveSiteConsent,
    watchConsentOpening,
    watchSiteConsent,
    type ConsentOptions,
  } from '$lib/features/privacy/siteConsent';

  let showNotice = $state(false);
  let preferences = $state(false);
  let maps = $state(false);
  let ads = $state(false);
  let dialog: HTMLDialogElement;
  let opener: HTMLElement | null = null;

  function open() {
    const choice = readSiteConsent() ?? essentialOnly;
    preferences = choice.preferences;
    maps = choice.maps;
    ads = choice.ads;
    opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (!dialog.open) dialog.showModal();
  }

  function save(choice: ConsentOptions) {
    saveSiteConsent(choice);
    if (dialog.open) dialog.close();
  }

  onMount(() => {
    const stop = watchSiteConsent((choice) => (showNotice = !choice?.hasAdsDecision));
    const stopOpening = watchConsentOpening(open);
    return () => {
      stop();
      stopOpening();
    };
  });
</script>

{#if showNotice}
  <section class="notice" aria-labelledby="consent-notice-title">
    <div>
      <h2 id="consent-notice-title">Cookies e privacidade</h2>
      <p>Pode retomar a leitura, mostrar o mapa do Google e autorizar a medição de publicidade.</p>
      <a href="/politica-de-privacidade#preferencias">Como funciona o armazenamento</a>
    </div>
    <div class="actions">
      <button type="button" onclick={open}>Personalizar</button>
      <button type="button" onclick={() => save(essentialOnly)}>Rejeitar opcionais</button>
      <button type="button" onclick={() => save({ preferences: true, maps: true, ads: true })}
        >Aceitar opcionais</button
      >
    </div>
  </section>
{/if}

<dialog bind:this={dialog} aria-labelledby="site-consent-title" onclose={() => opener?.focus()}>
  <div class="heading">
    <h2 id="site-consent-title">Preferências de privacidade</h2>
    <button type="button" aria-label="Fechar preferências" onclick={() => dialog.close()}>×</button>
  </div>
  <p>
    As opções abaixo ficam desligadas até as escolher. Pode voltar a este painel pela Política de
    Privacidade.
  </p>
  <label class="option">
    <span
      ><strong>Retomar a leitura</strong><span class="description"
        >Recorda a posição neste separador para poder voltar ao mesmo ponto ao recarregar a página.</span
      ></span
    >
    <span class="switch">
      <input type="checkbox" role="switch" bind:checked={preferences} />
      <span class="switch-track" aria-hidden="true"></span>
    </span>
  </label>
  <label class="option">
    <span
      ><strong>Mapa incorporado do Google</strong><span class="description"
        >Mostra o mapa da primeira morada. Ao carregar, o navegador comunica com a Google, que pode
        utilizar cookies.</span
      ></span
    >
    <span class="switch">
      <input type="checkbox" role="switch" bind:checked={maps} />
      <span class="switch-track" aria-hidden="true"></span>
    </span>
  </label>
  <label class="option">
    <span
      ><strong>Medição de publicidade</strong><span class="description">
        Permite ao Google Ads medir resultados de anúncios. A Google pode usar cookies e dados da
        ligação e da visita.
      </span></span
    >
    <span class="switch">
      <input type="checkbox" role="switch" bind:checked={ads} />
      <span class="switch-track" aria-hidden="true"></span>
    </span>
  </label>
  <div class="actions">
    <button type="button" onclick={() => save(essentialOnly)}>Rejeitar opcionais</button>
    <button type="button" class="save" onclick={() => save({ preferences, maps, ads })}
      >Guardar escolhas</button
    >
  </div>
</dialog>

<style>
  .notice,
  dialog {
    color: #f8f7f5;
    background: #252629;
    border: 1px solid #62636a;
    border-top: 3px solid #e30613;
    border-radius: 14px;
    padding: clamp(15px, 3vw, 24px);
    box-shadow: 0 12px 50px #0007;
    font:
      500 14px/1.45 Inter,
      system-ui,
      sans-serif;
  }
  .notice {
    position: fixed;
    z-index: 1100;
    inset-inline: max(12px, env(safe-area-inset-left)) max(12px, env(safe-area-inset-right));
    bottom: max(12px, env(safe-area-inset-bottom));
    width: min(55rem, calc(100% - 24px));
    margin-inline: auto;
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    gap: 14px 24px;
  }
  dialog {
    width: min(35rem, calc(100vw - 24px));
    max-height: calc(100dvh - 32px);
    overflow: auto;
    margin: auto;
  }
  dialog::backdrop {
    background: #0a0a0caa;
  }
  h2 {
    margin: 0;
    font-size: 1.3rem;
    font-weight: 700;
  }
  p,
  .description {
    margin: 5px 0;
    color: #dcdbde;
  }
  a {
    text-decoration: underline;
    text-underline-offset: 3px;
  }
  .heading,
  .option,
  .actions {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .heading,
  .option {
    justify-content: space-between;
  }
  .option {
    border-top: 1px solid #5a5a61;
    padding-block: 12px;
  }
  .description {
    display: block;
  }
  .switch {
    position: relative;
    flex: 0 0 46px;
    height: 44px;
    display: grid;
    align-items: center;
  }
  .switch input {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    margin: 0;
    opacity: 0;
    cursor: pointer;
  }
  .switch-track {
    width: 100%;
    height: 26px;
    display: flex;
    align-items: center;
    padding-inline: 3px;
    border: 1px solid #96969c;
    border-radius: 999px;
    background: #393a40;
  }
  .switch-track::before {
    content: '';
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: #f8f7f5;
  }
  .switch input:checked + .switch-track {
    justify-content: flex-end;
    border-color: #ff5261;
    background: #bc0712;
  }
  .switch input:focus-visible + .switch-track {
    outline: 2px solid white;
    outline-offset: 3px;
  }
  @media (forced-colors: active) {
    .switch-track {
      border-color: ButtonText;
    }
    .switch-track::before {
      forced-color-adjust: none;
      background: ButtonText;
    }
  }
  label {
    cursor: pointer;
  }
  .actions {
    flex-wrap: wrap;
  }
  button {
    color: inherit;
    min-height: 44px;
    padding: 6px 13px;
    border: 1px solid #96969c;
    border-radius: 7px;
    background: #303136;
    font-weight: 600;
    cursor: pointer;
  }
  button:hover {
    background: #44454d;
  }
  .save {
    background: #bc0712;
    border-color: #ff5261;
  }
  .save:hover {
    background: #980610;
  }
  :is(button, input, a):focus-visible {
    outline: 2px solid white;
    outline-offset: 3px;
  }
</style>
