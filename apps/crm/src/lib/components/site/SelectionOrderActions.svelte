<script lang="ts">
  import { ArrowUp, ArrowDown, Trash2 } from 'lucide-svelte';
  let { index, count, kind, disabled = false, removeLabel, onmove, onremove }: {
    index: number; count: number; kind: 'campanha' | 'destaque'; disabled?: boolean;
    removeLabel?: string; onmove: (direction: -1 | 1) => void; onremove: () => void;
  } = $props();
</script>

<div class="row-actions">
  <button type="button" aria-label={`Subir ${kind} ${index + 1}`} title="Subir" disabled={disabled || index === 0} onclick={() => onmove(-1)}><ArrowUp size={16} aria-hidden="true" /></button>
  <button type="button" aria-label={`Descer ${kind} ${index + 1}`} title="Descer" disabled={disabled || index === count - 1} onclick={() => onmove(1)}><ArrowDown size={16} aria-hidden="true" /></button>
  <button type="button" aria-label={removeLabel ?? `Remover ${kind} ${index + 1}`} title={kind === 'destaque' ? 'Remover do carrossel' : 'Remover campanha'} {disabled} onclick={onremove}><Trash2 size={16} aria-hidden="true" /></button>
</div>

<style>
  .row-actions { display: flex; flex-shrink: 0; gap: 2px; margin-left: auto; }
  button { display: grid; place-items: center; width: 32px; height: 34px; padding: 0; color: var(--color-text-muted); border: 1px solid var(--color-border); border-radius: var(--radius-btn); transition: color 160ms ease, background-color 160ms ease, border-color 160ms ease; }
  button:disabled { opacity: 0.35; cursor: not-allowed; }
  button:not(:disabled):hover { color: var(--color-text); border-color: var(--color-border-strong); }
  @media (prefers-reduced-motion: reduce) { button { transition: none; } }
</style>
