<script lang="ts">
  import { flushSync, onMount, tick } from 'svelte';
  import { X } from 'lucide-svelte';
  import { logoDark, logoDarkSrcset, logoLight, logoLightSrcset } from '$lib/localAssets';
  import { usePublicTheme } from '$lib/publicTheme';
  import { consentOptions } from './consentOptions';
  import {
    essentialOnly,
    readSiteConsent,
    saveSiteConsent,
    watchConsentOpening,
    watchSiteConsent,
    type ConsentOptions,
  } from './siteConsent';

  const tabs = ['Consentimento', 'Detalhes', 'Sobre'] as const;
  type Tab = (typeof tabs)[number];
  const { dark } = usePublicTheme();
  let showNotice = $state(false);
  let draft = $state<ConsentOptions>({ ...essentialOnly });
  let activeTab = $state<Tab>('Consentimento');
  let dialog: HTMLDialogElement;
  let panelMounted = $state(false);
  let noticeHeading = $state<HTMLHeadingElement>();
  let noticeOpener: HTMLElement | null = null;
  let opener: HTMLElement | null = null;
  const acceptAll = { preferences: true, maps: true, ads: true };
  let moreBelow = $state(false);

  function trackOverflow(node: HTMLElement, tab: Tab) {
    function measure() {
      moreBelow = node.scrollHeight - node.scrollTop - node.clientHeight > 1;
    }
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    for (const panel of node.children) observer.observe(panel);
    node.addEventListener('scroll', measure, { passive: true });
    return {
      update(next: Tab) {
        if (next !== tab) node.scrollTop = 0;
        tab = next;
        measure();
      },
      destroy() {
        observer.disconnect();
        node.removeEventListener('scroll', measure);
      },
    };
  }

  function open() {
    if (dialog.open) return;
    const { preferences, maps, ads } = readSiteConsent() ?? essentialOnly;
    draft = { preferences, maps, ads };
    activeTab = 'Consentimento';
    opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (!panelMounted) flushSync(() => (panelMounted = true));
    dialog.showModal();
  }

  function save(choice: ConsentOptions) {
    saveSiteConsent(choice);
    if (dialog.open) dialog.close();
    if (noticeOpener?.isConnected) noticeOpener.focus({ preventScroll: true });
    noticeOpener = null;
  }

  function navigateTabs(event: KeyboardEvent, index: number) {
    let next: number;
    if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
    else if (event.key === 'ArrowLeft') next = (index + tabs.length - 1) % tabs.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = tabs.length - 1;
    else return;
    event.preventDefault();
    activeTab = tabs[next]!;
    dialog.querySelector<HTMLButtonElement>('#consent-tab-' + next)?.focus();
  }

  onMount(() => {
    const stop = watchSiteConsent((choice) => (showNotice = !choice?.hasAdsDecision));
    const stopOpening = watchConsentOpening(async (button) => {
      noticeOpener = button;
      showNotice = true;
      await tick();
      noticeHeading?.focus({ preventScroll: true });
    });
    return () => {
      stop();
      stopOpening();
    };
  });
</script>

{#if showNotice}
  <section class="notice" aria-labelledby="consent-notice-title">
    <div class="notice-inner">
      <div class="brand">
        <img
          src={$dark ? logoDark : logoLight}
          srcset={$dark ? logoDarkSrcset : logoLightSrcset}
          sizes="(max-width: 700px) 108px, 188px"
          width="360"
          height="160"
          alt="Auto Nunes Martins"
        />
      </div>
      <div class="intro">
        <h2 id="consent-notice-title" bind:this={noticeHeading} tabindex="-1">
          Cookies e privacidade
        </h2>
        <p>
          Escolha se permite retomar a leitura, mostrar o mapa da Google e medir os resultados dos
          nossos anúncios.
        </p>
        <a href="/politica-de-privacidade#preferencias">Política de Privacidade</a>
      </div>
      <div class="notice-actions">
        <button class="primary" onclick={() => save(acceptAll)}>Aceitar tudo</button>
        <button class="secondary" onclick={() => save(essentialOnly)}>Recusar</button>
        <button class="secondary customize" onclick={open}>Personalizar</button>
      </div>
    </div>
  </section>
{/if}

<dialog
  bind:this={dialog}
  aria-labelledby="site-consent-title"
  onclose={() => opener?.isConnected && opener.focus()}
>
  {#if panelMounted}
    <header>
      <img
        src={$dark ? logoDark : logoLight}
        srcset={$dark ? logoDarkSrcset : logoLightSrcset}
        sizes="120px"
        width="360"
        height="160"
        alt="Auto Nunes Martins"
      />
      <button class="close" aria-label="Fechar preferências" onclick={() => dialog.close()}
        ><X size={20} aria-hidden="true" /></button
      >
      <h2 id="site-consent-title">Preferências de privacidade</h2>
    </header>
    <div class="tabs" role="tablist" aria-label="Preferências de privacidade">
      {#each tabs as tab, i}
        <button
          role="tab"
          id={'consent-tab-' + i}
          aria-selected={activeTab === tab}
          aria-controls={'consent-content-' + i}
          tabindex={activeTab === tab ? 0 : -1}
          onclick={() => (activeTab = tab)}
          onkeydown={(e) => navigateTabs(e, i)}>{tab}</button
        >
      {/each}
    </div>
    <div class="content" data-more-below={moreBelow ? '' : undefined} use:trackOverflow={activeTab}>
      {#each tabs as tab, i}
        <div
          hidden={activeTab !== tab}
          role="tabpanel"
          id={'consent-content-' + i}
          aria-labelledby={'consent-tab-' + i}
          tabindex="0"
        >
          {#if tab === 'Consentimento'}
            <p>
              Escolha as funções que quer ativar neste navegador. Pode alterar a sua decisão a
              qualquer momento.
            </p>
            {#each consentOptions as option}
              <label class="option">
                <span
                  ><strong>{option.label}</strong><span class="description">{option.summary}</span
                  ></span
                >
                <span class="switch"
                  ><input type="checkbox" role="switch" bind:checked={draft[option.key]} /><span
                    aria-hidden="true"
                  ></span></span
                >
              </label>
            {/each}
          {:else if tab === 'Detalhes'}
            <h3>O que o site utiliza</h3>
            <dl>
              <dt>Registo das escolhas</dt>
              <dd>
                O site memoriza a sua decisão neste navegador durante 180 dias, incluindo quando
                recusa todas as opções.
              </dd>
              {#each consentOptions as option}<dt>{option.label}</dt>
                <dd>{option.detail}</dd>{/each}
            </dl>
          {:else}
            <h3>Sobre estas preferências</h3>
            <p>
              Este painel é gerido pela Auto Nunes Martins. As opções aplicam-se ao navegador onde as
              guardar.
            </p>
            <p>
              Para mudar de ideias, abra «Cookies e preferências» na Política de Privacidade. Aí pode
              alterar uma opção ou retirar o consentimento para todas.
            </p>
            <a href="/politica-de-privacidade#preferencias" onclick={() => dialog.close()}
              >Consultar a Política de Privacidade</a
            >
          {/if}
        </div>
      {/each}
    </div>
    <footer>
      <button class="secondary" onclick={() => save(essentialOnly)}>Recusar</button>
      <button class="primary" onclick={() => save(draft)}>Guardar escolhas</button>
    </footer>
  {/if}
</dialog>

<style lang="postcss">
  @import './consentPanel.css';
</style>
