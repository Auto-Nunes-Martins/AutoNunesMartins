<script lang="ts">
  import { descriptionHtml } from '@anm/types/richDescription';
  let { value }: { value: string | null | undefined } = $props();
  const html = $derived(descriptionHtml(value));
</script>

<div class="rich-description">{@html html}</div>

<style>
  .rich-description {
    font-size: 15px;
    line-height: 1.8;
    overflow-wrap: anywhere;
    color: inherit;
  }
  .rich-description :global(p) {
    margin: 0 0 1em;
  }
  .rich-description :global(h3),
  .rich-description :global(h4) {
    font-size: 1.15em;
    font-weight: 600;
    line-height: 1.4;
    margin: 1.4em 0 0.6em;
  }
  .rich-description :global(ul),
  .rich-description :global(ol) {
    padding-left: 1.5em;
    margin: 0.8em 0;
    display: block;
  }
  .rich-description :global(ul) {
    list-style: disc;
  }
  .rich-description :global(ol) {
    list-style: decimal;
  }
  .rich-description :global(li) {
    display: list-item;
    margin: 0.3em 0;
  }
  .rich-description :global(strong) {
    font-weight: 700;
  }
  .rich-description :global(em) {
    font-style: italic;
  }
  .rich-description :global(u) {
    text-decoration: underline;
  }
  .rich-description :global(s) {
    text-decoration: line-through;
  }
  .rich-description :global(blockquote) {
    border-left: 2px solid currentColor;
    padding-left: 1em;
    margin: 1em 0;
  }
  .rich-description :global(a) {
    color: inherit;
    text-decoration: underline;
    text-underline-offset: 3px;
  }
  .rich-description :global(a:hover) {
    color: var(--color-red, var(--red, #e30613));
  }
  .rich-description :global(:last-child) {
    margin-bottom: 0;
  }
</style>
