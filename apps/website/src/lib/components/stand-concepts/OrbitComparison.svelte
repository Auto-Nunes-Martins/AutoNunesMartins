<script lang="ts">
  import OrbitBackLink from './OrbitBackLink.svelte';
 import {sizedPhoto,vehiclePhotoSet} from "$lib/vehiclePhotoSources";
  import { createThumbnailSession, publicThumbnail, thumbnailAttrs } from '$lib/publicThumbnail';
  import { catalogPlaceholder } from '$lib/localAssets';
  import { page } from '$app/stores';
  import SocialMetadata from '$lib/components/SocialMetadata.svelte';
  import { onMount, tick, untrack } from 'svelte';
  import { ArrowUpRight, Plus, X, RotateCcw } from 'lucide-svelte';
  import { useComparison, comparisonRows } from '$lib/comparison';
  import { publicHref, publicPhoto, publicPrice } from '$lib/publicVehicles';
  import { loadSelectedVehicles, type SelectedVehicle as Entry } from '$lib/selectedVehicles';
  const comparison = useComparison();
  const { ids, ready } = comparison;
  let entries = $state<Entry[]>([]);
  let loading = $state(false);
  let reload = $state(0);
  let heading: HTMLHeadingElement;
  let compact = $state(false);
  let announcement = $state('');
  let loadedReload = -1;
  let pair = $state('0-1');
  const pairs = [[0, 1], [0, 2], [1, 2]] as const;
  const visible = $derived(compact && entries.length === 3
    ? pair.split('-').map(index => entries[Number(index)]!).filter(Boolean)
    : entries);
  const facts = comparisonRows.filter(row => row.label !== 'Preço');
  const middleLabels = $derived(!compact && visible.length > 1);
  const sessions = new WeakMap<Entry, ReturnType<typeof createThumbnailSession>>();
  const imageSessions = $derived(new Map(entries.filter(entry => entry.vehicle).map(entry => {
    let session = sessions.get(entry);
    if (!session) { session = createThumbnailSession(entry.id, entry.photoVersions); sessions.set(entry, session); }
    return [entry.id, session];
  })));
  onMount(() => {
    const media = matchMedia('(max-width: 700px)');
    const update = () => { compact = media.matches; };
    update(); media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  });
  const name = (entry: Entry) => entry.vehicle ? `${entry.vehicle.brand} ${entry.vehicle.model}` : 'Viatura indisponível';
  $effect(() => {
    const selected = [...$ids];
    const requestedReload = reload;
    if (!$ready || !selected.length) { entries = []; loading = false; return; }
    const controller = new AbortController();
    const current = untrack(() => entries);
    if (loadedReload === requestedReload && selected.every(id => current.some(entry => entry.id === id))) {
      entries = current.filter(entry => selected.includes(entry.id));
      return;
    }
    entries = [];
    loading = true;
    void (async () => {
      try {
        const fresh = await loadSelectedVehicles(selected, controller.signal);
        if (!controller.signal.aborted) { entries = fresh; loadedReload = requestedReload; }
      } catch {
        if (!controller.signal.aborted) entries = selected.map(id => ({ id, status: 503, vehicle: null }));
      } finally { if (!controller.signal.aborted) loading = false; }
    })();
    return () => controller.abort();
  });
  async function remove(entry?: Entry) {
    if (entry) comparison.remove(entry.id, name(entry));
    else comparison.clear();
    announcement = entry ? `${name(entry)} removido da comparação. ${$ids.length} ${$ids.length === 1 ? 'viatura selecionada' : 'viaturas selecionadas'}.` : 'Seleção de comparação limpa.';
    await tick();
    heading?.focus({ preventScroll: true });
  }
</script>

<SocialMetadata title="Comparar viaturas — Auto Nunes Martins" description="Compare até três viaturas lado a lado: preço, quilometragem e características publicadas." canonical={new URL('/comparar', $page.url.origin).href} />

<svelte:head>
  <link rel="canonical" href={new URL('/comparar', $page.url.origin).href} />
  <title>Comparar viaturas — Auto Nunes Martins</title>
  <meta name="description" content="Compare até três viaturas lado a lado: preço, quilometragem e características publicadas." />
  <meta name="robots" content="noindex, follow" />
</svelte:head>

<main class="comparison-page">
  <nav class="back-nav" aria-label="Voltar"><OrbitBackLink /></nav>
  <header class="page-heading">
    <h1 bind:this={heading} tabindex="-1">Comparar viaturas<span>.</span></h1>
    {#if $ready && $ids.length}
      <div class="selection-toolbar"><p class="selection-count">{$ids.length} de 3 viaturas</p>
      <div class="actions">
        <a class="add" href="/viaturas">{#if $ids.length < 3}<Plus size={17} aria-hidden="true" /> Adicionar viatura{:else}Ver catálogo <ArrowUpRight size={17} aria-hidden="true" />{/if}</a>
        <button class="clear" type="button" onclick={() => remove()}><RotateCcw size={15} aria-hidden="true" /> Limpar seleção</button>
      </div></div>
    {/if}
  </header>

  {#if !$ready || loading}
    <p role="status" class="loading">A carregar as viaturas…</p>
  {:else if !$ids.length}
    <section class="empty" aria-labelledby="empty-title">
      <div class="empty-slots" aria-hidden="true"><span>01</span><span>02</span><span>03</span></div>
      <h2 id="empty-title">Quais são as suas opções?</h2>
      <p>Escolha até três viaturas e veja os detalhes lado a lado.</p>
      <a class="primary" href="/viaturas">Escolher viaturas <ArrowUpRight size={18} aria-hidden="true" /></a>
    </section>
  {:else}
    {#if entries.some(entry => entry.status === 503)}
      <div class="retry" role="status"><p>Alguns dados estão temporariamente indisponíveis.</p><button type="button" onclick={() => reload += 1}><RotateCcw size={16} aria-hidden="true" /> Tentar novamente</button></div>
    {/if}
    {#if compact && entries.length === 3}
      <div class="pair-picker">
        <label for="comparison-pair">Comparar lado a lado</label>
        <select id="comparison-pair" bind:value={pair}>
          {#each pairs as indexes}
            <option value={indexes.join('-')}>{name(entries[indexes[0]]!)} + {name(entries[indexes[1]]!)}</option>
          {/each}
        </select>
      </div>
    {/if}
    <div class="comparison-board" class:single={visible.length === 1} class:pair={visible.length === 2} class:triple={visible.length === 3}>
      <table>
        <caption class="sr-only">Comparação de {visible.map(name).join(' e ')}</caption>
        <colgroup>{#each visible as entry, column}<col />{#if middleLabels && column === 0}<col class="attribute-column" />{/if}{/each}</colgroup>
        <thead>
          <tr class="photo-row">
            {#each visible as entry, column (entry.id)}
              <td>
                <div class="vehicle-photo">
                  {#if entry.vehicle}
                    {@const session = imageSessions.get(entry.id)!}
                    {@const src = entry.vehicle.photos.length ? sizedPhoto(publicPhoto(entry.id, 0),800) : catalogPlaceholder}
                    {@const srcset = entry.vehicle.photos.length ? vehiclePhotoSet(publicPhoto(entry.id,0)) : undefined}
                    <a href={publicHref(entry.id)} aria-label={`Ver ${name(entry)}`}><img {...thumbnailAttrs(session,src,srcset)} use:publicThumbnail={{session,index:0,src,srcset,sizes:'(max-width:700px) 90vw, 560px'}} sizes="(max-width:700px) 90vw, 560px" alt={entry.vehicle.photos.length ? name(entry) : `Fotografia indisponível: ${name(entry)}`} width="480" height="320" /></a>
                  {:else}<div class="missing-photo"><img src={catalogPlaceholder} alt="Fotografia indisponível" width="480" height="320" /></div>{/if}
                  <button class="remove" type="button" aria-label={`Remover ${name(entry)} da comparação`} onclick={() => remove(entry)}><X size={18} aria-hidden="true" /></button>
                </div>
              </td>
              {#if middleLabels && column === 0}<td class="attribute-space" aria-hidden="true"></td>{/if}
            {/each}
          </tr>
          <tr class="summary-row">
            {#each visible as entry, column (entry.id)}
              <th scope="col" id={`vehicle-${entry.id}`}>
                {#if entry.vehicle}
                  <span class="brand">{entry.vehicle.brand}</span>
                  <h2><a href={publicHref(entry.id)}>{entry.vehicle.model}</a></h2>
                  <strong class="price">{entry.vehicle.price === null ? 'Preço não indicado' : publicPrice(entry.vehicle.price)}</strong>
                  <a class="detail-link" href={publicHref(entry.id)}>Ver viatura <ArrowUpRight size={16} aria-hidden="true" /></a>
                {:else}
                  <h2>{entry.status === 404 ? 'Já não disponível' : 'Dados por atualizar'}</h2>
                  <p class="unavailable">{entry.status === 404 ? 'Esta viatura deixou de estar publicada.' : 'Tente novamente dentro de instantes.'}</p>
                {/if}
              </th>
              {#if middleLabels && column === 0}<td class="attribute-space" aria-hidden="true"></td>{/if}
            {/each}
          </tr>
        </thead>
        {#each facts as row, index}
          <tbody class="fact-group">
            {#if middleLabels}
            <tr class="aligned-fact">{#each visible as entry, column (entry.id)}
              <td class="fact-value" class:missing={!entry.vehicle || row.value(entry.vehicle) === 'Não indicado'} headers={`vehicle-${entry.id} fact-${index}`}>{entry.vehicle ? row.value(entry.vehicle) : 'Indisponível'}</td>
              {#if column === 0}<th class="fact-label" scope="row" id={`fact-${index}`}><span>{row.label}</span></th>{/if}
            {/each}</tr>
            {:else}
            <tr><th class="fact-label" id={`fact-${index}`} colspan={visible.length}><span>{row.label}</span></th></tr>
            <tr>
              {#each visible as entry (entry.id)}
                <td class="fact-value" class:missing={!entry.vehicle || row.value(entry.vehicle) === 'Não indicado'} headers={`vehicle-${entry.id} fact-${index}`}>{entry.vehicle ? row.value(entry.vehicle) : 'Indisponível'}</td>
              {/each}
            </tr>
            {/if}
          </tbody>
        {/each}
      </table>
      {#if visible.length === 1}
        <a class="second-option" href="/viaturas"><Plus size={26} strokeWidth={1.3} aria-hidden="true" /><span>Adicionar outra viatura</span></a>
      {/if}
    </div>
    <p class="data-note">“Não indicado”: informação não publicada na ficha.</p>
  {/if}
  <p class="storage-note">As suas escolhas ficam guardadas neste navegador, sem criar conta. Pode removê-las a qualquer momento. <a href="/politica-de-privacidade#escolhas">Política de privacidade</a></p>
  <p class="sr-only" role="status" aria-live="polite" aria-atomic="true">{announcement}</p>
</main>

<style>
  .comparison-page { width: var(--orbit-frame); max-width: var(--orbit-frame-max); margin: auto; padding: var(--orbit-space-page-start) 0 88px; color: var(--text); }
  a { color: inherit; text-decoration: none; }
  button, select { font: inherit; color: inherit; }
  button { cursor: pointer; }
  a:focus-visible, button:focus-visible, select:focus-visible { outline: 2px solid var(--red); outline-offset: 4px; }
  h1:focus { outline: none; }
  .back-nav {display:block;}
  .page-heading { display:block; margin:16px 0 36px; max-width:1200px; }
  .selection-toolbar {display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-top:22px;}
  .selection-count {margin:0;color:var(--muted);font-size:13px;}
  h1 { font-size: clamp(34px, 3.5vw, 48px); font-weight: 500; letter-spacing: -.055em; line-height: 1.06; margin: 0; }
  h1 > span { color: var(--red); }
  .actions { display:flex;align-items:center;gap:16px;flex-wrap:wrap; }
  .add, .primary { display:inline-flex;align-items:center;justify-content:center;gap:12px;min-height:46px;padding:11px 20px;border-radius:30px;font-size:14px; }
  .add {border:1px solid var(--line);background:transparent;color:var(--text);}
  .primary {background:var(--text);color:var(--bg);}
  .clear { display:inline-flex;align-items:center;gap:8px;border:0;background:none;min-height:44px;padding:8px 0;font-size:13px;color:var(--muted); }
  .clear:hover { color: var(--text); }
  .comparison-board { position: relative; max-width:1200px; margin-inline:0; }
  table { width: calc(100% + 32px); margin-inline: -16px; border-collapse: separate; border-spacing: 0; table-layout: fixed; }
  .attribute-column {width:144px;}
  td, th { min-width: 0; text-align: left; vertical-align: top; font-weight: 400; }
  .photo-row td, .summary-row th, .fact-value { padding-inline: 16px; }
  .vehicle-photo { position: relative; overflow: hidden; border-radius: 5px; background: var(--surface); }
  .vehicle-photo a { display: block; }
  .vehicle-photo img { display: block; width: 100%; height: clamp(150px,12vw,210px); object-fit: cover; }
  .remove { position: absolute; top: 12px; right: 12px; width: 44px; height: 44px; border: 1px solid var(--line); background: var(--bg); color: var(--text); display: grid; place-items: center; border-radius: 50%; }
  .summary-row th { padding-block: 14px 18px; position: sticky; top:var(--nav-visible-height,80px); z-index: 2; background: var(--bg); border-bottom: 1px solid var(--line); }
  .summary-row .attribute-space {position:sticky;top:var(--nav-visible-height,80px);z-index:2;background:var(--bg);border-bottom:1px solid var(--line);}
  .brand { display: block; color: var(--muted); font-size: 12px; margin-bottom: 4px; }
  h2 { margin: 0; font-size: clamp(21px, 2vw, 28px); line-height: 1.15; font-weight: 500; letter-spacing: -.045em; overflow-wrap: anywhere; }
  .summary-row h2 { min-height: 2.3em; }
  .price { display: block; margin-top: 10px; font-size: clamp(20px, 1.7vw, 24px); font-weight: 500; letter-spacing: -.035em; }
  .detail-link { display: inline-flex; align-items: center; gap: 12px; font-size: 13px; min-height: 44px; margin-top: 4px; }
  .fact-label {padding:12px 16px 8px;color:var(--muted);font-size:12px;line-height:1.5;text-align:left;}
  .aligned-fact .fact-label {padding:14px 12px;vertical-align:middle;border-bottom:1px solid var(--line);}
  .fact-value { padding-block:14px; border-bottom: 1px solid var(--line); font-size: 16px; line-height: 1.45; text-align: left; vertical-align:middle; font-variant-numeric:tabular-nums; overflow-wrap: anywhere; }
  .fact-value + .fact-value { border-left: 1px solid var(--line); }
  .fact-value.missing { color: var(--muted); font-size: 15px; }
  :global(html[data-theme='light']) .fact-group .fact-value,
  :global(html[data-theme='light']) .aligned-fact .fact-label {background:var(--orbit-gray-surface);}
  .single { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; }
  .second-option { align-self: start; display: flex; flex-direction: column; align-items: flex-start; justify-content: center; gap: 16px; padding:20px; box-sizing:border-box; height:clamp(150px,12vw,210px); min-height:150px; border: 1px dashed var(--line); border-radius: 5px; color: var(--muted); font-size: 14px; }
  .second-option :global(svg) { color: var(--red); }
  .pair-picker { display: grid; gap: 8px; margin-bottom: 22px; }
  .pair-picker label { color: var(--muted); font-size: 14px; }
  .pair-picker select { width: 100%; min-width: 0; min-height: 46px; padding: 10px 32px 10px 12px; border: 1px solid var(--line); border-radius: 4px; background: var(--bg); font-size: 14px; text-overflow: ellipsis; }
  .empty { padding: 44px 0 54px; border-top: 1px solid var(--line); }
  .empty-slots { display: flex; gap: 14px; margin-bottom: 32px; }
  .empty-slots span { display: grid; place-items: center; width: 76px; height: 58px; border: 1px solid var(--line); border-radius: 4px; color: var(--muted); font-size: 20px; font-variant-numeric: tabular-nums; }
  .empty-slots span:first-child { border-color: var(--red); color: var(--red); }
  .empty h2 { font-size: clamp(28px, 3vw, 42px); }
  .empty p { color: var(--muted); line-height: 1.7; font-size: 16px; margin: 18px 0 28px; }
  .loading { padding: 60px 0; border-block: 1px solid var(--line); font-size: 16px; color: var(--muted); }
  .retry { display: flex; align-items: center; flex-wrap: wrap; gap: 12px 24px; margin-bottom: 26px; font-size: 14px; }
  .retry p { margin: 0; color: var(--muted); }
  .retry button { display: inline-flex; align-items: center; gap: 8px; min-height: 44px; border: 0; background: none; text-decoration: underline; text-underline-offset: 4px; }
  .unavailable { color: var(--muted); font-size: 15px; line-height: 1.6; }
  .data-note, .storage-note { color: var(--muted); line-height: 1.7; font-size: 13px; margin: 24px 0 0; max-width: 82ch; }
  .storage-note { margin-top: 36px; }
  .storage-note a { text-decoration: underline; text-underline-offset: 3px; }
  .sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }
  @media (hover: hover) { .add:hover, .primary:hover { background: var(--red); color: white; } .detail-link:hover { text-decoration: underline; text-underline-offset: 4px; } .remove:hover { background: var(--text); color: var(--bg); } }
  @media (prefers-reduced-motion: no-preference) { .add, .primary, .remove { transition: background-color 180ms ease, color 180ms ease; } }
  @media (max-width: 700px) {
    .comparison-page { padding: 32px 0 64px; }
    .page-heading {margin:12px 0 30px;}
    .selection-toolbar {margin-top:18px;gap:12px;}
    h1 { font-size: clamp(34px, 8.5vw, 44px); }
    .actions {width:100%;justify-content:flex-start;gap:18px;}
    .add { min-height: 44px; padding: 10px 18px; }
    .photo-row td, .summary-row th, .fact-value { padding-inline: 8px; }
    table { width: calc(100% + 16px); margin-inline: -8px; }
    .vehicle-photo { border-radius: 3px; }
    .remove { top: 5px; right: 5px; width: 36px; height: 36px; }
    .remove::before { content: ''; position: absolute; inset: -4px; }
    .vehicle-photo img {height:clamp(100px,28vw,150px);}
    .summary-row th { padding-block: 12px 14px; }
    .brand { font-size: 13px; margin-bottom: 6px; }
    h2 { font-size: clamp(18px, 4.8vw, 23px); line-height: 1.15; }
    .price { font-size: clamp(18px, 4.8vw, 23px); margin-top: 8px; }
    .detail-link { gap: 8px; font-size: 13px; margin-top: 4px; }
    .fact-label {font-size:12px;padding-block:14px 9px;}
    .single .fact-label {padding-inline:8px;}
    .pair .fact-label {padding-left:calc(50% - 60px);}
    .fact-value {font-size:15px;padding-block:12px;line-height:1.45;}
    .fact-value.missing { font-size: 14px; }
    .single { display: flex; flex-direction: column; gap: 24px; }
    .single table { max-width: none; }
    .single .vehicle-photo { max-width: 440px; }
    .single .second-option { order: -1; flex-direction: row; align-items:center; justify-content:flex-start; padding:12px 16px; height:auto; min-height: 52px; width: 100%; font-size: 14px; gap: 12px; }
    .empty { padding-block: 24px 36px; }
    .empty h2 { font-size: 28px; }
    .data-note, .storage-note { font-size: 13px; }
  }
</style>
