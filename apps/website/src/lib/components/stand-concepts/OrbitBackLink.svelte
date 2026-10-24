<script lang="ts">
  import { ArrowLeft } from 'lucide-svelte';
  let {
    href = '/viaturas',
    label = 'Voltar',
    useHistory = false,
  }: { href?: string; label?: string; useHistory?: boolean } = $props();

  function goBack(event: MouseEvent) {
    if (
      !useHistory ||
      event.defaultPrevented ||
      event.button !== 0 ||
      event.ctrlKey ||
      event.metaKey ||
      event.shiftKey ||
      event.altKey ||
      window.history.length <= 1
    )
      return;

    event.preventDefault();
    window.history.back();
  }
</script>

<a class="orbit-back-link" {href} onclick={goBack}
  ><ArrowLeft size={16} aria-hidden="true" />{label}</a
>

<style>
  a {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    min-height: 44px;
    width: fit-content;
    font-size: 14px;
    line-height: 20px;
    color: var(--muted);
    text-decoration: none;
  }
  a:hover {
    color: var(--text);
  }
  a:focus-visible {
    outline: 2px solid var(--red);
    outline-offset: 4px;
  }
</style>
