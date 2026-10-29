<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { ChevronDown, ChevronUp } from 'lucide-svelte';
  import RichDescription from '../../../../../shared/ui/RichDescription.svelte';
  let { value }: { value: string | null | undefined } = $props();
  let viewport: HTMLDivElement;
  let content: HTMLDivElement;
  let toggle = $state<HTMLButtonElement>();
  let expanded = $state(false);
  let animating = $state(false);
  let overflowing = $state(false);
  let limit = $state(405);
  let measure: (() => void) | undefined;
  let transition: Animation | undefined;
  let change = 0;
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
    const end = content.getBoundingClientRect().top + limit - 56;
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
        Number(getComputedStyle(viewport).getPropertyValue('--description-lines')) || 15;
      const rich = content.firstElementChild ?? content;
      const lineHeight = parseFloat(getComputedStyle(rich).lineHeight) || 27;
      limit = lines * lineHeight;
      overflowing = content.scrollHeight > limit + 2;
      accessibleLinks();
    };
    const observer = new ResizeObserver(() => measure?.());
    observer.observe(content);
    const narrow = matchMedia('(max-width: 700px)');
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const resize = () => measure?.();
    const motionChanged = () => {
      if (reduced.matches) transition?.finish();
    };
    narrow.addEventListener('change', resize);
    reduced.addEventListener('change', motionChanged);
    measure();
    void document.fonts?.ready.then(() => {
      if (alive) measure?.();
    });
    return () => {
      alive = false;
      observer.disconnect();
      narrow.removeEventListener('change', resize);
      reduced.removeEventListener('change', motionChanged);
      change++;
      transition?.cancel();
      restoreLinks();
      measure = undefined;
    };
  });
  $effect(() => {
    value;
    change++;
    transition?.cancel();
    transition = undefined;
    animating = false;
    expanded = false;
    void tick().then(() => measure?.());
  });
  async function toggleDescription() {
    const version = ++change;
    const from = viewport.getBoundingClientRect().height;
    transition?.cancel();
    transition = undefined;
    const collapsing = expanded;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    animating = !reduced;
    expanded = !expanded;
    await tick();
    if (version !== change) return;
    accessibleLinks();
    if (!reduced) {
      const to = expanded ? content.scrollHeight : limit;
      const next = viewport.animate([{ height: `${from}px` }, { height: `${to}px` }], {
        duration: 360,
        easing: 'cubic-bezier(0.2, 0.65, 0.3, 1)',
      });
      transition = next;
      await next.finished.catch(() => {});
      if (version !== change) return;
      transition = undefined;
    }
    animating = false;
    if (collapsing)
      toggle?.scrollIntoView({ block: 'nearest', behavior: reduced ? 'instant' : 'smooth' });
  }
</script>

<div
  class="description-window"
  class:collapsed={overflowing && !expanded}
  class:animating
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
    --description-lines: 15;
  }
  .description-window.collapsed {
    height: var(--description-limit);
    mask-image: linear-gradient(#000 calc(100% - 56px), transparent);
  }
  .description-window.collapsed,
  .description-window.animating {
    overflow: hidden;
  }
  .description-content {
    display: flow-root;
  }
  .description-toggle {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    min-height: 44px;
    margin-top: 16px;
    padding: 10px 0;
    border: 0;
    border-bottom: 1px solid var(--line);
    background: transparent;
    color: var(--text);
    font: inherit;
    font-size: 13px;
    cursor: pointer;
  }
  .description-toggle::after {
    content: '';
    position: absolute;
    inset: auto 0 -1px;
    height: 1px;
    background: var(--red);
    clip-path: inset(0 100% 0 0);
    transition: clip-path 420ms ease;
    pointer-events: none;
  }
  .description-toggle :global(svg) {
    transition: transform 220ms ease;
  }
  .description-toggle:focus-visible::after {
    clip-path: inset(0);
  }
  @media (hover: hover) {
    .description-toggle:hover::after {
      clip-path: inset(0);
    }
    .description-toggle:hover :global(svg) {
      transform: translateY(2px);
    }
    .description-toggle[aria-expanded='true']:hover :global(svg) {
      transform: translateY(-2px);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .description-toggle::after,
    .description-toggle :global(svg),
    .description-toggle:hover :global(svg),
    .description-toggle[aria-expanded='true']:hover :global(svg) {
      transition: none;
      transform: none;
    }
  }
  .description-toggle:focus-visible {
    outline: 2px solid var(--red);
    outline-offset: 4px;
  }
  @media (max-width: 700px) {
    .description-window {
      --description-lines: 10;
    }
  }
</style>
