<script lang="ts">
  import { crmPath } from '$lib/paths';
  import ItalicHero from '$lib/components/brand/ItalicHero.svelte';
  import Panel from '$lib/components/common/Panel.svelte';
  import VehicleForm from '$lib/components/vehicle/VehicleForm.svelte';
  import WebPublicationPanel from '$lib/components/vehicle/WebPublicationPanel.svelte';
  import type { PageData } from './$types';
  let { data }: { data: PageData } = $props();
</script>

<svelte:head>
  <title>Nova Viatura · Auto Nunes Martins</title>
</svelte:head>

<section class="crm-form-page pt-8 pb-12 space-y-6">
  <div>
    <ItalicHero text="Nova" accent=" Viatura" size="lg" />
    <p
      class="mt-2 font-mono text-[11px] uppercase tracking-[0.25em] text-[var(--color-text-muted)]"
    >
      <span class="text-[var(--color-red)]">●</span>
      Adicionar entrada ao inventário
    </p>
  </div>

  <ol class="creation-steps" aria-label="Etapas da criação de viatura">
    <li aria-current={!data.vehicle ? 'step' : undefined}>
      <span>1</span>
      <div><strong>Entrada no stock</strong><small>Identificação, aquisição e valores</small></div>
    </li>
    <li aria-current={data.vehicle ? 'step' : undefined}>
      <span>2</span>
      <div>
        <strong>Fotografias e website</strong><small
          >Prepare a apresentação e escolha se publica</small
        >
      </div>
    </li>
  </ol>
  {#if data.vehicle}
    <p>
      Viatura criada: {data.vehicle.brand}
      {data.vehicle.model}. Adicione fotografias e escolha se pretende publicá-la no website.
    </p>
    <WebPublicationPanel managePhotos vehicle={data.vehicle} photos={data.signedPhotos} />
    <a
      class="inline-flex min-h-11 items-center underline"
      href={crmPath(`/viaturas/${data.vehicle.id}`)}>Concluir e abrir ficha CRM →</a
    >
  {:else}
    <Panel>
      <div class="p-6">
        <VehicleForm submitLabel="Guardar e continuar" />
      </div>
    </Panel>
    <p class="text-sm text-[var(--color-text-muted)]">
      Guardar cria a ficha interna. No passo seguinte pode adicionar fotografias e preparar o
      website; a publicação é opcional e nunca automática.
    </p>
  {/if}
</section>

<style>
  .creation-steps {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 16px;
    list-style: none;
    padding: 0;
  }
  .creation-steps li {
    display: flex;
    align-items: center;
    gap: 12px;
    color: var(--color-text-muted);
    padding-block: 12px;
    border-bottom: 1px solid var(--color-border);
  }
  .creation-steps li > span {
    display: grid;
    place-items: center;
    flex-shrink: 0;
    width: 28px;
    height: 28px;
    border: 1px solid var(--color-border);
    border-radius: 50%;
    font-size: 12px;
  }
  .creation-steps strong {
    display: block;
    font-size: 13px;
    font-weight: 600;
  }
  .creation-steps small {
    display: block;
    margin-top: 3px;
    font-size: 11px;
    line-height: 1.5;
  }
  .creation-steps [aria-current='step'] {
    color: var(--color-text);
    border-color: var(--color-red);
  }
  .creation-steps [aria-current='step'] > span {
    background: var(--color-red);
    color: white;
    border-color: var(--color-red);
  }
  @media (max-width: 480px) {
    .creation-steps {
      gap: 12px;
    }
    .creation-steps li {
      align-items: flex-start;
      gap: 8px;
    }
  }
</style>
