<script lang="ts">
  import { vehicleBrands, searchVehicleBrands, registeredBrand } from '@anm/types';
  import { brandLogo } from '$lib/brandLogos';
  import { tick } from 'svelte';
  let { value = $bindable(''), name = 'brand' }: { value?: string; name?: string } = $props();
  const id = $props.id();
  let query = $state('');
  let open = $state(false);
  let active = $state(0);
  let input: HTMLInputElement;
  let root: HTMLDivElement;
  let broken = $state<string[]>([]);
  const selected = $derived(registeredBrand(value));
  const results = $derived(searchVehicleBrands(query));
  $effect(() => {
    if (!open) query = selected?.name ?? value;
  });
  $effect(() => {
    input?.setCustomValidity(selected ? '' : 'Selecione uma marca registada na lista.');
  });
  async function choose(brand: (typeof vehicleBrands)[number]) {
    value = brand.name;
    query = brand.name;
    open = false;
    active = 0;
    await tick();
    root.querySelector('input[type=hidden]')!.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    input.focus();
  }
  function keydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      open = false;
      return;
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!open) {
        query = '';
        open = true;
      } else
        active =
          (active + (e.key === 'ArrowDown' ? 1 : -1) + results.length) %
          Math.max(results.length, 1);
      void tick().then(() =>
        root.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' }),
      );
    }
    if (e.key === 'Enter' && open) {
      e.preventDefault();
      if (results[active]) void choose(results[active]!);
    }
  }
</script>

<div
  class="brand-picker"
  bind:this={root}
  onfocusout={(e) => {
    if (!root.contains(e.relatedTarget as Node)) open = false;
  }}
>
  <input type="hidden" {name} value={selected?.name ?? ''} />
  <div class="brand-control">
    {#if selected?.logo && brandLogo(selected.logo) && !broken.includes(selected.logo)}
      <img
        src={brandLogo(selected.logo)}
        alt=""
        onerror={() => (broken = [...broken, selected!.logo!])}
      />
    {/if}
    <input
      bind:this={input}
      {id}
      data-error-field={name}
      type="text"
      role="combobox"
      aria-label="Marca"
      aria-expanded={open}
      aria-controls={id + '-list'}
      aria-autocomplete="list"
      aria-activedescendant={open && results[active] ? id + '-' + results[active]!.key : undefined}
      autocomplete="off"
      required
      value={query}
      placeholder="Pesquisar marca…"
      onkeydown={keydown}
      oninput={(e) => {
        query = e.currentTarget.value;
        value = '';
        open = true;
        active = 0;
      }}
      onclick={() => {
        if (!open) {
          query = '';
          open = true;
          active = 0;
        }
      }}
    />
    <button
      type="button"
      aria-label="Abrir lista de marcas"
      onclick={() => {
        query = '';
        open = !open;
        input.focus();
      }}>⌄</button
    >
  </div>
  {#if value && !selected}<p class="legacy" role="status">
      Marca antiga: {value}. Selecione uma marca da lista para guardar.
    </p>{/if}
  {#if open}
    <div class="brand-list" id={id + '-list'} role="listbox" aria-label="Marcas registadas">
      {#each results as brand, i (brand.key)}
        <button
          type="button"
          role="option"
          id={id + '-' + brand.key}
          aria-selected={active === i}
          onpointerdown={(e) => e.preventDefault()}
          onclick={() => choose(brand)}
        >
          <span class="logo"
            >{#if brand.logo && brandLogo(brand.logo) && !broken.includes(brand.logo)}<img
                src={brandLogo(brand.logo)}
                alt=""
                onerror={() => (broken = [...broken, brand.logo!])}
              />{:else}<span aria-hidden="true">{brand.name.slice(0, 2).toUpperCase()}</span
              >{/if}</span
          >
          {brand.name}
        </button>
      {:else}<p role="status">Nenhuma marca encontrada. Escolha uma marca registada.</p>{/each}
    </div>
  {/if}
</div>

<style>
  .brand-picker {
    position: relative;
    min-width: 0;
    width: 100%;
    font-size: 14px;
  }
  .brand-control {
    display: flex;
    align-items: center;
    height: 44px;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-btn);
    background: var(--color-bg-elevated);
  }
  .brand-control:focus-within {
    border-color: var(--color-red);
    outline: 2px solid color-mix(in oklab, var(--color-red) 12%, transparent);
  }
  .brand-control input {
    width: 100%;
    min-width: 0;
    background: transparent;
    border: 0;
    outline: 0;
    padding: 10px 12px;
    color: inherit;
    font: inherit;
  }
  .brand-control button {
    padding: 10px;
    border: 0;
    background: transparent;
    color: inherit;
    cursor: pointer;
  }
  img {
    width: 30px;
    height: 26px;
    object-fit: contain;
    filter: grayscale(1);
    flex-shrink: 0;
  }
  .brand-control > img {
    margin-left: 10px;
  }
  :global([data-theme='dark']) img {
    filter: grayscale(1) invert(1);
  }
  .brand-list {
    position: absolute;
    top: calc(100% + 5px);
    left: 0;
    width: max(100%, 240px);
    max-width: calc(100vw - 48px);
    max-height: 280px;
    overflow: auto;
    z-index: 40;
    background: var(--color-bg-elevated, #fff);
    border: 1px solid var(--color-border);
    border-radius: 8px;
    box-shadow: 0 12px 32px #0003;
    padding: 4px;
  }
  .brand-list button {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 12px;
    min-height: 44px;
    padding: 8px 12px;
    text-align: left;
    border: 0;
    background: transparent;
    color: inherit;
    cursor: pointer;
    font: inherit;
  }
  .brand-list button:hover,
  .brand-list button[aria-selected='true'] {
    background: color-mix(in oklab, var(--color-red) 12%, transparent);
  }
  .logo {
    width: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 11px;
    color: var(--color-text-muted);
  }
  .legacy,
  .brand-list p {
    font-size: 12px;
    padding: 8px;
    color: var(--color-text-muted);
  }
</style>
