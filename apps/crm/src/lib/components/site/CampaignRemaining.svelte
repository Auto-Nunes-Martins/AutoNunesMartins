<script lang="ts">
  import { onMount } from 'svelte';
  import { Clock3 } from 'lucide-svelte';
  let { endsAt }: { endsAt: string } = $props();
  let now = $state<number | null>(null);
  const end = $derived(Date.parse(endsAt));
  const remaining = $derived.by(() => {
    if (now === null || !Number.isFinite(end)) return null;
    const seconds = Math.max(0, Math.ceil((end - now) / 1000));
    if (!seconds) return 'Terminada';
    const days = Math.floor(seconds / 86400);
    const hours = String(Math.floor(seconds % 86400 / 3600)).padStart(2, '0');
    const minutes = String(Math.floor(seconds % 3600 / 60)).padStart(2, '0');
    const secs = String(seconds % 60).padStart(2, '0');
    return `${days}d ${hours}h ${minutes}m ${secs}s`;
  });
  onMount(() => {
    const update = () => { if (!document.hidden) now = Date.now(); };
    update();
    const timer = setInterval(update, 1000);
    document.addEventListener('visibilitychange', update);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', update); };
  });
</script>

<time datetime={endsAt} title="Tempo restante da campanha guardada" aria-label={remaining ? `Tempo restante: ${remaining}` : 'A carregar tempo restante'}>
  <Clock3 size={13} aria-hidden="true" />
  <span>{remaining === 'Terminada' ? remaining : `Termina em ${remaining ?? '…'}`}</span>
</time>

<style>
  time { display: inline-flex; align-items: center; gap: 6px; color: var(--color-text-muted); font-size: 11px; font-variant-numeric: tabular-nums; }
</style>
