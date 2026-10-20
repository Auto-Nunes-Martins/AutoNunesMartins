<script lang="ts">
  import { enhance } from '$app/forms';
  import { crmPath } from '$lib/paths';
  import { Archive, Search } from 'lucide-svelte';
  import ItalicHero from '$lib/components/brand/ItalicHero.svelte';
  import Panel from '$lib/components/common/Panel.svelte';
  import EmptyState from '$lib/components/common/EmptyState.svelte';
  let { data, form } = $props();
  let busy = $state(false);
</script>

<svelte:head><title>Arquivo público — Auto Nunes Martins</title></svelte:head>
<section class="list-frame pt-8 pb-12 space-y-6">
  <div>
    <ItalicHero text="Arquivo público" size="lg" />
    <p class="mt-3 text-[13px] text-[var(--color-text-muted)] max-w-4xl">
      Quando uma viatura sai do catálogo, o endereço antigo pode mostrar apenas marca, modelo, ano e
      uma fotografia aprovada, com a indicação de indisponibilidade.
    </p>
    <p class="mt-2 text-[12px] text-[var(--color-text-muted)] max-w-4xl">
      Estas autorizações são independentes do anúncio ativo. Retirar a identificação esconde todo o
      arquivo; retirar a fotografia apaga a cópia do arquivo. Só uma ficha atualmente publicada
      permite uma nova autorização. Eliminar a ficha do CRM conserva o arquivo permitido.
    </p>
    <a
      class="inline-flex items-center min-h-10 mt-2 text-[13px] underline underline-offset-4"
      href={crmPath('/site/destaques')}>Destaques do site</a
    >
  </div>
  {#if form?.error}<p role="alert" class="crm-form-error-summary">
      {form.error}
    </p>{:else if form?.saved}<p role="status" class="text-[13px] text-[var(--color-success)]">
      Autorização atualizada.
    </p>{/if}
  <Panel>
    <form method="GET" class="archive-search">
      <label class="min-w-0 flex-1"
        ><span>Pesquisar marca, modelo ou endereço</span><input
          class="archive-input"
          type="search"
          name="q"
          value={data.q}
          maxlength="200"
        /></label
      ><button class="archive-action self-end"><Search size={15} />Pesquisar</button>
    </form>
  </Panel>
  {#if !data.items.length}<Panel
      ><EmptyState
        icon={Archive}
        title="Sem registos no arquivo"
        description={data.q
          ? 'Experimente outra marca, modelo ou endereço.'
          : 'As autorizações de arquivo das viaturas aparecem aqui.'}
      /></Panel
    >{/if}
  {#each data.items as item (item.slug)}
    <Panel
      ><article class="p-5 space-y-3">
        <h2 class="font-display font-semibold text-[19px]">
          {item.brand}
          {item.model} · {item.year}
        </h2>
        <p class="text-[12px] font-mono break-all text-[var(--color-text-muted)]">
          /viaturas/{item.slug}
        </p>
        <p class="archive-status">
          <span
            >Identificação: <strong>{item.identificationAllowed ? 'autorizada' : 'retirada'}</strong
            ></span
          >
          <span
            >Fotografia: <strong
              >{item.hasPhoto
                ? 'autorizada'
                : item.photoAllowed
                  ? 'sem fotografia'
                  : 'retirada'}</strong
            ></span
          >
        </p>
        <form
          method="POST"
          class="flex flex-wrap gap-3"
          use:enhance={() => {
            busy = true;
            return async ({ update }) => {
              try {
                await update();
              } finally {
                busy = false;
              }
            };
          }}
        >
          <input type="hidden" name="slug" value={item.slug} />
          {#if item.identificationAllowed}<button
              class="archive-action"
              name="action"
              value="withdraw"
              disabled={busy}>Retirar identificação e fotografia</button
            >{/if}
          {#if item.hasPhoto}<button
              class="archive-action"
              name="action"
              value="withdraw-photo"
              disabled={busy}>Retirar fotografia</button
            >{/if}
          {#if item.canAuthorize && (!item.identificationAllowed || !item.photoAllowed)}<button
              class="archive-action"
              name="action"
              value="authorize-current"
              disabled={busy}>Autorizar a partir da ficha publicada</button
            >{/if}
        </form>
      </article></Panel
    >
  {/each}
  {#if data.truncated}<p>
      São apresentados os primeiros 200 registos. Refine a pesquisa para encontrar outro endereço.
    </p>{/if}
</section>

<style>
  .archive-search {
    display: flex;
    flex-wrap: wrap;
    align-items: end;
    gap: 12px;
    padding: 16px;
  }
  .archive-search label {
    flex-basis: 240px;
    font-size: 12px;
    color: var(--color-text-muted);
  }
  .archive-input {
    display: block;
    width: 100%;
    height: 42px;
    margin-top: 6px;
    padding: 0 12px;
    border: 1px solid var(--color-border-strong);
    border-radius: var(--radius-btn);
    color: var(--color-text);
    background: var(--color-bg-1);
    font-size: 13px;
  }
  .archive-input:focus {
    outline: 2px solid var(--color-text-muted);
    outline-offset: 2px;
  }
  .archive-action {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    min-height: 42px;
    padding: 8px 14px;
    font-size: 12px;
    border: 1px solid var(--color-border-strong);
    border-radius: var(--radius-btn);
    background: var(--color-bg-2);
    color: var(--color-text);
  }
  .archive-action:hover:not(:disabled) {
    border-color: var(--color-text-muted);
    background: var(--color-bg-3);
  }
  .archive-action:disabled {
    opacity: 0.6;
  }
  .archive-status {
    display: flex;
    flex-wrap: wrap;
    gap: 8px 24px;
    font-size: 12px;
    color: var(--color-text-muted);
  }
  .archive-status strong {
    color: var(--color-text);
    font-weight: 600;
  }
  @media (max-width: 480px) {
    .archive-action {
      min-height: 44px;
    }
  }
</style>
