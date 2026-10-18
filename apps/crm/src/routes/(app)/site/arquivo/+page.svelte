<script lang="ts">
  import { enhance } from '$app/forms';
  import { crmPath } from '$lib/paths';
  let { data, form } = $props();
  let busy = $state(false);
</script>

<svelte:head><title>Arquivo público — Auto Nunes Martins</title></svelte:head>
<section class="py-8 space-y-6">
  <div>
    <h1 class="text-2xl font-semibold">Arquivo público</h1>
    <p class="mt-2 text-muted-foreground">
      Quando uma viatura sai do catálogo, o endereço antigo pode mostrar apenas marca, modelo, ano e
      uma fotografia aprovada, com a indicação de indisponibilidade.
    </p>
    <p class="mt-2 text-sm text-muted-foreground">
      Estas autorizações são independentes do anúncio ativo. Retirar a identificação esconde todo o
      arquivo; retirar a fotografia apaga a cópia do arquivo. Só uma ficha atualmente publicada
      permite uma nova autorização. Eliminar a ficha do CRM conserva o arquivo permitido.
    </p>
    <a class="inline-block mt-3 underline" href={crmPath('/site/destaques')}>Destaques do site</a>
  </div>
  {#if form?.error}<p role="alert" class="text-red-600">{form.error}</p>{:else if form?.saved}<p
      role="status"
    >
      Autorização atualizada.
    </p>{/if}
  <form method="GET" class="flex gap-3">
    <label class="flex-1"
      >Pesquisar marca, modelo ou endereço<input
        class="block w-full rounded border p-2 mt-1"
        type="search"
        name="q"
        value={data.q}
        maxlength="200"
      /></label
    ><button class="self-end rounded border px-4 py-2">Pesquisar</button>
  </form>
  {#if !data.items.length}<p>Não há registos para esta pesquisa.</p>{/if}
  {#each data.items as item (item.slug)}
    <article class="rounded-xl border p-5 space-y-3">
      <h2 class="font-semibold">{item.brand} {item.model} · {item.year}</h2>
      <p class="text-sm break-all">/viaturas/{item.slug}</p>
      <p>
        Identificação: {item.identificationAllowed ? 'autorizada' : 'retirada'} · Fotografia: {item.hasPhoto
          ? 'autorizada'
          : item.photoAllowed
            ? 'sem fotografia'
            : 'retirada'}
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
            class="rounded border px-3 py-2"
            name="action"
            value="withdraw"
            disabled={busy}>Retirar identificação e fotografia</button
          >{/if}
        {#if item.hasPhoto}<button
            class="rounded border px-3 py-2"
            name="action"
            value="withdraw-photo"
            disabled={busy}>Retirar fotografia</button
          >{/if}
        {#if item.canAuthorize && (!item.identificationAllowed || !item.photoAllowed)}<button
            class="rounded border px-3 py-2"
            name="action"
            value="authorize-current"
            disabled={busy}>Autorizar a partir da ficha publicada</button
          >{/if}
      </form>
    </article>
  {/each}
  {#if data.truncated}<p>
      São apresentados os primeiros 200 registos. Refine a pesquisa para encontrar outro endereço.
    </p>{/if}
</section>
