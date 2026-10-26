<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { ChevronDown, ChevronUp } from 'lucide-svelte';
  import RichDescription from '../../../../../shared/ui/RichDescription.svelte';
  let { value }: { value: string | null | undefined } = $props();
  let viewport: HTMLDivElement;
  let content: HTMLDivElement;
  let toggle = $state<HTMLButtonElement>();
  let expanded = $state(false);
  let overflowing = $state(false);
  let limit = $state(810);
  let measure: (() => void) | undefined;
  const hiddenLinks = new Map<HTMLElement, string | null>();
  function restoreLinks() {
    for (const [link, tabIndex] of hiddenLinks) {
      if (tabIndex === null) link.removeAttribute('tabindex');
      else link.setAttribute('tabindex', tabIndex);
    }
    hiddenLinks.clear();
  }
  function accessibleLinks() {
    restoreLinks();
    if (!overflowing || expanded) return;
    const end = content.getBoundingClientRect().top + limit;
    for (const link of content.querySelectorAll<HTMLElement>('a[href]')) {
      if (link.getBoundingClientRect().bottom > end) {
        hiddenLinks.set(link, link.getAttribute('tabindex'));
        link.tabIndex = -1;
      }
    }
  }
  onMount(() => {
    let alive = true;
    measure = () => {
      const lines =
        Number(getComputedStyle(viewport).getPropertyValue('--description-lines')) || 30;
      const rich = content.firstElementChild ?? content;
      const lineHeight = parseFloat(getComputedStyle(rich).lineHeight) || 27;
      limit = lines * lineHeight;
      overflowing = content.scrollHeight > limit + 2;
      accessibleLinks();
    };
    const observer = new ResizeObserver(() => measure?.());
    observer.observe(content);
    observer.observe(viewport);
    measure();
    void document.fonts?.ready.then(() => {
      if (alive) measure?.();
    });
    return () => {
      alive = false;
      observer.disconnect();
      restoreLinks();
      measure = undefined;
    };
  });
  $effect(() => {
    value;
    expanded = false;
    void tick().then(() => measure?.());
  });
  async function toggleDescription() {
    const collapsing = expanded;
    expanded = !expanded;
    await tick();
    accessibleLinks();
    if (collapsing) toggle?.scrollIntoView({ block: 'nearest', behavior: 'instant' });
  }
</script>

<div
  class="description-window"
  class:collapsed={overflowing && !expanded}
  bind:this={viewport}
  style:--description-limit={`${limit}px`}
  id="vehicle-description-content"
>
  <div class="description-content" bind:this={content}><RichDescription {value} /></div>
</div>
{#if overflowing}
  <button
    class="description-toggle"
    type="button"
    bind:this={toggle}
    aria-expanded={expanded}
    aria-controls="vehicle-description-content"
    onclick={toggleDescription}
  >
    {expanded ? 'Recolher descrição' : 'Expandir descrição'}
    {#if expanded}<ChevronUp size={16} aria-hidden="true" />{:else}<ChevronDown
        size={16}
        aria-hidden="true"
      />{/if}
  </button>
{/if}

<style>
  .description-window {
    --description-lines: 30;
  }
  .description-window.collapsed {
    max-height: var(--description-limit);
    overflow: hidden;
  }
  .description-content {
    display: flow-root;
  }
  .description-toggle {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    min-height: 44px;
    margin-top: 16px;
    padding: 10px 0;
    border: 0;
    background: transparent;
    color: var(--text);
    font: inherit;
    font-size: 13px;
    cursor: pointer;
    text-decoration: underline;
    text-underline-offset: 5px;
    text-decoration-color: var(--red);
  }
  .description-toggle:focus-visible {
    outline: 2px solid var(--red);
    outline-offset: 4px;
  }
  @media (max-width: 700px) {
    .description-window {
      --description-lines: 20;
    }
  }
</style>
