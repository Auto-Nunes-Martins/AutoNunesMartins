<script lang="ts">
  import { ArrowLeft } from 'lucide-svelte';
  let { href = '/viaturas', label = 'Voltar' }: { href?: string; label?: string } = $props();
</script>

<a class="orbit-back-link" {href}><ArrowLeft size={16} aria-hidden="true" />{label}</a>

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
