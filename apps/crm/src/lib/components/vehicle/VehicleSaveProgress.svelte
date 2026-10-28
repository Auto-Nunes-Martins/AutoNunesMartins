<script lang="ts">
  import { LoaderCircle, Check } from 'lucide-svelte';
  let { phase = 0, completed = 0, total = 0, label }: {
    phase?: number; completed?: number; total?: number; label: string;
  } = $props();
  const stages = ['Verificar ficha', 'Preparar no dispositivo', 'Enviar fotografias', 'Guardar alterações'];
</script>

<aside data-save-progress class="save-progress" role="status" aria-live="polite" aria-atomic="true">
  <div class="save-heading"><LoaderCircle size={20} class="save-spinner" /><div><strong>{label}</strong><p>{(phase === 1 || phase === 2) && total ? `${completed} de ${total} fotografias ${phase === 1 ? 'preparadas no dispositivo' : 'enviadas'}.` : phase === 0 ? 'A confirmar a versão mais recente da viatura.' : 'A confirmar os dados e as escolhas de publicação.'}</p></div></div>
  <ol aria-label="Etapas da gravação">{#each stages as stage, index}<li class:current={phase === index} class:done={phase > index} aria-current={phase === index ? 'step' : undefined}><span>{#if phase > index}<Check size={12} />{:else}{index + 1}{/if}</span>{stage}</li>{/each}</ol>
  {#if (phase === 1 || phase === 2) && total}<progress max={total} value={completed} aria-label="Fotografias preparadas"></progress>{/if}
</aside>

<style>
  .save-progress { scroll-margin-top:96px; padding: 20px; background: var(--color-bg-elevated); border: 1px solid var(--color-border); border-left: 3px solid var(--color-red); border-radius: var(--radius-card); }
  .save-heading { display: flex; gap: 12px; align-items: flex-start; }
  .save-heading :global(svg) { flex-shrink: 0; margin-top: 2px; color: var(--color-red); }
  .save-heading strong { font-size: 15px; font-weight: 600; }
  p { margin-top: 4px; font-size: 12px; color: var(--color-text-muted); line-height: 1.5; }
  ol { display: flex; flex-wrap: wrap; gap: 12px 20px; padding: 0; margin: 18px 0 0; list-style: none; }
  li { display: flex; align-items: center; gap: 7px; font-size: 11px; color: var(--color-text-muted); }
  li > span { display: grid; place-items: center; width: 20px; height: 20px; border: 1px solid var(--color-border); border-radius: 50%; }
  li.current { color: var(--color-text); font-weight: 600; }
  li.current > span { border-color: var(--color-red); }
  li.done > span { background: var(--color-bg-3); color: var(--color-text); }
  progress { display: block; width: 100%; height: 5px; margin-top: 16px; accent-color: var(--color-red); }
  :global(.save-spinner) { animation: rotate 1s linear infinite; }
  @keyframes rotate { to { transform: rotate(360deg); } }
  @media (prefers-reduced-motion: reduce) { :global(.save-spinner) { animation: none; } }
</style>
