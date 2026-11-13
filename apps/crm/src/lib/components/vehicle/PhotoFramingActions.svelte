<script lang="ts">
  let { label, note, disabled = false, onsave, oncancel }: {
    label: string;
    note: string;
    disabled?: boolean;
    onsave: () => void | Promise<void>;
    oncancel?: () => void;
  } = $props();
</script>

<div class="framing-actions">
  <p>{note}</p>
  <div class="buttons">
    {#if oncancel}<button type="button" {disabled} onclick={oncancel}>Cancelar</button>{/if}
    <button type="button" class="primary" {disabled} onclick={onsave}>{label}</button>
  </div>
</div>

<style>
  .framing-actions {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 14px 24px;
  }
  p {
    flex: 1 1 220px;
    margin: 0;
    color: var(--color-text-muted);
    font-size: 12px;
    line-height: 1.5;
  }
  .buttons { display: flex; flex-wrap: wrap; gap: 8px; }
  button {
    min-height: 44px;
    padding: 11px 16px;
    border: 1px solid var(--color-border);
    border-radius: 8px;
    background: var(--color-bg-1);
    color: var(--color-text);
    font-size: 13px;
    font-weight: 600;
    line-height: 1.4;
  }
  .primary { background: var(--color-red); border-color: var(--color-red); color: white; }
  button:disabled { opacity: .45; cursor: default; }
  button:focus-visible { outline: 2px solid var(--color-text-muted); outline-offset: 3px; }
  @media (max-width: 500px) {
    .buttons { width: 100%; }
    .buttons button { flex: 1 1 auto; }
  }
</style>
