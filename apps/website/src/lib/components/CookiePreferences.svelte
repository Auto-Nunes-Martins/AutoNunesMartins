<script lang="ts">
  import { onMount } from 'svelte';

  let declaration: HTMLDivElement;
  let declarationReady = $state(false);
  let declarationFailed = $state(false);
  let actionStatus = $state('');
  let dialogTimeout: number | undefined;

  function clearDialogTimeout() {
    window.clearTimeout(dialogTimeout);
  }

  function dialogDisplayed() {
    clearDialogTimeout();
    actionStatus = '';
  }

  onMount(() => {
    const cbid = document.getElementById('Cookiebot')?.getAttribute('data-cbid');
    if (!cbid) {
      declarationFailed = true;
      return;
    }
    const script = document.createElement('script');
    script.id = 'CookieDeclaration';
    script.src = `https://consent.cookiebot.com/${cbid}/cd.js`;
    script.type = 'text/javascript';
    script.async = true;
    script.onerror = () => {
      declarationFailed = true;
    };
    // A successful cd.js request can still produce no declaration for an unauthorised domain.
    const rendered = new MutationObserver(() => {
      declarationReady = declaration.querySelector('.CookieDeclaration') !== null;
      if (declarationReady) declarationFailed = false;
    });
    rendered.observe(declaration, { childList: true, subtree: true });
    declaration.appendChild(script);
    const declarationTimeout = window.setTimeout(() => {
      declarationFailed = !declarationReady;
    }, 5000);
    window.addEventListener('CookiebotOnDialogDisplay', dialogDisplayed);
    // The route owns the container and removes the vendor markup on exit.
    return () => {
      script.onerror = null;
      rendered.disconnect();
      window.clearTimeout(declarationTimeout);
      clearDialogTimeout();
      window.removeEventListener('CookiebotOnDialogDisplay', dialogDisplayed);
    };
  });

  function manage(action: 'renew' | 'withdraw') {
    actionStatus = '';
    clearDialogTimeout();
    try {
      const cmp = window.Cookiebot;
      if (typeof cmp?.[action] === 'function') {
        if (action === 'withdraw') {
          cmp.withdraw();
          if (
            cmp.consent?.preferences === false &&
            cmp.consent.statistics === false &&
            cmp.consent.marketing === false
          ) {
            actionStatus = 'Consentimento retirado.';
            return;
          }
          actionStatus = 'Não foi possível confirmar a retirada. Atualize a página para voltar a tentar.';
          return;
        }
        dialogTimeout = window.setTimeout(() => {
          actionStatus = 'O painel de cookies não abriu. Atualize a página para voltar a tentar.';
        }, 5000);
        cmp.renew();
        return;
      }
    } catch {
      // The site remains usable if the CMP is unavailable.
    }
    clearDialogTimeout();
    actionStatus = 'O painel de cookies está indisponível. Atualize a página para voltar a tentar.';
  }
</script>

<h3 id="consentimento">Preferências de cookies</h3>
<p>Use o painel Cookiebot para alterar ou retirar o consentimento para categorias opcionais.</p>
<div class="actions">
  <button type="button" onclick={() => manage('renew')}>Alterar consentimento</button>
  <button type="button" onclick={() => manage('withdraw')}>Retirar consentimento</button>
</div>
<p role="status">{actionStatus}</p>
<noscript><p>Ative o JavaScript para consultar o painel e a declaração de cookies.</p></noscript>
<div bind:this={declaration} hidden={!declarationReady}></div>
{#if declarationFailed}<p role="status">A declaração de cookies está indisponível.</p>{/if}

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
